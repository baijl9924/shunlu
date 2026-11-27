import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, CATEGORY_ICON, type Issue } from '../lib/api';

type ReportData = {
  scope: string;
  total: { n: number; fixed: number; reported: number; severe: number; users: number };
  byCategory: { category: string; n: number }[];
  byDistrict: { district: string; n: number; fixed: number }[];
  top: Issue[];
  summary: string;
  generatedAt: number;
};

export default function Report() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const city = params.get('city') || '';
  const district = params.get('district') || '';
  const [data, setData] = useState<ReportData | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ cities: { city: string }[] }>('/api/leaderboard').then((d) => setCities(d.cities.map((c) => c.city))).catch(() => {});
  }, []);
  useEffect(() => {
    setData(null);
    const q = new URLSearchParams();
    if (city) q.set('city', city);
    if (district) q.set('district', district);
    api<ReportData>(`/api/report?${q}`).then(setData).catch((e) => setError(e.message));
  }, [city, district]);

  const max = Math.max(1, ...(data?.byCategory.map((c) => c.n) || [1]));
  const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div className="mx-auto min-h-full max-w-3xl bg-white pb-10">
      <header className="no-print sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-2 py-2">
        <button onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))} className="grid h-11 w-11 place-items-center text-2xl" aria-label="返回">
          ‹
        </button>
        <select
          value={city}
          onChange={(e) => setParams(e.target.value ? { city: e.target.value } : {})}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          aria-label="选择城市"
        >
          <option value="">全国</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => window.print()} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">
          导出 PDF
        </button>
      </header>

      <div className="bg-gradient-to-br from-brand to-brand-dark px-6 py-8 text-white">
        <p className="text-[14px] opacity-80">顺路 · 市民随手拍数据</p>
        <h1 className="mt-1 text-[28px] font-bold">{data?.scope || city || '全国'}无障碍体检报告</h1>
        <p className="mt-1 text-[13px] opacity-70">生成时间：{data ? new Date(data.generatedAt).toLocaleString('zh-CN') : '…'}</p>
      </div>

      {error && <p className="p-6 text-red-600">{error}</p>}
      {!data && !error && <p className="p-10 text-center text-gray-400">AI 正在生成报告…</p>}

      {data && data.total.n === 0 && (
        <div className="p-10 text-center text-gray-500">
          <p>该地区暂无数据</p>
          <Link to="/capture" className="mt-3 inline-block text-brand">
            去随手拍 ›
          </Link>
        </div>
      )}

      {data && data.total.n > 0 && (
        <div className="space-y-6 p-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi n={data.total.n} label="问题点" />
            <Kpi n={data.total.severe || 0} label="存在安全隐患" />
            <Kpi n={`${rate(data.total.fixed || 0, data.total.n)}%`} label="整改率" />
            <Kpi n={data.total.users} label="参与市民" />
          </section>

          <section>
            <h2 className="mb-2 text-[18px] font-bold">🤖 AI 体检结论</h2>
            <p className="whitespace-pre-wrap rounded-2xl bg-brand-soft p-4 text-[15px] leading-loose">{data.summary}</p>
          </section>

          <section>
            <h2 className="mb-3 text-[18px] font-bold">问题类型分布</h2>
            <ul className="space-y-2">
              {data.byCategory.map((c) => (
                <li key={c.category} className="flex items-center gap-3 text-[14px]">
                  <span className="w-40 shrink-0 truncate">
                    {CATEGORY_ICON[c.category]} {c.category}
                  </span>
                  <span className="h-5 flex-1 overflow-hidden rounded bg-gray-100">
                    <span className="block h-full rounded bg-brand" style={{ width: `${(c.n / max) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-semibold">{c.n}</span>
                </li>
              ))}
            </ul>
          </section>

          {data.byDistrict.length > 0 && (
            <section>
              <h2 className="mb-3 text-[18px] font-bold">各区县情况</h2>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 font-medium">区县</th>
                    <th className="py-2 font-medium">问题数</th>
                    <th className="py-2 font-medium">已整改</th>
                    <th className="py-2 font-medium">整改率</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDistrict.map((d) => (
                    <tr key={d.district} className="border-b">
                      <td className="py-2">
                        <button className="text-brand" onClick={() => setParams({ city, district: d.district })}>
                          {d.district}
                        </button>
                      </td>
                      <td>{d.n}</td>
                      <td>{d.fixed}</td>
                      <td>{rate(d.fixed, d.n)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-[18px] font-bold">市民最关注的问题</h2>
            <ol className="space-y-2">
              {data.top.map((i, idx) => (
                <li key={i.id}>
                  <Link to={`/issue/${i.id}`} className="flex gap-3 rounded-xl border p-3">
                    <span className="font-bold text-gray-400">{idx + 1}</span>
                    <span className="flex-1">
                      <b>{i.title}</b>
                      <span className="block text-[13px] text-gray-500">{i.address}</span>
                    </span>
                    <span className="text-[13px] text-gray-500">{i.confirmCount} 人确认</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <p className="text-[12px] leading-relaxed text-gray-400">
            说明：本报告基于市民通过「顺路」自愿提交的随手拍数据，由 AI 辅助汇总生成，仅供参考。数据依据《中华人民共和国无障碍环境建设法》倡导的社会共治理念公开。
          </p>
        </div>
      )}
    </div>
  );
}

function Kpi({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 text-center">
      <p className="text-[28px] font-bold text-brand">{n}</p>
      <p className="text-[13px] text-gray-500">{label}</p>
    </div>
  );
}
