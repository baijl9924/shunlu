import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import IssueCard from '../components/IssueCard';
import { api, CATEGORY_ICON, STATUS_COLOR, STATUS_TEXT, type Issue } from '../lib/api';
import { DEFAULT_CENTER, locate } from '../lib/geo';
import { useApp } from '../lib/store';

type Stats = { issues: number; fixed: number; confirmations: number; cities: number; users: number };

export default function Home() {
  const { config, toast } = useApp();
  const nav = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [center, setCenter] = useState(() => {
    const s = sessionStorage.getItem('shunlu.center');
    return s ? (JSON.parse(s) as { lat: number; lng: number }) : DEFAULT_CENTER;
  });
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    api<Issue[]>('/api/issues').then(setIssues).catch((e) => toast(e.message));
    api<Stats>('/api/stats').then(setStats).catch(() => {});
    if (!sessionStorage.getItem('shunlu.center')) locateMe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locateMe(silent = false) {
    locate()
      .then((p) => {
        setMe(p);
        setCenter(p);
        sessionStorage.setItem('shunlu.center', JSON.stringify(p));
      })
      .catch((e) => !silent && toast(e.message));
  }

  const shown = useMemo(() => (category ? issues.filter((i) => i.category === category) : issues), [issues, category]);
  const hasMap = !!config?.tmapKey;
  const effectiveView = hasMap ? view : 'list';

  return (
    <div className="flex h-full flex-col">
      <header className="z-10 bg-white px-4 pb-2 pt-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" width={32} height={32} alt="" />
            <div>
              <h1 className="text-xl font-bold leading-tight text-brand">顺路</h1>
              <p className="text-[12px] text-gray-500">随手拍，让每条路都顺</p>
            </div>
          </div>
          {hasMap && (
            <div className="flex rounded-full bg-gray-100 p-1 text-[14px]" role="tablist" aria-label="显示方式">
              {(['map', 'list'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 ${view === v ? 'bg-white font-semibold text-brand shadow' : 'text-gray-500'}`}
                >
                  {v === 'map' ? '地图' : '列表'}
                </button>
              ))}
            </div>
          )}
        </div>
        {stats && (
          <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-[13px] text-brand-dark">
            已有 <b>{stats.users}</b> 位体检官标记了 <b>{stats.issues}</b> 个问题，<b>{stats.fixed}</b> 个已整改 🎉
          </p>
        )}
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 text-[14px]" aria-label="按类型筛选">
          <Chip active={!category} onClick={() => setCategory('')}>全部</Chip>
          {(config?.categories || []).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_ICON[c]} {c}
            </Chip>
          ))}
        </div>
      </header>

      {effectiveView === 'map' && config ? (
        <div className="relative flex-1">
          <MapView className="h-full w-full" tmapKey={config.tmapKey} center={center} issues={shown} me={me} onSelect={(id) => nav(`/issue/${id}`)} />
          <div className="absolute bottom-4 left-3 rounded-xl bg-white/95 px-3 py-2 text-[12px] shadow" aria-label="图例">
            {Object.entries(STATUS_TEXT).map(([k, t]) => (
              <span key={k} className="mr-2 inline-flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k as Issue['status']] }} />
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={() => locateMe()}
            className="absolute bottom-4 right-3 grid h-12 w-12 place-items-center rounded-full bg-white text-xl shadow-lg"
            aria-label="定位到我的位置"
          >
            🎯
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-3 p-4">
          {!hasMap && config && (
            <p className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">尚未配置腾讯地图 Key，暂以列表显示。</p>
          )}
          {shown.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              <p className="text-4xl">🌱</p>
              <p className="mt-2">这里还没有标记</p>
              <Link to="/capture" className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 font-semibold text-white">
                成为第一个体检官
              </Link>
            </div>
          )}
          {shown.map((i) => (
            <IssueCard key={i.id} issue={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 ${active ? 'border-brand bg-brand text-white' : 'border-gray-200 bg-white text-gray-700'}`}
    >
      {children}
    </button>
  );
}
