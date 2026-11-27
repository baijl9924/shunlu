import { Check, CheckCircle2, ChevronLeft, ChevronRight, MapPin, RefreshCw, Share2, ThumbsUp, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appHomePath } from '../App';
import CategoryIcon from '../components/CategoryIcon';
import { StatusBadge } from '../components/IssueCard';
import ReportTextCard from '../components/ReportTextCard';
import { api, assetUrl, SEVERITY_TEXT, timeAgo, type IssueDetail } from '../lib/api';
import { compressImage } from '../lib/image';
import { useApp } from '../lib/store';

const UPDATE_TEXT: Record<IssueDetail['updates'][number]['type'], string> = {
  reported: '已向有关部门反映',
  fixed: '核实已整改完成',
  fixed_claim: '提交了整改复查凭证（待二次确认）',
  recheck: '复查：问题仍存在',
};

export default function IssuePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { loggedIn, openAuth, toast } = useApp();
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
  }, [id, loggedIn]);

  function requireLogin() {
    if (loggedIn) return true;
    toast('请先登录后再操作');
    openAuth('login');
    return false;
  }

  async function confirm() {
    if (!requireLogin()) return;
    try {
      await api(`/api/issues/${id}/confirm`, { method: 'POST' });
      toast('感谢确认，这会让问题更受重视');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function addUpdate(type: 'reported' | 'fixed' | 'recheck', photo?: Blob) {
    if (!requireLogin()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('type', type);
      if (photo) fd.append('photo', photo, 'photo.jpg');
      const r = await api<{ message?: string }>(`/api/issues/${id}/updates`, { method: 'POST', body: fd });
      toast(r.message || (type === 'reported' ? '已记录，积分 +5' : '感谢复查，积分 +20'));
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeIssue() {
    if (!window.confirm('确定要撤回/删除这条标记吗？删除后将不再在地图上展示。')) return;
    try {
      await api(`/api/issues/${id}`, { method: 'DELETE' });
      toast('已删除该标记');
      nav(appHomePath(), { replace: true });
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function share() {
    const url = location.href;
    const text = `我在「顺路」发现一处无障碍问题：${issue?.title}（${issue?.address}）。一起关注，让每条路都顺。`;
    if (navigator.share) navigator.share({ title: '顺路', text, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
      toast('链接已复制，快分享给朋友');
    }
  }

  if (error)
    return (
      <div className="safe-top p-10 text-center text-slate-500">
        <p>{error}</p>
        <button onClick={() => nav(appHomePath())} className="mt-4 font-medium text-brand">
          返回地图
        </button>
      </div>
    );
  if (!issue) return <div className="safe-top p-10 text-center text-slate-400">加载中…</div>;

  const iReported = issue.reportedByMe;
  const navUrl = `https://apis.map.qq.com/uri/v1/marker?marker=coord:${issue.lat},${issue.lng};title:${encodeURIComponent(issue.title)};addr:${encodeURIComponent(issue.address)}&referer=shunlu`;

  return (
    <div className="safe-bottom min-h-full bg-surface [--sb-pad:2.5rem]">
      <header className="safe-top sticky top-0 z-20 flex items-center gap-1 border-b border-slate-200/70 bg-white/95 px-2 pb-2 backdrop-blur-md [--st-pad:0.5rem]">
        <button onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav(appHomePath()))} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 active:bg-slate-100" aria-label="返回">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[17px] font-semibold text-slate-900">问题详情</h1>
        <div className="ml-auto flex items-center gap-1 pr-1">
          {issue.canManage && (
            <button onClick={removeIssue} className="grid h-9 w-9 place-items-center rounded-full text-red-500 active:bg-red-50" aria-label="删除我的标记" title="删除标记">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={share} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-medium text-brand active:bg-brand-soft" aria-label="分享">
            <Share2 className="h-4 w-4" />
            分享
          </button>
        </div>
      </header>

      <img src={assetUrl(issue.photo)} alt={`现场照片：${issue.description}`} className="max-h-[48vh] w-full bg-slate-950 object-contain" />

      <div className="space-y-3.5 p-4">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <StatusBadge status={issue.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">{SEVERITY_TEXT[issue.severity]}</span>
            <span className="ml-auto text-[12px] text-slate-400">
              {issue.nickname} · {timeAgo(issue.createdAt)}
            </span>
          </div>
          <h2 className="mt-2.5 flex items-center gap-2 text-[19px] font-bold text-slate-900">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <CategoryIcon category={issue.category} className="h-4 w-4" />
            </span>
            {issue.title}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{issue.description}</p>
          <a href={navUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
            <MapPin className="h-4 w-4 shrink-0 text-brand" />
            <span className="flex-1 truncate">{issue.address || `${issue.lat.toFixed(5)}, ${issue.lng.toFixed(5)}`}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </a>
          <button
            onClick={confirm}
            disabled={issue.confirmed || issue.mine}
            className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand bg-brand-soft/40 py-2.5 text-[15px] font-semibold text-brand transition active:bg-brand-soft disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {issue.confirmed ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
            {issue.mine ? `我发布的标记 · ${issue.confirmCount} 人也遇到` : issue.confirmed ? `已确认 · ${issue.confirmCount} 人也遇到` : `我也遇到（${issue.confirmCount}）`}
          </button>
        </section>

        <ReportTextCard text={issue.reportText} channel={issue.channel} reported={iReported} onReported={() => addUpdate('reported')} />

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
            <RefreshCw className="h-4 w-4 text-brand" />
            路过复查
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">再次路过时拍一张（同样自动审核并打码），满 2 位市民或原发布者确认后将正式标为「已整改」（积分 +20）</p>
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
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              disabled={busy || issue.status === 'fixed'}
              onClick={() => {
                if (!requireLogin()) return;
                setRecheckType('fixed');
                fileRef.current?.click();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[14px] font-semibold text-white active:bg-emerald-600 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              已经修好了
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (!requireLogin()) return;
                setRecheckType('recheck');
                fileRef.current?.click();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-[14px] font-medium text-slate-700 active:bg-slate-50"
            >
              <XCircle className="h-4 w-4 text-slate-400" />
              还是老样子
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <h2 className="mb-3.5 text-[15px] font-semibold text-slate-900">处理进展</h2>
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
            <li>
              <span className="absolute -left-[6px] mt-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-white" aria-hidden />
              <p className="text-[14px] font-medium text-slate-800">{issue.nickname} 标记了这个问题</p>
              <p className="text-[12px] text-slate-400">{new Date(issue.createdAt).toLocaleString('zh-CN')}</p>
            </li>
            {issue.updates.map((u) => (
              <li key={u.id}>
                <span
                  className={`absolute -left-[6px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                    u.type === 'fixed' ? 'bg-emerald-500' : u.type === 'reported' || u.type === 'fixed_claim' ? 'bg-amber-500' : 'bg-slate-400'
                  }`}
                  aria-hidden
                />
                <p className="text-[14px] font-medium text-slate-800">
                  {u.nickname} {UPDATE_TEXT[u.type] || '更新了进展'}
                </p>
                {u.note && <p className="text-[13px] text-slate-600">{u.note}</p>}
                {u.photo && <img src={assetUrl(u.photo)} alt="复查照片" className="mt-1.5 h-28 rounded-xl object-cover" loading="lazy" />}
                <p className="text-[12px] text-slate-400">{new Date(u.createdAt).toLocaleString('zh-CN')}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
