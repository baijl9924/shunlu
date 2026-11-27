// 安全、权限与核心流程全链路测试：npm run smoke -w server（需先启动本地服务）
import assert from 'node:assert/strict';
import sharp from 'sharp';

const BASE = process.env.BASE || 'http://localhost:8787';
let token = '';

async function rawCall(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (token) headers['x-user-token'] = token;
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(BASE + path, { ...init, headers, body });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : null;
  return { status: res.status, data };
}

async function ok(path: string, init: RequestInit & { json?: unknown } = {}) {
  const r = await rawCall(path, init);
  if (r.status >= 400) throw new Error(`${path} → ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

const img = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#c9b27c' } }).jpeg().toBuffer();
const form = (fields: Record<string, string | Blob>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const tag = String(Date.now()).slice(-5);
const nameA = `Alice_${tag}`;
const nameB = `Bob_${tag}`;
const nameC = `Carol_${tag}`;

// 1. 注册 + 重名拦截（含大小写不敏感）
const uA = await ok('/api/auth/register', { method: 'POST', json: { nickname: nameA, password: 'pass1234' } });
const dup = await rawCall('/api/auth/register', { method: 'POST', json: { nickname: nameA.toLowerCase(), password: 'pass9999' } });
assert.equal(dup.status, 409, '重名注册必须返回 409');

// 2. 登录密码校验
const badLogin = await rawCall('/api/auth/login', { method: 'POST', json: { nickname: nameA, password: 'wrong' } });
assert.equal(badLogin.status, 401, '错误密码必须返回 401');
const goodLogin = await ok('/api/auth/login', { method: 'POST', json: { nickname: nameA, password: 'pass1234' } });
token = goodLogin.token;

// 3. 私有草稿隔离校验
const a = await ok('/api/analyze', { method: 'POST', body: form({ image: new Blob([img], { type: 'image/jpeg' }) }) });
const ownPhoto = await rawCall(a.photo);
assert.equal(ownPhoto.status, 200, '本人可查看私有草稿图');
const uB = await ok('/api/auth/register', { method: 'POST', json: { nickname: nameB, password: 'pass1234' } });
token = uB.token;
const otherPhoto = await rawCall(a.photo);
assert.equal(otherPhoto.status, 403, '他人不得查看私有草稿图');

// 4. 改昵称重名拦截
const dupRename = await rawCall('/api/me', { method: 'PATCH', json: { nickname: nameA } });
assert.equal(dupRename.status, 409, '改名不能冒用他人昵称');

// 5. 提交问题 + 所有权删除校验
token = uA.token;
const created = await ok('/api/issues', {
  method: 'POST',
  body: form({ draftId: a.draftId, lat: '39.9087', lng: '116.3975', address: '北京市东城区测试路 1 号', city: '北京市', district: '东城区' }),
});
token = uB.token;
const stealDel = await rawCall(`/api/issues/${created.id}`, { method: 'DELETE' });
assert.equal(stealDel.status, 403, '他人不得删除问题点');

// 6. 防恶意标已整改：第 1 位路人仅记录待二次确认，第 2 位市民确认后才变 fixed；24h 内禁止重复刷复查
const claim1 = await ok(`/api/issues/${created.id}/updates`, {
  method: 'POST',
  body: form({ type: 'fixed', photo: new Blob([img], { type: 'image/jpeg' }) }),
});
assert.notEqual(claim1.status, 'fixed', '单名非发布者不能直接把状态置为 fixed');
const spam = await rawCall(`/api/issues/${created.id}/updates`, {
  method: 'POST',
  body: form({ type: 'recheck', photo: new Blob([img], { type: 'image/jpeg' }) }),
});
assert.equal(spam.status, 429, '24h 内同一用户不能重复刷复查');

const uC = await ok('/api/auth/register', { method: 'POST', json: { nickname: nameC, password: 'pass1234' } });
token = uC.token;
const claim2 = await ok(`/api/issues/${created.id}/updates`, {
  method: 'POST',
  body: form({ type: 'fixed', photo: new Blob([img], { type: 'image/jpeg' }) }),
});
assert.equal(claim2.status, 'fixed', '满 2 位市民确认后应正式变为 fixed');

// 7. 原发布者有权删除自己的问题点
token = uA.token;
await ok(`/api/issues/${created.id}`, { method: 'DELETE' });
const gone = await rawCall(`/api/issues/${created.id}`);
assert.equal(gone.status, 404, '删除后应不可见');

console.log('✅ 权限控制、重名拦截、私有草稿隔离、二次整改确认全链路测试全部通过！');
