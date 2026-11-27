// 接口冒烟测试：npm run smoke -w server（需先启动服务）
import sharp from 'sharp';

const BASE = process.env.BASE || 'http://localhost:8787';
let token = '';

async function call(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (token) headers['x-user-token'] = token;
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(BASE + path, { ...init, headers, body });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const img = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#c9b27c' } }).jpeg().toBuffer();
const form = (fields: Record<string, string | Blob>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

console.log('config', await call('/api/config'));
const u = await call('/api/users', { method: 'POST', json: { nickname: '测试体检官' } });
token = u.token;
const a = await call('/api/analyze', { method: 'POST', body: form({ image: new Blob([img], { type: 'image/jpeg' }) }) });
console.log('analyze', a);
const created = await call('/api/issues', {
  method: 'POST',
  body: form({ draftId: a.draftId, lat: '39.9087', lng: '116.3975', address: '北京市东城区测试路 1 号', city: '北京市', district: '东城区' }),
});
console.log('created', created);
const detail = await call(`/api/issues/${created.id}`);
console.log('detail.reportText\n' + detail.reportText);

// 另一个用户确认 + 反映
const u2 = await call('/api/users', { method: 'POST', json: { nickname: '路人乙' } });
token = u2.token;
await call(`/api/issues/${created.id}/confirm`, { method: 'POST' });
await call(`/api/issues/${created.id}/updates`, { method: 'POST', body: form({ type: 'reported' }) });
await call(`/api/issues/${created.id}/updates`, { method: 'POST', body: form({ type: 'fixed', photo: new Blob([img], { type: 'image/jpeg' }) }) });
token = u.token;
const me = await call('/api/me');
console.log('me', me.stats, me.level, me.badges.filter((b: any) => b.got).map((b: any) => b.name));
console.log('leaderboard', await call('/api/leaderboard'));
const report = await call('/api/report?city=' + encodeURIComponent('北京市'));
console.log('report', report.total, report.summary);
console.log('✅ 冒烟测试通过');
