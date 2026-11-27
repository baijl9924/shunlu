import { Camera, ChevronRight, List, LocateFixed, Map as MapIcon, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CategoryIcon from '../components/CategoryIcon';
import IssueCard, { StatusBadge } from '../components/IssueCard';
import MapView from '../components/MapView';
import { api, assetUrl, STATUS_COLOR, STATUS_TEXT, type Issue } from '../lib/api';
import { DEFAULT_CENTER, distanceMeters } from '../lib/geo';
import { useApp } from '../lib/store';

type Stats = { issues: number; fixed: number; confirmations: number; cities: number; users: number };

export default function Home() {
  const { config, userGeo, refreshGeo, toast } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'nearest'>('latest');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState(() => {
    const s = sessionStorage.getItem('shunlu.center');
    return s ? (JSON.parse(s) as { lat: number; lng: number }) : DEFAULT_CENTER;
  });

  useEffect(() => {
    api<Issue[]>('/api/issues').then(setIssues).catch((e) => toast(e.message));
    api<Stats>('/api/stats').then(setStats).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userGeo) setCenter({ lat: userGeo.lat, lng: userGeo.lng });
  }, [userGeo?.lat, userGeo?.lng]);

  useEffect(() => {
    if (!selectedId) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      setSelectedId(null);
    };
    window.addEventListener('shunlu:back', onBack);
    return () => window.removeEventListener('shunlu:back', onBack);
  }, [selectedId]);

  async function locateMe() {
    const g = await refreshGeo(false);
    if (g) setCenter({ lat: g.lat, lng: g.lng });
  }

  const shown = useMemo(() => {
    const filtered = category ? issues.filter((i) => i.category === category) : issues;
    if (sortBy === 'nearest' && userGeo) {
      return [...filtered].sort((a, b) => distanceMeters(userGeo, a) - distanceMeters(userGeo, b));
    }
    return filtered;
  }, [issues, category, sortBy, userGeo]);
  const selected = useMemo(() => shown.find((i) => i.id === selectedId) || null, [shown, selectedId]);
  const hasMap = !!config?.tmapKey;
  const effectiveView = hasMap ? view : 'list';
  const me = userGeo ? { lat: userGeo.lat, lng: userGeo.lng } : null;

  if (effectiveView === 'map' && config) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <MapView
          className="h-full w-full"
          tmapKey={config.tmapKey}
          center={center}
          issues={shown}
          me={me}
          onSelect={(id) => setSelectedId(id)}
        />

        {/* 悬浮顶栏与筛选胶囊 */}
        <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 px-3.5 [--st-pad:0.625rem]">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-white/92 px-3 py-2 shadow-[0_6px_24px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5 backdrop-blur-md">
            <img src="/logo.svg" width={28} height={28} alt="" className="rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold tracking-tight text-slate-900">顺路</span>
                {userGeo?.city && (
                  <span className="truncate rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                    {userGeo.city}
                  </span>
                )}
              </div>
              {stats && (
                <p className="truncate text-[11px] text-slate-500">
                  {stats.issues} 处记录 · {stats.fixed} 处已整改
                </p>
              )}
            </div>
            <div className="relative grid grid-cols-2 rounded-xl bg-slate-100 p-0.5 text-[12px]" role="tablist" aria-label="视图切换">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-lg bg-white shadow-xs transition-transform duration-200 ease-out"
                style={{ transform: view === 'map' ? 'translateX(0%)' : 'translateX(100%)' }}
              />
              <button
                role="tab"
                aria-selected={view === 'map'}
                onClick={() => setView('map')}
                className={`relative z-10 flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-200 ${view === 'map' ? 'text-brand' : 'text-slate-500'}`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                地图
              </button>
              <button
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => setView('list')}
                className={`relative z-10 flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-200 ${view === 'list' ? 'text-brand' : 'text-slate-500'}`}
              >
                <List className="h-3.5 w-3.5" />
                列表
              </button>
            </div>
          </div>

          <div className="no-scrollbar pointer-events-auto mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="按类型筛选">
            <Chip active={!category} onClick={() => setCategory('')} floating>
              全部
            </Chip>
            {(config.categories || []).map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)} floating>
                <CategoryIcon category={c} className="h-3.5 w-3.5" />
                {c}
              </Chip>
            ))}
          </div>
        </div>

        {/* 底部定位按钮与图例（未选中点位时显示） */}
        {!selected && (
          <>
            <div
              className="absolute bottom-5 left-3.5 z-10 flex items-center gap-3 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md ring-1 ring-slate-900/5 backdrop-blur-md"
              aria-label="状态图例"
            >
              {Object.entries(STATUS_TEXT).map(([k, t]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[k as Issue['status']] }} />
                  {t}
                </span>
              ))}
            </div>
            <button
              onClick={locateMe}
              className="absolute bottom-4 right-3.5 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-900/5 backdrop-blur-md transition active:scale-95"
              aria-label="定位到当前位置"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </>
        )}

        {/* 选中地图点位后的底部预览卡片 */}
        {selected && (
          <div className="sheet-up absolute inset-x-3.5 bottom-4 z-20 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-900/5">
            <button
              onClick={() => setSelectedId(null)}
              className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-500"
              aria-label="关闭预览"
            >
              <X className="h-4 w-4" />
            </button>
            <Link to={`/issue/${selected.id}`} className="flex gap-3 pr-7">
              <img src={assetUrl(selected.photo)} alt={selected.title} className="h-20 w-20 shrink-0 rounded-xl bg-slate-100 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={selected.status} />
                  <span className="truncate text-[11px] text-slate-500">{selected.category}</span>
                </div>
                <h3 className="mt-1 truncate text-[15px] font-semibold text-slate-900">{selected.title}</h3>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{selected.address || `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`}</span>
                </p>
                <span className="mt-1 inline-flex items-center text-[12px] font-medium text-brand">
                  查看详情与反映文本
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="safe-top sticky top-0 z-10 border-b border-slate-200/70 bg-white/95 px-4 pb-2.5 backdrop-blur-md [--st-pad:0.75rem]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" width={30} height={30} alt="" className="rounded-lg" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-[17px] font-bold tracking-tight text-slate-900">顺路</h1>
                {userGeo?.city && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">{userGeo.city}</span>}
              </div>
              {stats && (
                <p className="text-[11px] text-slate-500">
                  {stats.issues} 处记录 · {stats.fixed} 处已整改
                </p>
              )}
            </div>
          </div>
          {hasMap && (
            <div className="relative grid grid-cols-2 rounded-xl bg-slate-100 p-0.5 text-[12px]" role="tablist">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-lg bg-white shadow-xs transition-transform duration-200 ease-out"
                style={{ transform: view === 'map' ? 'translateX(0%)' : 'translateX(100%)' }}
              />
              <button
                role="tab"
                aria-selected={view === 'map'}
                onClick={() => setView('map')}
                className={`relative z-10 flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-200 ${view === 'map' ? 'text-brand' : 'text-slate-500'}`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                地图
              </button>
              <button
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => setView('list')}
                className={`relative z-10 flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-200 ${view === 'list' ? 'text-brand' : 'text-slate-500'}`}
              >
                <List className="h-3.5 w-3.5" />
                列表
              </button>
            </div>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5" aria-label="按类型筛选">
          <Chip active={!category} onClick={() => setCategory('')}>
            全部
          </Chip>
          {(config?.categories || []).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              <CategoryIcon category={c} className="h-3.5 w-3.5" />
              {c}
            </Chip>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-2.5 p-4">
        {shown.length > 0 && (
          <div className="flex items-center justify-between px-0.5 text-[12px]">
            <span className="text-slate-500">共 {shown.length} 处记录</span>
            <div className="inline-flex rounded-full bg-slate-200/70 p-0.5 font-medium">
              <button
                onClick={() => setSortBy('latest')}
                className={`rounded-full px-2.5 py-1 transition ${sortBy === 'latest' ? 'bg-white text-brand shadow-2xs' : 'text-slate-500'}`}
              >
                最新发布
              </button>
              <button
                onClick={async () => {
                  if (!userGeo) await locateMe();
                  setSortBy('nearest');
                }}
                className={`rounded-full px-2.5 py-1 transition ${sortBy === 'nearest' ? 'bg-white text-brand shadow-2xs' : 'text-slate-500'}`}
              >
                离我最近
              </button>
            </div>
          </div>
        )}
        {shown.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
              <MapPin className="h-7 w-7" />
            </div>
            <p className="mt-4 text-[16px] font-semibold text-slate-800">附近还没有路障记录</p>
            <p className="mt-1 text-[13px] text-slate-500">路过盲道被占或坡道破损时，顺手拍一张</p>
            <Link to="/capture" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-brand/25">
              <Camera className="h-4 w-4" />
              拍下第一条
            </Link>
          </div>
        )}
        {shown.map((i) => (
          <IssueCard key={i.id} issue={i} />
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, floating, children }: { active: boolean; onClick: () => void; floating?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 active:scale-95 ${
        active
          ? 'bg-brand text-white shadow-sm'
          : floating
            ? 'bg-white/92 text-slate-700 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-md'
            : 'border border-slate-200 bg-white text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
