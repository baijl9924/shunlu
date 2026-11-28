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

// 8. 游客分层权限全链路测试
token = '';
const guest = await ok('/api/auth/guest', { method: 'POST' });
assert.equal(guest.isGuest, true, '游客创建必须标记 isGuest = true');
token = guest.token;
const guestAgain = await ok('/api/auth/guest', { method: 'POST' });
assert.equal(guestAgain.id, guest.id, '携带已有 token 再次请求游客登录应幂等复用');

// 8.1 示例图试玩：可识别 + 预览 12345 文本，但禁止写入公共地图
const demoRes = await ok('/api/analyze', {
  method: 'POST',
  body: form({ image: new Blob([img], { type: 'image/jpeg' }), demo: '1' }),
});
assert.equal(demoRes.isDemo, true, '示例图草稿应返回 isDemo = true');
const previewRes = await ok(`/api/drafts/${demoRes.draftId}/preview-report`, {
  method: 'POST',
  json: { title: '示例盲道被占', address: '示例路段' },
});
assert.ok(previewRes.reportText.includes('【姓名】'), '示例图应能正常预览生成 12345 反映文本');
const demoPublish = await rawCall('/api/issues', {
  method: 'POST',
  body: form({ draftId: demoRes.draftId, lat: '39.9087', lng: '116.3975', address: '示例路段', city: '北京市', district: '东城区' }),
});
assert.equal(demoPublish.status, 400, '示例图试玩草稿不得写入公共地图');

// 8.2 游客每日限发 3 条真实标记，第 4 条触发 429；且游客不计入排行榜
const guestIssueIds: string[] = [];
for (let i = 0; i < 3; i++) {
  const ga = await ok('/api/analyze', { method: 'POST', body: form({ image: new Blob([img], { type: 'image/jpeg' }) }) });
  const gi = await ok('/api/issues', {
    method: 'POST',
    body: form({ draftId: ga.draftId, lat: '39.9087', lng: '116.3975', address: `访客测试路 ${i + 1} 号`, city: '北京市', district: '东城区' }),
  });
  guestIssueIds.push(gi.id);
}
const ga4 = await ok('/api/analyze', { method: 'POST', body: form({ image: new Blob([img], { type: 'image/jpeg' }) }) });
const gi4 = await rawCall('/api/issues', {
  method: 'POST',
  body: form({ draftId: ga4.draftId, lat: '39.9087', lng: '116.3975', address: '访客测试路 4 号', city: '北京市', district: '东城区' }),
});
assert.equal(gi4.status, 429, '访客每日最多只能发布 3 条真实标记');

// 8.3 访客每小时最多 5 次 AI 识别（上面已用 1 次 demo + 4 次真实 = 5 次），第 6 次必须 429
const ga6 = await rawCall('/api/analyze', { method: 'POST', body: form({ image: new Blob([img], { type: 'image/jpeg' }) }) });
assert.equal(ga6.status, 429, '访客每小时最多只能体验 5 次 AI 识别');

// 8.4 访客不计入体检官排行榜
const lbBefore = await ok('/api/leaderboard');
assert.equal(
  lbBefore.users.some((u: any) => u.id === guest.id),
  false,
  '访客不得出现在体检官排行榜中',
);

// 8.5 访客可点「我也遇到」与提交复查，但不计入「2 人自动结案」权重
token = uA.token;
const a2 = await ok('/api/analyze', { method: 'POST', body: form({ image: new Blob([img], { type: 'image/jpeg' }) }) });
const targetIssue = await ok('/api/issues', {
  method: 'POST',
  body: form({ draftId: a2.draftId, lat: '39.9087', lng: '116.3975', address: '北京市东城区复查测试路', city: '北京市', district: '东城区' }),
});
token = uB.token;
await ok(`/api/issues/${targetIssue.id}/updates`, {
  method: 'POST',
  body: form({ type: 'fixed', photo: new Blob([img], { type: 'image/jpeg' }) }),
});
token = guest.token;
await ok(`/api/issues/${targetIssue.id}/confirm`, { method: 'POST' });
const guestFixed = await ok(`/api/issues/${targetIssue.id}/updates`, {
  method: 'POST',
  body: form({ type: 'fixed', photo: new Blob([img], { type: 'image/jpeg' }) }),
});
assert.notEqual(guestFixed.status, 'fixed', '访客复查不得触发自动结案变为 fixed');

// 8.6 访客一键转正：继承全部积分与标记并立即上榜
const upgradedName = `GuestUp_${tag}`;
const up = await ok('/api/auth/upgrade', { method: 'POST', json: { nickname: upgradedName, password: 'pass1234' } });
assert.equal(up.isGuest, false, '转正后应为正式账号');
const lbAfter = await ok('/api/leaderboard');
assert.equal(
  lbAfter.users.some((u: any) => u.id === guest.id && u.nickname === upgradedName),
  true,
  '访客转正后应继承积分并出现在排行榜中',
);

// 清理测试创建的记录
token = guest.token;
for (const gid of guestIssueIds) await ok(`/api/issues/${gid}`, { method: 'DELETE' });
token = uA.token;
await ok(`/api/issues/${targetIssue.id}`, { method: 'DELETE' });

console.log('✅ 权限控制、重名拦截、私有草稿隔离、二次整改确认与游客分层权限全链路测试全部通过！');
