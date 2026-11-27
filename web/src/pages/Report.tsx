import { BarChart3, Camera, ChevronDown, ChevronRight, FileText, Globe, ImageDown, Lightbulb, LocateFixed, MapPin, Printer, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CategoryIcon from '../components/CategoryIcon';
import { StatusBadge } from '../components/IssueCard';
import ReportPoster from '../components/ReportPoster';
import SpeakButton from '../components/SpeakButton';
import { api, assetUrl, type Issue } from '../lib/api';
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

function calcHealth(t: ReportData['total']) {
  const n = Math.max(1, t.n);
  const fixed = t.fixed || 0;
  const reported = t.reported || 0;
  const severe = t.severe || 0;
  const raw = 68 + Math.round((fixed / n) * 28) + Math.round((reported / n) * 8) - Math.round((severe / n) * 22);
  const score = Math.max(45, Math.min(98, raw));
  if (score >= 85) return { score, grade: 'A 优良', color: '#10b981', pill: 'bg-emerald-50 text-emerald-700' };
  if (score >= 72) return { score, grade: 'B+ 良好', color: '#1677ff', pill: 'bg-brand-soft text-brand' };
  if (score >= 60) return { score, grade: 'B 待提升', color: '#f59e0b', pill: 'bg-amber-50 text-amber-700' };
  return { score, grade: 'C 需关注', color: '#ef4444', pill: 'bg-red-50 text-red-600' };
}

function parseSummary(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const overviewParts: string[] = [];
  const suggestions: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[1-9][.、)\s]+(.+)$/);
    if (m) suggestions.push(m[1].trim());
    else if (suggestions.length > 0) suggestions[suggestions.length - 1] += line;
    else overviewParts.push(line);
  }
  return { overview: overviewParts.join(' '), suggestions };
}

export default function Report() {
  const { userGeo, refreshGeo } = useApp();
  const [params, setParams] = useSearchParams();
  const explicitAll = params.get('scope') === 'all';
  const paramCity = params.get('city') || '';
  const district = params.get('district') || '';

  const activeCity = explicitAll ? '' : paramCity || userGeo?.city || '';

  const [data, setData] = useState<ReportData | null>(null);
  const [dataCities, setDataCities] = useState<{ city: string; issues: number }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ cities: { city: string; issues: number }[] }>('/api/leaderboard')
      .then((d) => setDataCities(d.cities))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    const q = new URLSearchParams();
    if (activeCity) q.set('city', activeCity);
    if (district) q.set('district', district);
    api<ReportData>(`/api/report?${q}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
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
  const health = data && data.total.n > 0 ? calcHealth(data.total) : null;
  const parsed = useMemo(() => (data?.summary ? parseSummary(data.summary) : { overview: '', suggestions: [] }), [data?.summary]);
  const titleText = `${activeCity ? `${activeCity}${district}` : '全国'}无障碍体检报告`;

  const pendingCount = data ? Math.max(0, data.total.n - (data.total.reported || 0) - (data.total.fixed || 0)) : 0;

  return (
    <div className="min-h-full bg-surface pb-12">
      <header className="no-print safe-top sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200/70 bg-white/95 px-4 pb-2.5 backdrop-blur-md [--st-pad:0.625rem]">
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[14px] font-semibold text-slate-800 transition active:scale-95 active:bg-slate-100"
        >
          {activeCity ? <MapPin className="h-4 w-4 shrink-0 text-brand" /> : <Globe className="h-4 w-4 shrink-0 text-brand" />}
          <span className="truncate">{activeCity || '全国汇总'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {activeCity && (
          <button
            onClick={() => selectCity('')}
            className="shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-slate-500 transition active:bg-slate-100"
          >
            看全国
          </button>
        )}

        {data && data.total.n > 0 && (
          <button
            onClick={() => setPosterOpen(true)}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-xs transition active:scale-95 active:bg-brand-dark"
          >
            <ImageDown className="h-3.5 w-3.5" />
            分享长图
          </button>
        )}
      </header>

      {/* 顶部横幅 */}
      <div className="bg-gradient-to-br from-brand to-brand-dark px-5 pb-14 pt-6 text-white">
        <p className="text-[12px] font-medium text-white/75">无障碍环境城市体检</p>
        <h1 className="mt-1 text-[23px] font-bold tracking-tight">{titleText}</h1>
        <p className="mt-1 text-[12px] text-white/70">更新于 {data ? new Date(data.generatedAt).toLocaleString('zh-CN') : '…'}</p>

        {/* 区县快捷切换 */}
        {activeCity && data && data.byDistrict.length > 0 && (
          <div className="no-print no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setParams({ city: activeCity })}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition active:scale-95 ${!district ? 'bg-white text-brand shadow-xs' : 'bg-white/15 text-white'}`}
            >
              全市
            </button>
            {data.byDistrict.map((d) => (
              <button
                key={d.district}
                onClick={() => setParams({ city: activeCity, district: d.district })}
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition active:scale-95 ${district === d.district ? 'bg-white text-brand shadow-xs' : 'bg-white/15 text-white'}`}
              >
                {d.district} ({d.n})
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="p-6 text-[14px] text-red-600">{error}</p>}
      {!data && !error && <p className="p-12 text-center text-[14px] text-slate-400">正在汇总体检数据…</p>}

      {data && data.total.n === 0 && (
        <div className="-mt-8 mx-4 rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MapPin className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[16px] font-semibold text-slate-900">{activeCity ? `${activeCity}${district}暂时还没有记录` : '暂时还没有记录'}</p>
          <p className="mt-1 text-[13px] text-slate-500">拍下身边的第一处无障碍问题，即可点亮本城体检报告</p>
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

      {data && data.total.n > 0 && health && (
        <div className="-mt-9 space-y-3.5 px-4">
          {/* 城市无障碍健康度环形评分卡 */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <HealthRing score={health.score} color={health.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-slate-900">无障碍健康度</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${health.pill}`}>{health.grade}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">综合整改率、反映进展与安全隐患占比评估</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniStat n={data.total.n} label="已记录" />
                  <MiniStat n={`${rate(data.total.fixed || 0, data.total.n)}%`} label="整改率" good />
                  <MiniStat n={data.total.severe || 0} label="高危隐患" danger />
                </div>
              </div>
            </div>

            {/* 状态分布比例条 */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                {pendingCount > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(pendingCount / data.total.n) * 100}%` }} />}
                {(data.total.reported || 0) > 0 && (
                  <div className="bg-amber-400 transition-all" style={{ width: `${((data.total.reported || 0) / data.total.n) * 100}%` }} />
                )}
                {(data.total.fixed || 0) > 0 && (
                  <div className="bg-emerald-500 transition-all" style={{ width: `${((data.total.fixed || 0) / data.total.n) * 100}%` }} />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-red-400" /> 待反映 {pendingCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-amber-400" /> 已反映 {data.total.reported || 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-emerald-500" /> 已整改 {data.total.fixed || 0}
                </span>
                <span className="text-slate-400">{data.total.users} 人参与</span>
              </div>
            </div>
          </section>

          {/* 现状摘要 */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-brand" />
                现状摘要
              </h2>
              <SpeakButton
                label="听报告"
                text={`${titleText}。当前无障碍健康度 ${health.score} 分，评级 ${health.grade}，共记录 ${data.total.n} 处问题，已整改 ${data.total.fixed || 0} 处。${data.summary}`}
              />
            </div>
            <p className="rounded-xl bg-brand-soft/65 p-3.5 text-[14px] leading-relaxed text-slate-700">{parsed.overview || data.summary}</p>
          </section>

          {/* 结构化可落地建议卡片 */}
          {parsed.suggestions.length > 0 && (
            <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
              <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                优先整改建议
              </h2>
              <ol className="space-y-2.5">
                {parsed.suggestions.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 rounded-xl bg-slate-50/90 p-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-soft text-[12px] font-bold text-brand">
                      0{idx + 1}
                    </span>
                    <p className="text-[13.5px] leading-relaxed text-slate-700">{item}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 问题类型分布 */}
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
                    <span className="block h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(c.n / max) * 100}%` }} />
                  </span>
                  <span className="w-7 text-right font-semibold text-slate-800">{c.n}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 各区县情况 */}
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
                        <button className="font-medium text-brand" onClick={() => setParams(activeCity ? { city: activeCity, district: d.district } : { scope: 'all', district: d.district })}>
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

          {/* 关注度最高的实拍点位 */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <h2 className="mb-3 text-[15px] font-semibold text-slate-900">市民最关注的问题</h2>
            <ol className="space-y-2.5">
              {data.top.map((i) => (
                <li key={i.id}>
                  <Link to={`/issue/${i.id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 transition active:scale-[0.99] active:bg-slate-100">
                    <img src={assetUrl(i.photo)} alt={i.title} className="h-14 w-14 shrink-0 rounded-lg bg-slate-200 object-cover" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <StatusBadge status={i.status} />
                        <b className="truncate text-[14px] text-slate-900">{i.title}</b>
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-slate-500">{i.address}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{i.confirmCount} 人确认遇到</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* 底部双操作按钮：保存长图 + 导出 PDF */}
          <div className="no-print grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => setPosterOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-[14px] font-semibold text-white shadow-xs transition active:scale-[0.98]"
            >
              <ImageDown className="h-4 w-4" />
              保存长图分享
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-3 text-[14px] font-semibold text-slate-700 transition active:scale-[0.98]"
            >
              <Printer className="h-4 w-4" />
              导出 PDF
            </button>
          </div>

          <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400">
            本报告基于市民通过「顺路」自愿提交的随手拍数据汇总生成，仅供参考。
          </p>
        </div>
      )}

      {/* 城市选择弹窗 */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center" onClick={() => setPickerOpen(false)}>
          <div className="sheet-up safe-bottom flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white px-5 pt-5 [--sb-pad:1.25rem] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
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
                    className={`rounded-xl border px-2.5 py-2 text-center text-[13px] transition active:scale-95 ${
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

      {posterOpen && data && health && (
        <ReportPoster
          title={titleText}
          score={health.score}
          grade={health.grade}
          gradeColor={health.color}
          total={data.total}
          byCategory={data.byCategory}
          overview={parsed.overview || data.summary}
          suggestions={parsed.suggestions}
          onClose={() => setPosterOpen(false)}
        />
      )}
    </div>
  );
}

function HealthRing({ score, color }: { score: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative grid h-[88px] w-[88px] shrink-0 place-items-center">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7.5" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <span className="block text-[22px] font-bold leading-none text-slate-900">{score}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">健康分</span>
      </div>
    </div>
  );
}

function MiniStat({ n, label, good, danger }: { n: number | string; label: string; good?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 py-1.5">
      <p className={`text-[16px] font-bold leading-tight ${good ? 'text-emerald-600' : danger && Number(n) > 0 ? 'text-red-500' : 'text-slate-900'}`}>{n}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
