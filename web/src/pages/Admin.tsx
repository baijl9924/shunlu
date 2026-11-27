import { useEffect, useState } from 'react';
import { api, assetUrl, STATUS_TEXT, type Issue } from '../lib/api';

export default function Admin() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('shunlu.admin'));
  const [pwd, setPwd] = useState('');
  const [list, setList] = useState<Issue[]>([]);
  const [err, setErr] = useState('');

  const load = () =>
    api<Issue[]>('/api/admin/issues')
      .then(setList)
      .catch((e) => {
        setErr(e.message);
        if (e.message === '无权限') (sessionStorage.removeItem('shunlu.admin'), setAuthed(false));
      });
  useEffect(() => {
    if (authed) load();
  }, [authed]);

  async function patch(id: string, body: object) {
    await api(`/api/admin/issues/${id}`, { method: 'PATCH', json: body });
    load();
  }

  if (!authed)
    return (
      <form
        className="mx-auto mt-24 max-w-sm space-y-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await api<{ token: string }>('/api/admin/login', { method: 'POST', json: { password: pwd } });
            sessionStorage.setItem('shunlu.admin', r.token);
            setAuthed(true);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <h1 className="text-xl font-bold">顺路 · 管理后台</h1>
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="管理密码" className="w-full rounded-lg border px-3 py-2.5" />
        <button className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white">登录</button>
        {err && <p className="text-red-600">{err}</p>}
      </form>
    );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-bold">管理后台（{list.length} 条）</h1>
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b text-left text-gray-500">
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
              <td className="max-w-xs">
                <a href={`/issue/${i.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand">
                  {i.title}
                </a>
                <p className="text-gray-500">{i.category}</p>
              </td>
              <td className="max-w-xs text-gray-600">{i.address || `${i.lat.toFixed(4)},${i.lng.toFixed(4)}`}</td>
              <td>{i.nickname}</td>
              <td>
                <select value={i.status} onChange={(e) => patch(i.id, { status: e.target.value })} className="rounded border px-1 py-1">
                  {Object.entries(STATUS_TEXT).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button onClick={() => patch(i.id, { hidden: !i.hidden })} className={`rounded px-3 py-1 text-white ${i.hidden ? 'bg-gray-500' : 'bg-red-600'}`}>
                  {i.hidden ? '恢复' : '下架'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
