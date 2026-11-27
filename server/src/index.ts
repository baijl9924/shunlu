import './env.js';
import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, POINTS_SQL, type IssueRow, type User } from './db.js';
import { AI_MOCK, CATEGORIES, analyzeImage, generateReport, summarizeCity, type Analysis } from './ai.js';
import { UPLOAD_DIR, mapBoxToImage, moveImage, normalize, pixelate, saveImage, toAiCanvas } from './image.js';
import { reverseGeocode } from './geo.js';

const app = new Hono();
const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();
const MAX_IMAGE = 12 * 1024 * 1024;

// ---------- 工具 ----------
function getUser(c: Context): User | null {
  const token = c.req.header('x-user-token');
  if (!token) return null;
  return (db.prepare('SELECT * FROM users WHERE token = ?').get(token) as User) || null;
}

const buckets = new Map<string, { n: number; reset: number }>();
function rateLimit(key: string, limit: number, windowMs: number) {
  const b = buckets.get(key);
  const t = now();
  if (!b || b.reset < t) {
    buckets.set(key, { n: 1, reset: t + windowMs });
    return true;
  }
  b.n++;
  return b.n <= limit;
}

async function readImage(v: unknown): Promise<Buffer | null> {
  if (!v || typeof v === 'string') return null;
  const f = v as File;
  if (f.size > MAX_IMAGE) throw new Error('图片过大（最大 12MB）');
  return Buffer.from(await f.arrayBuffer());
}

function publicIssue(i: IssueRow & { confirm_count?: number; nickname?: string }) {
  return {
    id: i.id,
    lat: i.lat,
    lng: i.lng,
    address: i.address,
    city: i.city,
    district: i.district,
    category: i.category,
    severity: i.severity,
    title: i.title,
    description: i.description,
    department: i.department,
    channel: i.channel,
    reportText: i.report_text,
    photo: `/uploads/${i.photo}`,
    status: i.status,
    hidden: !!i.hidden,
    confirmCount: i.confirm_count ?? 0,
    nickname: i.nickname ?? '',
    createdAt: i.created_at,
  };
}

const ISSUE_SELECT = `
  SELECT i.*, u.nickname,
    (SELECT COUNT(*) FROM confirmations c WHERE c.issue_id = i.id) AS confirm_count
  FROM issues i JOIN users u ON u.id = i.user_id`;

function levelOf(points: number) {
  const levels = [
    { min: 0, name: '见习体检官' },
    { min: 50, name: '体检官' },
    { min: 200, name: '高级体检官' },
    { min: 500, name: '首席体检官' },
  ];
  let idx = 0;
  levels.forEach((l, i) => points >= l.min && (idx = i));
  const next = levels[idx + 1];
  return { name: levels[idx].name, index: idx, next: next ? { name: next.name, need: next.min - points } : null };
}

// ---------- 配置 ----------
app.get('/api/config', (c) =>
  c.json({ tmapKey: process.env.TMAP_KEY?.trim() || '', aiMock: AI_MOCK, categories: CATEGORIES }),
);

app.get('/api/stats', (c) => {
  const s = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM issues WHERE hidden = 0) AS issues,
        (SELECT COUNT(*) FROM issues WHERE hidden = 0 AND status = 'fixed') AS fixed,
        (SELECT COUNT(*) FROM confirmations) AS confirmations,
        (SELECT COUNT(DISTINCT city) FROM issues WHERE hidden = 0 AND city <> '') AS cities,
        (SELECT COUNT(*) FROM users) AS users`,
    )
    .get();
  return c.json(s);
});

// ---------- 用户 ----------
app.post('/api/users', async (c) => {
  const { nickname } = await c.req.json().catch(() => ({}));
  const name = String(nickname || '').trim().slice(0, 16);
  if (!name) return c.json({ error: '请填写昵称' }, 400);
  if (!rateLimit(`user:${c.req.header('x-forwarded-for') || 'local'}`, 20, 3600_000))
    return c.json({ error: '操作太频繁，请稍后再试' }, 429);
  const user = { id: uid(), token: crypto.randomBytes(24).toString('base64url'), nickname: name, created_at: now() };
  db.prepare('INSERT INTO users (id, token, nickname, created_at) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.token,
    user.nickname,
    user.created_at,
  );
  return c.json(user);
});

app.get('/api/me', (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const stats = db
    .prepare(
      `SELECT ${POINTS_SQL} AS points,
        (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id AND i.hidden = 0) AS issues,
        (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id AND i.hidden = 0 AND i.status = 'fixed') AS fixed,
        (SELECT COUNT(*) FROM confirmations c JOIN issues i ON i.id = c.issue_id WHERE i.user_id = u.id AND i.hidden = 0) AS confirmed,
        (SELECT COUNT(*) FROM confirmations c WHERE c.user_id = u.id) AS helped,
        (SELECT COUNT(*) FROM updates up WHERE up.user_id = u.id AND up.type IN ('fixed','recheck')) AS rechecks,
        (SELECT COUNT(DISTINCT city) FROM issues i WHERE i.user_id = u.id AND i.hidden = 0 AND i.city <> '') AS cities
      FROM users u WHERE u.id = ?`,
    )
    .get(user.id) as Record<string, number>;
  const badges = [
    { id: 'first', name: '初次体检', desc: '完成第一次随手拍', got: stats.issues >= 1 },
    { id: 'ten', name: '火眼金睛', desc: '累计标记 10 个问题', got: stats.issues >= 10 },
    { id: 'echo', name: '一呼百应', desc: '你的标记被确认 10 次', got: stats.confirmed >= 10 },
    { id: 'helper', name: '热心路人', desc: '为他人的标记点 5 次“我也遇到”', got: stats.helped >= 5 },
    { id: 'fixer', name: '见证改变', desc: '你标记的问题有 1 个已整改', got: stats.fixed >= 1 },
    { id: 'recheck', name: '回头看', desc: '提交 1 次整改复查', got: stats.rechecks >= 1 },
    { id: 'traveler', name: '城市漫游者', desc: '在 2 个以上城市留下标记', got: stats.cities >= 2 },
  ];
  const mine = db
    .prepare(`${ISSUE_SELECT} WHERE i.user_id = ? AND i.hidden = 0 ORDER BY i.created_at DESC LIMIT 100`)
    .all(user.id) as IssueRow[];
  return c.json({
    id: user.id,
    nickname: user.nickname,
    stats,
    level: levelOf(stats.points),
    badges,
    issues: mine.map(publicIssue),
  });
});

app.patch('/api/me', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const { nickname } = await c.req.json().catch(() => ({}));
  const name = String(nickname || '').trim().slice(0, 16);
  if (!name) return c.json({ error: '请填写昵称' }, 400);
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(name, user.id);
  return c.json({ ok: true });
});

// ---------- 地理 ----------
app.get('/api/geocode', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return c.json({ error: '坐标无效' }, 400);
  return c.json(await reverseGeocode(lat, lng));
});

// ---------- AI 识别（生成草稿） ----------
app.post('/api/analyze', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  if (!rateLimit(`analyze:${user.id}`, 30, 3600_000)) return c.json({ error: '识别次数太多，请一小时后再试' }, 429);
  try {
    const body = await c.req.parseBody();
    const raw = await readImage(body.image);
    if (!raw) return c.json({ error: '请上传照片' }, 400);
    const img = await normalize(raw);
    const t = await toAiCanvas(img.buf, img.width, img.height);
    let analysis: Analysis;
    try {
      analysis = await analyzeImage(t.canvas);
    } catch (e) {
      console.error('[ai] analyze failed:', e);
      return c.json({ error: 'AI 识别暂时不可用，请稍后重试' }, 502);
    }
    if (!analysis.accept) return c.json({ accept: false, reason: analysis.reject_reason || '没有识别到无障碍相关问题，换个角度再拍一张吧' });

    const regions = analysis.privacy_boxes
      .map((b) => mapBoxToImage(b.bbox, t, img.width, img.height))
      .filter((r): r is NonNullable<typeof r> => !!r);
    const blurred = await pixelate(img.buf, regions);
    const photo = saveImage(blurred, 'drafts');
    const id = uid();
    db.prepare('INSERT INTO drafts (id, user_id, analysis, photo, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      user.id,
      JSON.stringify(analysis),
      photo,
      now(),
    );
    return c.json({
      accept: true,
      draftId: id,
      photo: `/uploads/${photo}`,
      blurredCount: regions.length,
      analysis: {
        category: analysis.category,
        severity: analysis.severity,
        title: analysis.title,
        description: analysis.description,
        department: analysis.department,
        channel: analysis.channel,
      },
    });
  } catch (e) {
    console.error('[analyze]', e);
    return c.json({ error: (e as Error).message || '照片处理失败' }, 400);
  }
});

// ---------- 问题点 ----------
app.post('/api/issues', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const body = await c.req.parseBody();
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(String(body.draftId), user.id) as
    | { id: string; analysis: string; photo: string }
    | undefined;
  if (!draft) return c.json({ error: '草稿不存在或已提交' }, 400);
  const a = JSON.parse(draft.analysis) as Analysis;

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return c.json({ error: '缺少位置信息' }, 400);

  // 用户手动补涂了马赛克，则使用新图片
  let photo: string;
  const edited = await readImage(body.image).catch(() => null);
  if (edited) {
    const img = await normalize(edited);
    photo = saveImage(img.buf, 'issues');
    fs.rmSync(path.join(UPLOAD_DIR, draft.photo), { force: true });
  } else {
    photo = moveImage(draft.photo, 'issues');
  }

  const category = CATEGORIES.includes(body.category as any) ? String(body.category) : a.category;
  const severity = [1, 2, 3].includes(Number(body.severity)) ? Number(body.severity) : a.severity;
  const title = String(body.title || a.title).slice(0, 20);
  const description = String(body.description || a.description).slice(0, 200);
  let geo = { address: String(body.address || ''), city: String(body.city || ''), district: String(body.district || '') };
  if (!geo.city) geo = { ...(await reverseGeocode(lat, lng)), ...(geo.address ? { address: geo.address } : {}) };

  const reportText = await generateReport({
    category,
    title,
    description,
    address: geo.address,
    department: a.department,
    channel: a.channel,
    severity,
    time: new Date(),
  });

  const id = uid();
  const t = now();
  db.prepare(
    `INSERT INTO issues (id, user_id, lat, lng, address, city, district, category, severity, title, description,
      department, channel, report_text, photo, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(id, user.id, lat, lng, geo.address, geo.city, geo.district, category, severity, title, description, a.department, a.channel, reportText, photo, t, t);
  db.prepare('DELETE FROM drafts WHERE id = ?').run(draft.id);
  return c.json({ id });
});

app.get('/api/issues', (c) => {
  const where = ['i.hidden = 0'];
  const params: unknown[] = [];
  const city = c.req.query('city');
  const category = c.req.query('category');
  const status = c.req.query('status');
  if (city) (where.push('i.city = ?'), params.push(city));
  if (category) (where.push('i.category = ?'), params.push(category));
  if (status) (where.push('i.status = ?'), params.push(status));
  const rows = db
    .prepare(`${ISSUE_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC LIMIT 1000`)
    .all(...params) as IssueRow[];
  return c.json(rows.map(publicIssue));
});

app.get('/api/issues/:id', (c) => {
  const user = getUser(c);
  const row = db.prepare(`${ISSUE_SELECT} WHERE i.id = ?`).get(c.req.param('id')) as IssueRow | undefined;
  if (!row || row.hidden) return c.json({ error: '问题点不存在或已下架' }, 404);
  const updates = db
    .prepare(
      `SELECT up.id, up.type, up.note, up.photo, up.created_at AS createdAt, u.nickname
       FROM updates up JOIN users u ON u.id = up.user_id WHERE up.issue_id = ? ORDER BY up.created_at ASC`,
    )
    .all(row.id)
    .map((u: any) => ({ ...u, photo: u.photo ? `/uploads/${u.photo}` : null }));
  const confirmed = user
    ? !!db.prepare('SELECT 1 FROM confirmations WHERE issue_id = ? AND user_id = ?').get(row.id, user.id)
    : false;
  const reportedByMe = user
    ? !!db.prepare("SELECT 1 FROM updates WHERE issue_id = ? AND user_id = ? AND type = 'reported'").get(row.id, user.id)
    : false;
  return c.json({ ...publicIssue(row), updates, confirmed, reportedByMe, mine: user?.id === row.user_id });
});

app.post('/api/issues/:id/confirm', (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const row = db.prepare('SELECT user_id FROM issues WHERE id = ? AND hidden = 0').get(c.req.param('id')) as
    | { user_id: string }
    | undefined;
  if (!row) return c.json({ error: '问题点不存在' }, 404);
  if (row.user_id === user.id) return c.json({ error: '不能确认自己的标记' }, 400);
  db.prepare('INSERT OR IGNORE INTO confirmations (issue_id, user_id, created_at) VALUES (?, ?, ?)').run(
    c.req.param('id'),
    user.id,
    now(),
  );
  return c.json({ ok: true });
});

app.post('/api/issues/:id/updates', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND hidden = 0').get(c.req.param('id')) as IssueRow | undefined;
  if (!issue) return c.json({ error: '问题点不存在' }, 404);
  const body = await c.req.parseBody();
  const type = String(body.type);
  if (!['reported', 'fixed', 'recheck'].includes(type)) return c.json({ error: '类型无效' }, 400);
  if (type === 'reported' && db.prepare("SELECT 1 FROM updates WHERE issue_id = ? AND user_id = ? AND type = 'reported'").get(issue.id, user.id))
    return c.json({ error: '你已经标记过“已反映”' }, 400);
  const raw = await readImage(body.photo).catch(() => null);
  if ((type === 'fixed' || type === 'recheck') && !raw) return c.json({ error: '请上传现场照片作为凭证' }, 400);
  let photo: string | null = null;
  if (raw) {
    const img = await normalize(raw);
    photo = saveImage(img.buf, 'updates');
  }
  db.prepare('INSERT INTO updates (id, issue_id, user_id, type, note, photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    uid(),
    issue.id,
    user.id,
    type,
    String(body.note || '').slice(0, 200),
    photo,
    now(),
  );
  const nextStatus = type === 'fixed' ? 'fixed' : type === 'reported' && issue.status === 'pending' ? 'reported' : issue.status;
  db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now(), issue.id);
  return c.json({ ok: true, status: nextStatus });
});

// ---------- 排行 ----------
app.get('/api/leaderboard', (c) => {
  const city = c.req.query('city');
  const users = db
    .prepare(
      `SELECT u.id, u.nickname, ${POINTS_SQL} AS points,
        (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id AND i.hidden = 0 ${city ? 'AND i.city = @city' : ''}) AS issues
       FROM users u
       ${city ? 'WHERE EXISTS (SELECT 1 FROM issues i WHERE i.user_id = u.id AND i.city = @city AND i.hidden = 0)' : ''}
       ORDER BY points DESC LIMIT 50`,
    )
    .all(city ? { city } : {});
  const cities = db
    .prepare(
      `SELECT city, COUNT(*) AS issues, SUM(status = 'fixed') AS fixed, COUNT(DISTINCT user_id) AS users
       FROM issues WHERE hidden = 0 AND city <> '' GROUP BY city ORDER BY issues DESC LIMIT 50`,
    )
    .all();
  return c.json({ users: (users as any[]).filter((u) => u.points > 0), cities });
});

// ---------- 城市体检报告 ----------
app.get('/api/report', async (c) => {
  const city = c.req.query('city') || '';
  const district = c.req.query('district') || '';
  const where = ['hidden = 0'];
  const params: string[] = [];
  if (city) (where.push('city = ?'), params.push(city));
  if (district) (where.push('district = ?'), params.push(district));
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n, SUM(status='fixed') AS fixed, SUM(status='reported') AS reported, SUM(severity=3) AS severe, COUNT(DISTINCT user_id) AS users FROM issues WHERE ${w}`).get(...params) as Record<string, number>;
  const byCategory = db.prepare(`SELECT category, COUNT(*) AS n FROM issues WHERE ${w} GROUP BY category ORDER BY n DESC`).all(...params);
  const byDistrict = db.prepare(`SELECT district, COUNT(*) AS n, SUM(status='fixed') AS fixed FROM issues WHERE ${w} AND district <> '' GROUP BY district ORDER BY n DESC LIMIT 20`).all(...params);
  const wi = where.map((x) => `i.${x}`).join(' AND ');
  const top = (db.prepare(`${ISSUE_SELECT} WHERE ${wi} ORDER BY confirm_count DESC, i.severity DESC LIMIT 5`).all(...params) as IssueRow[]).map(publicIssue);
  const scope = [city || '全国', district].filter(Boolean).join('');

  let summary = '';
  if (total.n > 0) {
    const key = `${scope}:${total.n}:${total.fixed}`;
    const cached = db.prepare('SELECT summary, created_at FROM report_cache WHERE key = ?').get(key) as
      | { summary: string; created_at: number }
      | undefined;
    if (cached) summary = cached.summary;
    else {
      summary = await summarizeCity(scope, { total, byCategory, byDistrict, top: top.map((t) => ({ title: t.title, address: t.address, confirm: t.confirmCount, severity: t.severity })) });
      db.prepare('INSERT OR REPLACE INTO report_cache (key, summary, created_at) VALUES (?, ?, ?)').run(key, summary, now());
    }
  }
  return c.json({ scope, total, byCategory, byDistrict, top, summary, generatedAt: now() });
});

// ---------- 管理后台 ----------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const adminToken = crypto.createHash('sha256').update(`shunlu-admin:${ADMIN_PASSWORD}`).digest('hex');
const isAdmin = (c: Context) => c.req.header('x-admin-token') === adminToken;

app.post('/api/admin/login', async (c) => {
  if (!rateLimit(`admin:${c.req.header('x-forwarded-for') || 'local'}`, 10, 600_000)) return c.json({ error: '尝试次数过多' }, 429);
  const { password } = await c.req.json().catch(() => ({}));
  if (password !== ADMIN_PASSWORD) return c.json({ error: '密码错误' }, 401);
  return c.json({ token: adminToken });
});

app.get('/api/admin/issues', (c) => {
  if (!isAdmin(c)) return c.json({ error: '无权限' }, 401);
  const rows = db.prepare(`${ISSUE_SELECT} ORDER BY i.created_at DESC LIMIT 500`).all() as IssueRow[];
  return c.json(rows.map(publicIssue));
});

app.patch('/api/admin/issues/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: '无权限' }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.hidden === 'boolean') db.prepare('UPDATE issues SET hidden = ? WHERE id = ?').run(body.hidden ? 1 : 0, c.req.param('id'));
  if (['pending', 'reported', 'fixed'].includes(body.status)) db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?').run(body.status, now(), c.req.param('id'));
  return c.json({ ok: true });
});

// ---------- 静态文件 ----------
app.use('/uploads/*', serveStatic({ root: path.relative(process.cwd(), path.resolve(UPLOAD_DIR, '..')) || '.' }));
const WEB_DIST = path.resolve(import.meta.dirname, '../../web/dist');
if (fs.existsSync(WEB_DIST)) {
  const root = path.relative(process.cwd(), WEB_DIST);
  app.use('/*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

// 清理 24 小时前未提交的草稿
setInterval(() => {
  const old = db.prepare('SELECT id, photo FROM drafts WHERE created_at < ?').all(now() - 86400_000) as { id: string; photo: string }[];
  for (const d of old) {
    fs.rmSync(path.join(UPLOAD_DIR, d.photo), { force: true });
    db.prepare('DELETE FROM drafts WHERE id = ?').run(d.id);
  }
}, 3600_000).unref();

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`顺路服务已启动：http://localhost:${port}  AI ${AI_MOCK ? '模拟模式' : '已接入通义千问'}  地图 ${process.env.TMAP_KEY ? '已配置' : '未配置 Key'}`);
});
