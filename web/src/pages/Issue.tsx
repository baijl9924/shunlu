import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/IssueCard';
import ReportTextCard from '../components/ReportTextCard';
import { api, assetUrl, CATEGORY_ICON, SEVERITY_TEXT, timeAgo, type IssueDetail } from '../lib/api';
import { compressImage } from '../lib/image';
import { useApp } from '../lib/store';

const UPDATE_TEXT = { reported: '已向有关部门反映', fixed: '确认已整改', recheck: '复查：问题仍存在' };

export default function IssuePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [recheckType, setRecheckType] = useState<'fixed' | 'recheck'>('fixed');

  const load = () =>
    api<IssueDetail>(`/api/issues/${id}`)
      .then(setIssue)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function confirm() {
    try {
      await api(`/api/issues/${id}/confirm`, { method: 'POST' });
      toast('感谢确认！这会让问题更受重视');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function addUpdate(type: 'reported' | 'fixed' | 'recheck', photo?: Blob) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('type', type);
      if (photo) fd.append('photo', photo, 'photo.jpg');
      await api(`/api/issues/${id}/updates`, { method: 'POST', body: fd });
      toast(type === 'reported' ? '已记录，积分 +5' : '感谢复查，积分 +20');
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = location.href;
    const text = `我在「顺路」发现一个无障碍问题：${issue?.title}，${issue?.address}。一起关注，让每条路都顺！`;
    if (navigator.share) navigator.share({ title: '顺路', text, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
      toast('链接已复制，快分享给朋友');
    }
  }

  if (error)
    return (
      <div className="p-8 text-center text-gray-500">
        <p>{error}</p>
        <button onClick={() => nav('/')} className="mt-4 text-brand">
          返回地图
        </button>
      </div>
    );
  if (!issue) return <div className="p-8 text-center text-gray-400">加载中…</div>;

  const iReported = issue.reportedByMe;
  const navUrl = `https://apis.map.qq.com/uri/v1/marker?marker=coord:${issue.lat},${issue.lng};title:${encodeURIComponent(issue.title)};addr:${encodeURIComponent(issue.address)}&referer=shunlu`;

  return (
    <div className="min-h-full bg-[#f3f5f4] pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-white px-2 py-2 shadow-sm">
        <button onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))} className="grid h-11 w-11 place-items-center rounded-full text-2xl" aria-label="返回">
          ‹
        </button>
        <h1 className="text-[18px] font-semibold">问题详情</h1>
        <button onClick={share} className="ml-auto mr-2 rounded-full px-3 py-1.5 text-[15px] text-brand" aria-label="分享">
          分享
        </button>
      </header>

      <img src={assetUrl(issue.photo)} alt={`现场照片：${issue.description}`} className="max-h-[50vh] w-full bg-black object-contain" />

      <div className="space-y-4 p-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={issue.status} />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[12px]">{SEVERITY_TEXT[issue.severity]}</span>
            <span className="ml-auto text-[12px] text-gray-400">
              {issue.nickname} · {timeAgo(issue.createdAt)}
            </span>
          </div>
          <h2 className="mt-2 text-[20px] font-bold">
            <span aria-hidden>{CATEGORY_ICON[issue.category]} </span>
            {issue.title}
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-gray-700">{issue.description}</p>
          <a href={navUrl} target="_blank" rel="noreferrer" className="mt-2 block text-[14px] text-brand">
            📍 {issue.address || `${issue.lat.toFixed(5)}, ${issue.lng.toFixed(5)}`} ›
          </a>
          <button
            onClick={confirm}
            disabled={issue.confirmed || issue.mine}
            className="mt-3 w-full rounded-xl border-2 border-brand py-3 text-[16px] font-semibold text-brand disabled:border-gray-200 disabled:text-gray-400"
          >
            {issue.mine ? `我的标记 · ${issue.confirmCount} 人也遇到` : issue.confirmed ? `✅ 已确认 · ${issue.confirmCount} 人也遇到` : `🙋 我也遇到（${issue.confirmCount}）`}
          </button>
        </section>

        <ReportTextCard text={issue.reportText} channel={issue.channel} reported={iReported} onReported={() => addUpdate('reported')} />

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">🔄 回头看</h2>
          <p className="mt-1 text-[14px] text-gray-500">路过时再拍一张，帮大家确认问题有没有被解决（积分 +20）</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) addUpdate(recheckType, await compressImage(f));
            }}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={busy || issue.status === 'fixed'}
              onClick={() => {
                setRecheckType('fixed');
                fileRef.current?.click();
              }}
              className="rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              ✅ 已经修好了
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setRecheckType('recheck');
                fileRef.current?.click();
              }}
              className="rounded-xl border border-gray-300 py-3 text-[15px]"
            >
              ❌ 还是老样子
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">进展</h2>
          <ol className="relative space-y-4 border-l-2 border-gray-200 pl-5">
            <li>
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-red-500" aria-hidden />
              <p className="text-[15px]">{issue.nickname} 标记了这个问题</p>
              <p className="text-[12px] text-gray-400">{new Date(issue.createdAt).toLocaleString('zh-CN')}</p>
            </li>
            {issue.updates.map((u) => (
              <li key={u.id}>
                <span
                  className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ${u.type === 'fixed' ? 'bg-brand' : u.type === 'reported' ? 'bg-amber-500' : 'bg-gray-400'}`}
                  aria-hidden
                />
                <p className="text-[15px]">
                  {u.nickname} {UPDATE_TEXT[u.type]}
                </p>
                {u.note && <p className="text-[14px] text-gray-600">{u.note}</p>}
                {u.photo && <img src={assetUrl(u.photo)} alt="复查照片" className="mt-1 h-28 rounded-lg object-cover" loading="lazy" />}
                <p className="text-[12px] text-gray-400">{new Date(u.createdAt).toLocaleString('zh-CN')}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
