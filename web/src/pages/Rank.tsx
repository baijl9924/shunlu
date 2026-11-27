import { Building2, ChevronRight, Users } from 'lucide-react';
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

  return (
    <div className="min-h-full bg-surface pb-10">
      <header className="safe-top sticky top-0 z-10 border-b border-slate-200/70 bg-white/95 px-4 pb-3 pt-3 backdrop-blur-md">
        <h1 className="text-[20px] font-bold tracking-tight text-slate-900">排行榜</h1>
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'users'}
            onClick={() => setTab('users')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[14px] font-medium transition ${
              tab === 'users' ? 'bg-white text-brand shadow-xs' : 'text-slate-500'
            }`}
          >
            <Users className="h-4 w-4" />
            体检官
          </button>
          <button
            role="tab"
            aria-selected={tab === 'cities'}
            onClick={() => setTab('cities')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[14px] font-medium transition ${
              tab === 'cities' ? 'bg-white text-brand shadow-xs' : 'text-slate-500'
            }`}
          >
            <Building2 className="h-4 w-4" />
            城市
          </button>
        </div>
      </header>

      <div className="p-4">
        {tab === 'users' && (
          <>
            {data && data.cities.length > 0 && (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand"
                aria-label="按城市筛选"
              >
                <option value="">全国排行</option>
                {data.cities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>
            )}
            <ol className="space-y-2">
              {data?.users.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-xs">
                  <RankNum idx={i} />
                  <span className="flex-1 truncate text-[15px] font-semibold text-slate-900">{u.nickname}</span>
                  <span className="text-[12px] text-slate-500">{u.issues} 处标记</span>
                  <span className="w-16 text-right text-[15px] font-bold text-brand">{u.points} 分</span>
                </li>
              ))}
              {data && data.users.length === 0 && <p className="py-16 text-center text-[14px] text-slate-400">还没有人上榜，去随手拍下第一条吧</p>}
            </ol>
          </>
        )}

        {tab === 'cities' && (
          <ol className="space-y-2">
            {data?.cities.map((c, i) => (
              <li key={c.city}>
                <Link to={`/report?city=${encodeURIComponent(c.city)}`} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-xs active:bg-slate-50">
                  <RankNum idx={i} />
                  <span className="flex-1 text-[15px] font-semibold text-slate-900">{c.city}</span>
                  <span className="text-[12px] text-slate-500">
                    {c.issues} 问题 · {c.fixed} 已改 · {c.users} 人
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
            {data && data.cities.length === 0 && <p className="py-16 text-center text-[14px] text-slate-400">暂无城市数据</p>}
          </ol>
        )}
      </div>
    </div>
  );
}

function RankNum({ idx }: { idx: number }) {
  const cls =
    idx === 0
      ? 'bg-amber-100 text-amber-700'
      : idx === 1
        ? 'bg-slate-200 text-slate-700'
        : idx === 2
          ? 'bg-orange-100 text-orange-700'
          : 'bg-slate-50 text-slate-400';
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${cls}`}>{idx + 1}</span>;
}
