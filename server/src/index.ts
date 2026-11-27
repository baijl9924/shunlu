import './env.js';
import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, POINTS_SQL, type IssueRow, type User } from './db.js';
import { hashPassword, newToken, safeEqual, verifyPassword } from './auth.js';
import { AI_MOCK, CATEGORIES, analyzeImage, generateReport, moderateRecheckImage, summarizeCity, type Analysis } from './ai.js';
import { UPLOAD_DIR, mapBoxToImage, moveImage, normalize, pixelate, saveImage, toAiCanvas } from './image.js';
import { reverseGeocode } from './geo.js';

const app = new Hono();
const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();
const MAX_IMAGE = 12 * 1024 * 1024;
const SESSION_TTL = 30 * 86400_000;
const ADMIN_TTL = 24 * 3600_000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';

// ---------- 工具与鉴权 ----------
function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  return (xff ? xff.split(',')[0].trim() : c.req.header('x-real-ip')) || 'local';
}

function getUser(c: Context): User | null {
  const token = c.req.header('x-user-token');
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, now()) as User | undefined;
  return row || null;
}

function isAdmin(c: Context): boolean {
  const user = getUser(c);
  if (user?.role === 'admin') return true;
  const token = c.req.header('x-admin-token');
  if (!token) return false;
  return !!db.prepare('SELECT 1 FROM admin_sessions WHERE token = ? AND expires_at > ?').get(token, now());
}

function createSession(userId: string): string {
  const token = newToken();
  const t = now();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    t,
    t + SESSION_TTL,
  );
  return token;
}

function validNickname(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = String(raw || '').trim();
  if (name.length < 2) return { ok: false, error: '昵称至少 2 个字' };
  if (name.length > 16) return { ok: false, error: '昵称最多 16 个字' };
  if (/[\r\n\t<>]/.test(name)) return { ok: false, error: '昵称不能包含特殊控制字符' };
  return { ok: true, value: name };
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

// ---------- 配置与公开统计 ----------
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

// ---------- 账号认证（注册 / 登录 / 退出，昵称全局唯一 + 密码安全哈希） ----------
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const check = validNickname(body.nickname);
  if (!check.ok) return c.json({ error: check.error }, 400);
  const password = String(body.password || '');
  if (password.length < 6 || password.length > 64) return c.json({ error: '请设置 6–64 位登录密码' }, 400);
  if (!rateLimit(`reg:${clientIp(c)}`, 15, 3600_000)) return c.json({ error: '注册太频繁，请稍后再试' }, 429);

  const dup = db.prepare('SELECT id FROM users WHERE LOWER(nickname) = LOWER(?)').get(check.value);
  if (dup) return c.json({ error: '该昵称已被使用，如果是你的账号请切换「登录」', code: 'NICKNAME_TAKEN' }, 409);

  const id = uid();
  const token = newToken();
  const t = now();
  try {
    db.prepare('INSERT INTO users (id, token, nickname, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      token,
      check.value,
      hashPassword(password),
      'user',
      t,
    );
  } catch {
    return c.json({ error: '该昵称已被使用，请换一个昵称或直接登录', code: 'NICKNAME_TAKEN' }, 409);
  }
  const sessionToken = createSession(id);
  return c.json({ id, token: sessionToken, nickname: check.value, role: 'user', hasPassword: true });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.nickname || '').trim();
  const password = String(body.password || '');
  if (!name || !password) return c.json({ error: '请填写昵称和密码' }, 400);
  if (!rateLimit(`login:${clientIp(c)}:${name.toLowerCase()}`, 10, 600_000))
    return c.json({ error: '尝试次数过多，请 10 分钟后再试' }, 429);

  const user = db.prepare('SELECT * FROM users WHERE LOWER(nickname) = LOWER(?)').get(name) as User | undefined;
  if (!user) return c.json({ error: '昵称或密码错误' }, 401);
  if (!user.password_hash) {
    return c.json({ error: '该昵称尚未设置密码，请在原设备的「我的」里设置密码后再跨设备登录' }, 400);
  }
  if (!verifyPassword(password, user.password_hash)) return c.json({ error: '昵称或密码错误' }, 401);

  const sessionToken = createSession(user.id);
  return c.json({ id: user.id, token: sessionToken, nickname: user.nickname, role: user.role, hasPassword: true });
});

app.post('/api/auth/logout', (c) => {
  const token = c.req.header('x-user-token');
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return c.json({ ok: true });
});

// 兼容旧注册入口：强制检查重名与密码，防止任何客户端绕过重名校验
app.post('/api/users', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const check = validNickname(body.nickname);
  if (!check.ok) return c.json({ error: check.error }, 400);
  const password = String(body.password || '');
  if (password.length < 6) return c.json({ error: '请设置至少 6 位密码以保护你的账号' }, 400);
  if (!rateLimit(`reg:${clientIp(c)}`, 15, 3600_000)) return c.json({ error: '操作太频繁，请稍后再试' }, 429);
  const dup = db.prepare('SELECT id FROM users WHERE LOWER(nickname) = LOWER(?)').get(check.value);
  if (dup) return c.json({ error: '该昵称已被使用，请换一个昵称或直接登录', code: 'NICKNAME_TAKEN' }, 409);

  const id = uid();
  const token = newToken();
  const t = now();
  db.prepare('INSERT INTO users (id, token, nickname, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    token,
    check.value,
    hashPassword(password),
    'user',
    t,
  );
  const sessionToken = createSession(id);
  return c.json({ id, token: sessionToken, nickname: check.value, role: 'user', hasPassword: true });
});

// ---------- 个人中心与账号设置 ----------
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
        (SELECT COUNT(*) FROM updates up WHERE up.user_id = u.id AND up.type IN ('fixed','recheck','fixed_claim')) AS rechecks,
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
    role: user.role,
    hasPassword: !!user.password_hash,
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
  const check = validNickname(nickname);
  if (!check.ok) return c.json({ error: check.error }, 400);
  const dup = db.prepare('SELECT id FROM users WHERE LOWER(nickname) = LOWER(?) AND id <> ?').get(check.value, user.id);
  if (dup) return c.json({ error: '该昵称已被其他用户使用，请换一个', code: 'NICKNAME_TAKEN' }, 409);
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(check.value, user.id);
  return c.json({ ok: true, nickname: check.value });
});

app.post('/api/me/password', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const { oldPassword, newPassword } = await c.req.json().catch(() => ({}));
  const next = String(newPassword || '');
  if (next.length < 6 || next.length > 64) return c.json({ error: '新密码需为 6–64 位' }, 400);
  if (user.password_hash && !verifyPassword(String(oldPassword || ''), user.password_hash)) {
    return c.json({ error: '原密码不正确' }, 400);
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
  return c.json({ ok: true });
});

// ---------- 地理 ----------
app.get('/api/geocode', async (c) => {
  if (!rateLimit(`geo:${clientIp(c)}`, 120, 600_000)) return c.json({ error: '请求过于频繁' }, 429);
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return c.json({ error: '坐标无效' }, 400);
  return c.json(await reverseGeocode(lat, lng));
});

// ---------- AI 识别（生成私有草稿） ----------
app.post('/api/analyze', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '请先登录后再上传照片' }, 401);
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
    if (!analysis.accept)
      return c.json({ accept: false, reason: analysis.reject_reason || '没有识别到无障碍相关问题，换个角度再拍一张吧' });

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
      photo: `/api/drafts/${id}/photo`,
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

// 私有草稿图片仅本人可访问（隔离未发布照片）
app.get('/api/drafts/:id/photo', (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '未登录' }, 401);
  const draft = db.prepare('SELECT photo, user_id FROM drafts WHERE id = ?').get(c.req.param('id')) as
    | { photo: string; user_id: string }
    | undefined;
  if (!draft) return c.json({ error: '草稿不存在' }, 404);
  if (draft.user_id !== user.id && user.role !== 'admin') return c.json({ error: '无权访问他人草稿' }, 403);
  const full = path.join(UPLOAD_DIR, draft.photo);
  if (!fs.existsSync(full)) return c.json({ error: '文件不存在' }, 404);
  return new Response(fs.readFileSync(full), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=300' } });
});

// ---------- 问题点（含所有权与角色权限校验） ----------
app.post('/api/issues', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '请先登录' }, 401);
  if (!rateLimit(`issue:${user.id}`, 20, 3600_000)) return c.json({ error: '提交过于频繁，请稍后再试' }, 429);
  const body = await c.req.parseBody();
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(String(body.draftId), user.id) as
    | { id: string; analysis: string; photo: string }
    | undefined;
  if (!draft) return c.json({ error: '草稿不存在、无权限或已提交' }, 400);
  const a = JSON.parse(draft.analysis) as Analysis;

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return c.json({ error: '缺少位置信息' }, 400);

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
  const title = String(body.title || a.title).trim().slice(0, 20) || a.title;
  const description = String(body.description || a.description).trim().slice(0, 200);
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
  db.prepare('DELETE FROM report_cache').run();
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
  const canManage = !!user && (user.id === row.user_id || user.role === 'admin');
  return c.json({ ...publicIssue(row), updates, confirmed, reportedByMe, mine: user?.id === row.user_id, canManage });
});

// 仅发布者本人或管理员可修改/删除问题点
app.patch('/api/issues/:id', async (c) => {
  const user = getUser(c);
  if (!user && !isAdmin(c)) return c.json({ error: '请先登录' }, 401);
  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND hidden = 0').get(c.req.param('id')) as IssueRow | undefined;
  if (!issue) return c.json({ error: '问题点不存在' }, 404);
  if (!isAdmin(c) && issue.user_id !== user?.id) return c.json({ error: '无权修改他人的标记' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const title = body.title ? String(body.title).trim().slice(0, 20) : issue.title;
  const description = body.description !== undefined ? String(body.description).trim().slice(0, 200) : issue.description;
  const category = CATEGORIES.includes(body.category) ? String(body.category) : issue.category;
  const severity = [1, 2, 3].includes(Number(body.severity)) ? Number(body.severity) : issue.severity;
  db.prepare('UPDATE issues SET title = ?, description = ?, category = ?, severity = ?, updated_at = ? WHERE id = ?').run(
    title,
    description,
    category,
    severity,
    now(),
    issue.id,
  );
  return c.json({ ok: true });
});

app.delete('/api/issues/:id', (c) => {
  const user = getUser(c);
  if (!user && !isAdmin(c)) return c.json({ error: '请先登录' }, 401);
  const issue = db.prepare('SELECT id, user_id FROM issues WHERE id = ? AND hidden = 0').get(c.req.param('id')) as
    | { id: string; user_id: string }
    | undefined;
  if (!issue) return c.json({ error: '问题点不存在' }, 404);
  if (!isAdmin(c) && issue.user_id !== user?.id) return c.json({ error: '无权删除他人的标记' }, 403);
  db.prepare('UPDATE issues SET hidden = 1, updated_at = ? WHERE id = ?').run(now(), issue.id);
  db.prepare('DELETE FROM report_cache').run();
  return c.json({ ok: true });
});

app.post('/api/issues/:id/confirm', (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: '请先登录' }, 401);
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
  if (!user) return c.json({ error: '请先登录' }, 401);
  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND hidden = 0').get(c.req.param('id')) as IssueRow | undefined;
  if (!issue) return c.json({ error: '问题点不存在' }, 404);
  const body = await c.req.parseBody();
  const type = String(body.type);
  if (!['reported', 'fixed', 'recheck'].includes(type)) return c.json({ error: '类型无效' }, 400);

  if (type === 'reported') {
    if (db.prepare("SELECT 1 FROM updates WHERE issue_id = ? AND user_id = ? AND type = 'reported'").get(issue.id, user.id))
      return c.json({ error: '你已经标记过“已反映”' }, 400);
  } else {
    // 防刷分：同一用户 24 小时内对同一问题最多提交 1 次复查
    const recent = db
      .prepare("SELECT 1 FROM updates WHERE issue_id = ? AND user_id = ? AND type IN ('fixed','fixed_claim','recheck') AND created_at > ?")
      .get(issue.id, user.id, now() - 86400_000);
    if (recent) return c.json({ error: '24 小时内已对该点位提交过复查，明天再来吧' }, 429);
  }

  const raw = await readImage(body.photo).catch(() => null);
  if ((type === 'fixed' || type === 'recheck') && !raw) return c.json({ error: '请上传现场照片作为凭证' }, 400);

  let photo: string | null = null;
  if (raw) {
    const img = await normalize(raw);
    const t = await toAiCanvas(img.buf, img.width, img.height);
    const mod = await moderateRecheckImage(t.canvas);
    if (!mod.accept) return c.json({ error: mod.reason || '请上传真实的现场照片' }, 400);
    const regions = mod.privacy_boxes
      .map((b) => mapBoxToImage(b.bbox, t, img.width, img.height))
      .filter((r): r is NonNullable<typeof r> => !!r);
    const blurred = await pixelate(img.buf, regions);
    photo = saveImage(blurred, 'updates');
  }

  // 权限防恶意篡改：仅原发布者、管理员，或满 2 位不同市民先后拍图确认后，才将状态正式置为「已整改」
  let storedType = type;
  let nextStatus = issue.status;
  let message = type === 'reported' ? '已记录，积分 +5' : '感谢复查，积分 +20';

  if (type === 'reported') {
    if (issue.status === 'pending') nextStatus = 'reported';
  } else if (type === 'fixed') {
    const isOwnerOrAdmin = issue.user_id === user.id || user.role === 'admin' || isAdmin(c);
    const priorClaims = (
      db
        .prepare("SELECT COUNT(DISTINCT user_id) AS n FROM updates WHERE issue_id = ? AND type IN ('fixed','fixed_claim') AND user_id <> ?")
        .get(issue.id, user.id) as { n: number }
    ).n;
    if (isOwnerOrAdmin || priorClaims >= 1) {
      storedType = 'fixed';
      nextStatus = 'fixed';
      message = '已核实整改完成，积分 +20';
    } else {
      storedType = 'fixed_claim';
      message = '已记录整改复查凭证（积分 +20），再有 1 位市民或发布者确认后将正式标为「已整改」';
    }
  }

  db.prepare('INSERT INTO updates (id, issue_id, user_id, type, note, photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    uid(),
    issue.id,
    user.id,
    storedType,
    String(body.note || '').slice(0, 200),
    photo,
    now(),
  );
  if (nextStatus !== issue.status) {
    db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now(), issue.id);
    db.prepare('DELETE FROM report_cache').run();
  }
  return c.json({ ok: true, status: nextStatus, message });
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

// ---------- 管理后台（随机过期 Session + 权限管理） ----------
app.post('/api/admin/login', async (c) => {
  if (!rateLimit(`admin:${clientIp(c)}`, 10, 600_000)) return c.json({ error: '尝试次数过多，请 10 分钟后再试' }, 429);
  const { password } = await c.req.json().catch(() => ({}));
  if (!safeEqual(String(password || ''), ADMIN_PASSWORD)) return c.json({ error: '密码错误' }, 401);
  const token = newToken();
  const t = now();
  db.prepare('INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)').run(token, t, t + ADMIN_TTL);
  return c.json({ token });
});

app.post('/api/admin/logout', (c) => {
  const token = c.req.header('x-admin-token');
  if (token) db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  return c.json({ ok: true });
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
  db.prepare('DELETE FROM report_cache').run();
  return c.json({ ok: true });
});

app.get('/api/admin/users', (c) => {
  if (!isAdmin(c)) return c.json({ error: '无权限' }, 401);
  const rows = db
    .prepare(
      `SELECT u.id, u.nickname, u.role, (u.password_hash <> '') AS hasPassword, u.created_at AS createdAt,
        (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id AND i.hidden = 0) AS issues
       FROM users u ORDER BY u.created_at DESC LIMIT 200`,
    )
    .all();
  return c.json(rows);
});

app.patch('/api/admin/users/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: '无权限' }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (body.role === 'admin' || body.role === 'user') {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, c.req.param('id'));
  }
  return c.json({ ok: true });
});

// ---------- 静态文件（禁止直接访问私有 drafts 目录） ----------
app.use('/uploads/drafts/*', async (c) => c.json({ error: '禁止直接访问草稿图片' }, 403));
app.use('/uploads/*', serveStatic({ root: path.relative(process.cwd(), path.resolve(UPLOAD_DIR, '..')) || '.' }));
const WEB_DIST = path.resolve(import.meta.dirname, '../../web/dist');
if (fs.existsSync(WEB_DIST)) {
  const root = path.relative(process.cwd(), WEB_DIST);
  app.use('/*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

// 定时清理过期草稿与过期会话
setInterval(() => {
  const t = now();
  const old = db.prepare('SELECT id, photo FROM drafts WHERE created_at < ?').all(t - 86400_000) as { id: string; photo: string }[];
  for (const d of old) {
    fs.rmSync(path.join(UPLOAD_DIR, d.photo), { force: true });
    db.prepare('DELETE FROM drafts WHERE id = ?').run(d.id);
  }
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(t);
}, 3600_000).unref();

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`顺路服务已启动：http://localhost:${port}  AI ${AI_MOCK ? '模拟模式' : '已接入通义千问'}  地图 ${process.env.TMAP_KEY ? '已配置' : '未配置 Key'}`);
});
