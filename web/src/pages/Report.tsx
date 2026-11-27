import { BarChart3, Camera, ChevronDown, ChevronRight, FileText, Globe, LocateFixed, MapPin, Printer, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CategoryIcon from '../components/CategoryIcon';
import { api, type Issue } from '../lib/api';
import { useApp } from '../lib/store';

type ReportData = {
  scope: string;
  total: { n: number; fixed: number; reported: number; severe: number; users: number };
  byCategory: { category: string; n: number }[];
  byDistrict: { district: string; n: number; fixed: number }[];
  top: Issue[];
  summary: string;
  generatedAt: number;
};

const HOT_CITIES = ['北京市', '上海市', '广州市', '深圳市', '杭州市', '成都市', '武汉市', '南京市', '西安市', '重庆市', '长春市', '沈阳市'];

export default function Report() {
  const { userGeo, refreshGeo } = useApp();
  const [params, setParams] = useSearchParams();
  const explicitAll = params.get('scope') === 'all';
  const paramCity = params.get('city') || '';
  const district = params.get('district') || '';

  // 默认展示用户当前所在城市；未指定且有定位城市时自动采用定位城市
  const activeCity = explicitAll ? '' : paramCity || userGeo?.city || '';

  const [data, setData] = useState<ReportData | null>(null);
  const [dataCities, setDataCities] = useState<{ city: string; issues: number }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ cities: { city: string; issues: number }[] }>('/api/leaderboard')
      .then((d) => setDataCities(d.cities))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    setError('');
    const q = new URLSearchParams();
    if (activeCity) q.set('city', activeCity);
    if (district) q.set('district', district);
    api<ReportData>(`/api/report?${q}`).then(setData).catch((e) => setError(e.message));
  }, [activeCity, district]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      setPickerOpen(false);
    };
    window.addEventListener('shunlu:back', onBack);
    return () => window.removeEventListener('shunlu:back', onBack);
  }, [pickerOpen]);

  function selectCity(nextCity: string) {
    setPickerOpen(false);
    setQuery('');
    if (!nextCity) setParams({ scope: 'all' });
    else setParams({ city: nextCity });
  }

  const candidateCities = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of dataCities) map.set(c.city, c.issues);
    for (const c of HOT_CITIES) if (!map.has(c)) map.set(c, 0);
    if (userGeo?.city && !map.has(userGeo.city)) map.set(userGeo.city, 0);
    const list = Array.from(map.entries()).map(([city, issues]) => ({ city, issues }));
    const kw = query.trim();
    if (!kw) return list;
    return list.filter((c) => c.city.includes(kw));
  }, [dataCities, userGeo?.city, query]);

  const max = Math.max(1, ...(data?.byCategory.map((c) => c.n) || [1]));
  const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div className="min-h-full bg-surface pb-10">
      <header className="no-print safe-top sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200/70 bg-white/95 px-4 py-2.5 backdrop-blur-md">
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[14px] font-semibold text-slate-800 active:bg-slate-100"
        >
          {activeCity ? <MapPin className="h-4 w-4 shrink-0 text-brand" /> : <Globe className="h-4 w-4 shrink-0 text-brand" />}
          <span className="truncate">{activeCity || '全国汇总'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {activeCity && (
          <button
            onClick={() => selectCity('')}
            className="shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-slate-500 active:bg-slate-100"
          >
            看全国
          </button>
        )}

        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white active:bg-brand-dark"
        >
          <Printer className="h-3.5 w-3.5" />
          导出 PDF
        </button>
      </header>

      {/* 顶部摘要卡片 */}
      <div className="bg-gradient-to-br from-brand to-brand-dark px-5 py-6 text-white">
        <p className="text-[12px] font-medium text-white/75">无障碍环境城市体检</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight">
          {activeCity ? `${activeCity}${district}` : '全国'}体检报告
        </h1>
        <p className="mt-1 text-[12px] text-white/70">更新于 {data ? new Date(data.generatedAt).toLocaleString('zh-CN') : '…'}</p>

        {/* 区县快捷切换 */}
        {activeCity && data && data.byDistrict.length > 0 && (
          <div className="no-print no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setParams({ city: activeCity })}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${!district ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}
            >
              全市
            </button>
            {data.byDistrict.map((d) => (
              <button
                key={d.district}
                onClick={() => setParams({ city: activeCity, district: d.district })}
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${district === d.district ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}
              >
                {d.district} ({d.n})
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="p-6 text-[14px] text-red-600">{error}</p>}
      {!data && !error && <p className="p-12 text-center text-[14px] text-slate-400">正在汇总数据…</p>}

      {data && data.total.n === 0 && (
        <div className="m-4 rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MapPin className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[16px] font-semibold text-slate-900">{activeCity ? `${activeCity}${district}暂时还没有记录` : '暂时还没有记录'}</p>
          <p className="mt-1 text-[13px] text-slate-500">拍下身边的第一处无障碍问题，即可生成本城体检报告</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link to="/capture" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-[14px] font-semibold text-white">
              <Camera className="h-4 w-4" />
              去拍下第一条
            </Link>
            {activeCity && (
              <button
                onClick={() => selectCity('')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-medium text-slate-700"
              >
                <Globe className="h-4 w-4" />
                查看全国汇总
              </button>
            )}
          </div>
        </div>
      )}

      {data && data.total.n > 0 && (
        <div className="space-y-4 p-4">
          <section className="grid grid-cols-2 gap-2.5">
            <Kpi n={data.total.n} label="已记录问题" />
            <Kpi n={data.total.severe || 0} label="安全隐患" accent />
            <Kpi n={`${rate(data.total.fixed || 0, data.total.n)}%`} label="整改率" />
            <Kpi n={data.total.users} label="参与市民" />
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-brand" />
              体检结论与建议
            </h2>
            <p className="whitespace-pre-wrap rounded-xl bg-brand-soft/60 p-3.5 text-[14px] leading-relaxed text-slate-700">{data.summary}</p>
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
              <BarChart3 className="h-4 w-4 text-brand" />
              问题类型分布
            </h2>
            <ul className="space-y-2.5">
              {data.byCategory.map((c) => (
                <li key={c.category} className="flex items-center gap-2.5 text-[13px]">
                  <span className="flex w-32 shrink-0 items-center gap-1.5 truncate text-slate-700">
                    <CategoryIcon category={c.category} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{c.category}</span>
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${(c.n / max) * 100}%` }} />
                  </span>
                  <span className="w-7 text-right font-semibold text-slate-800">{c.n}</span>
                </li>
              ))}
            </ul>
          </section>

          {data.byDistrict.length > 0 && (
            <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
              <h2 className="mb-2.5 text-[15px] font-semibold text-slate-900">各区县情况</h2>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400">
                    <th className="py-2 font-medium">区县</th>
                    <th className="py-2 font-medium">问题数</th>
                    <th className="py-2 font-medium">已整改</th>
                    <th className="py-2 text-right font-medium">整改率</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDistrict.map((d) => (
                    <tr key={d.district} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5">
                        <button className="font-medium text-brand" onClick={() => setParams({ city: activeCity, district: d.district })}>
                          {d.district}
                        </button>
                      </td>
                      <td>{d.n}</td>
                      <td>{d.fixed}</td>
                      <td className="text-right font-medium">{rate(d.fixed, d.n)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <h2 className="mb-3 text-[15px] font-semibold text-slate-900">关注度最高的问题</h2>
            <ol className="space-y-2">
              {data.top.map((i, idx) => (
                <li key={i.id}>
                  <Link to={`/issue/${i.id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 active:bg-slate-100">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-slate-500 shadow-2xs">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] text-slate-900">{i.title}</b>
                      <span className="block truncate text-[12px] text-slate-500">{i.address}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-slate-500">{i.confirmCount} 确认</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            说明：本报告基于市民通过「顺路」自愿提交的随手拍数据汇总生成，仅供参考。
          </p>
        </div>
      )}

      {/* 城市选择弹窗 */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center" onClick={() => setPickerOpen(false)}>
          <div className="safe-bottom flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-slate-900">选择报告范围</h2>
              <button onClick={() => setPickerOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) selectCity(query.trim());
                }}
                placeholder="输入城市名（如：长春市、杭州市）"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[14px] outline-none focus:border-brand focus:bg-white"
              />
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const g = userGeo?.city ? userGeo : await refreshGeo(false);
                  if (g?.city) selectCity(g.city);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1.5 text-[13px] font-medium text-brand"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                {userGeo?.city ? `当前定位：${userGeo.city}` : '重新定位当前城市'}
              </button>
              <button
                onClick={() => selectCity('')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${!activeCity ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                <Globe className="h-3.5 w-3.5" />
                全国汇总
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {query.trim() && !candidateCities.some((c) => c.city === query.trim()) && (
                <button
                  onClick={() => selectCity(query.trim())}
                  className="mb-2 flex w-full items-center justify-between rounded-xl bg-brand-soft/60 px-3.5 py-2.5 text-[14px] font-medium text-brand"
                >
                  <span>查看「{query.trim()}」报告</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {candidateCities.map((c) => (
                  <button
                    key={c.city}
                    onClick={() => selectCity(c.city)}
                    className={`rounded-xl border px-2.5 py-2 text-center text-[13px] transition ${
                      activeCity === c.city ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-slate-200/80 bg-white text-slate-700 active:bg-slate-50'
                    }`}
                  >
                    <span className="block truncate">{c.city}</span>
                    {c.issues > 0 && <span className="text-[11px] text-slate-400">{c.issues} 条</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ n, label, accent }: { n: number | string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
      <p className={`text-[26px] font-bold tracking-tight ${accent ? 'text-red-500' : 'text-slate-900'}`}>{n}</p>
      <p className="mt-0.5 text-[12px] text-slate-500">{label}</p>
    </div>
  );
}
