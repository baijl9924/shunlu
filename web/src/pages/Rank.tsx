import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp } from '../lib/store';

type Data = {
  users: { id: string; nickname: string; points: number; issues: number }[];
  cities: { city: string; issues: number; fixed: number; users: number }[];
};

export default function Rank() {
  const { toast } = useApp();
  const [tab, setTab] = useState<'users' | 'cities'>('users');
  const [city, setCity] = useState('');
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    api<Data>(`/api/leaderboard${city ? `?city=${encodeURIComponent(city)}` : ''}`)
      .then(setData)
      .catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const medal = (i: number) => (i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1));

  return (
    <div className="p-4">
      <h1 className="mb-3 text-[22px] font-bold">排行榜</h1>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {(['users', 'cities'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg py-2.5 text-[15px] ${tab === t ? 'bg-brand font-semibold text-white' : 'text-gray-600'}`}>
            {t === 'users' ? '体检官' : '城市'}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <>
          {data && data.cities.length > 0 && (
            <select value={city} onChange={(e) => setCity(e.target.value)} className="mb-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5" aria-label="选择城市">
              <option value="">全国</option>
              {data.cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          )}
          <ol className="space-y-2">
            {data?.users.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <span className="w-8 text-center text-[20px] font-bold text-gray-400">{medal(i)}</span>
                <span className="flex-1 truncate text-[16px] font-medium">{u.nickname}</span>
                <span className="text-[13px] text-gray-500">{u.issues} 个标记</span>
                <span className="w-16 text-right font-bold text-brand">{u.points}分</span>
              </li>
            ))}
            {data && data.users.length === 0 && <p className="py-10 text-center text-gray-400">还没有人上榜，快去随手拍吧</p>}
          </ol>
        </>
      )}

      {tab === 'cities' && (
        <ol className="space-y-2">
          {data?.cities.map((c, i) => (
            <li key={c.city}>
              <Link to={`/report?city=${encodeURIComponent(c.city)}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <span className="w-8 text-center text-[20px] font-bold text-gray-400">{medal(i)}</span>
                <span className="flex-1 text-[16px] font-medium">{c.city}</span>
                <span className="text-[13px] text-gray-500">
                  {c.issues} 问题 · {c.fixed} 已整改 · {c.users} 人参与
                </span>
                <span className="text-gray-300">›</span>
              </Link>
            </li>
          ))}
          {data && data.cities.length === 0 && <p className="py-10 text-center text-gray-400">暂无城市数据</p>}
        </ol>
      )}
    </div>
  );
}
