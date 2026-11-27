import { useEffect, useState } from 'react';
import { api, assetUrl, STATUS_TEXT, type Issue } from '../lib/api';

type AdminUser = { id: string; nickname: string; role: 'user' | 'admin'; hasPassword: number; createdAt: number; issues: number };

export default function Admin() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('shunlu.admin'));
  const [tab, setTab] = useState<'issues' | 'users'>('issues');
  const [pwd, setPwd] = useState('');
  const [list, setList] = useState<Issue[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [err, setErr] = useState('');

  const load = () => {
    api<Issue[]>('/api/admin/issues')
      .then(setList)
      .catch((e) => {
        setErr(e.message);
        if (e.message === '无权限') (sessionStorage.removeItem('shunlu.admin'), setAuthed(false));
      });
    api<AdminUser[]>('/api/admin/users').then(setUsers).catch(() => {});
  };
  useEffect(() => {
    if (authed) load();
  }, [authed]);

  async function patchIssue(id: string, body: object) {
    await api(`/api/admin/issues/${id}`, { method: 'PATCH', json: body });
    load();
  }

  async function toggleRole(u: AdminUser) {
    await api(`/api/admin/users/${u.id}`, { method: 'PATCH', json: { role: u.role === 'admin' ? 'user' : 'admin' } });
    load();
  }

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('shunlu.admin');
    setAuthed(false);
  }

  if (!authed)
    return (
      <form
        className="mx-auto mt-24 max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          try {
            const r = await api<{ token: string }>('/api/admin/login', { method: 'POST', json: { password: pwd } });
            sessionStorage.setItem('shunlu.admin', r.token);
            setAuthed(true);
            setPwd('');
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <h1 className="text-xl font-bold text-slate-900">顺路 · 管理后台</h1>
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="管理密码" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand" />
        <button className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white">登录</button>
        {err && <p className="text-[13px] text-red-600">{err}</p>}
      </form>
    );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">顺路 · 管理后台</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('issues')} className={`rounded-lg px-3.5 py-1.5 text-[14px] font-medium ${tab === 'issues' ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}>
            问题管理（{list.length}）
          </button>
          <button onClick={() => setTab('users')} className={`rounded-lg px-3.5 py-1.5 text-[14px] font-medium ${tab === 'users' ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}>
            用户与权限（{users.length}）
          </button>
          <button onClick={logout} className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[14px] text-slate-600 hover:text-red-600">
            退出
          </button>
        </div>
      </div>

      {tab === 'issues' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">照片</th>
                <th>问题</th>
                <th>位置</th>
                <th>上报人</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className={`border-b align-top ${i.hidden ? 'opacity-40' : ''}`}>
                  <td className="py-2">
                    <a href={assetUrl(i.photo)} target="_blank" rel="noreferrer">
                      <img src={assetUrl(i.photo)} alt="" className="h-16 w-16 rounded object-cover" />
                    </a>
                  </td>
                  <td className="max-w-xs pr-2">
                    <a href={`/issue/${i.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand">
                      {i.title}
                    </a>
                    <p className="text-slate-500">{i.category}</p>
                  </td>
                  <td className="max-w-xs pr-2 text-slate-600">{i.address || `${i.lat.toFixed(4)},${i.lng.toFixed(4)}`}</td>
                  <td className="pr-2">{i.nickname}</td>
                  <td className="pr-2">
                    <select value={i.status} onChange={(e) => patchIssue(i.id, { status: e.target.value })} className="rounded border px-1.5 py-1">
                      {Object.entries(STATUS_TEXT).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button onClick={() => patchIssue(i.id, { hidden: !i.hidden })} className={`rounded px-3 py-1 text-white ${i.hidden ? 'bg-slate-500' : 'bg-red-600'}`}>
                      {i.hidden ? '恢复' : '下架'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">唯一昵称</th>
                <th>角色</th>
                <th>密码保护</th>
                <th>标记数</th>
                <th>注册时间</th>
                <th>权限操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="py-2.5 font-semibold text-slate-900">{u.nickname}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${u.role === 'admin' ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td>{u.hasPassword ? '已设密码' : '旧版免密'}</td>
                  <td>{u.issues}</td>
                  <td className="text-slate-500">{new Date(u.createdAt).toLocaleString('zh-CN')}</td>
                  <td>
                    <button onClick={() => toggleRole(u)} className="rounded-lg border border-slate-200 px-3 py-1 text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand">
                      {u.role === 'admin' ? '取消管理员' : '设为管理员'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
