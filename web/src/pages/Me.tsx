import { Award, Compass, Eye, Handshake, Megaphone, Pencil, RefreshCw, Search, Share2, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import IssueCard from '../components/IssueCard';
import Poster from '../components/Poster';
import { api, type Issue } from '../lib/api';
import { useApp } from '../lib/store';

type MeData = {
  nickname: string;
  stats: { points: number; issues: number; fixed: number; confirmed: number; helped: number; rechecks: number; cities: number };
  level: { name: string; index: number; next: { name: string; need: number } | null };
  badges: { id: string; name: string; desc: string; got: boolean }[];
  issues: Issue[];
};

const BADGE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  first: Search,
  ten: Eye,
  echo: Megaphone,
  helper: Handshake,
  fixer: Wrench,
  recheck: RefreshCw,
  traveler: Compass,
};

export default function Me() {
  const { loggedIn, toast, setNickname, profile, saveProfile } = useApp();
  const [me, setMe] = useState<MeData | null>(null);
  const [poster, setPoster] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState('');
  const [p, setP] = useState(profile);

  const load = () => api<MeData>('/api/me').then((d) => (setMe(d), setName(d.nickname))).catch((e) => toast(e.message));
  useEffect(() => {
    if (loggedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  if (!me) return <div className="safe-top p-10 text-center text-slate-400">加载中…</div>;
  const { stats, level } = me;
  const progress = level.next ? Math.min(100, Math.round((stats.points / (stats.points + level.next.need)) * 100)) : 100;

  return (
    <div className="min-h-full bg-surface pb-14">
      <section className="safe-top bg-gradient-to-br from-brand to-brand-dark px-5 pb-16 text-white [--st-pad:1.5rem]">
        {editName ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/api/me', { method: 'PATCH', json: { nickname: name } });
                setNickname(name.trim());
                setEditName(false);
                load();
              } catch (err) {
                toast((err as Error).message);
              }
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} className="flex-1 rounded-xl bg-white px-3 py-2 text-[15px] text-ink outline-none" aria-label="昵称" autoFocus />
            <button className="rounded-xl bg-white/20 px-4 text-[14px] font-medium">保存</button>
          </form>
        ) : (
          <button onClick={() => setEditName(true)} className="inline-flex items-center gap-2 text-left">
            <span className="text-[22px] font-bold tracking-tight">{me.nickname}</span>
            <Pencil className="h-4 w-4 text-white/70" />
          </button>
        )}
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[14px] text-white/90">
          <Award className="h-4 w-4 text-amber-300" />
          {level.name} · {stats.points} 积分
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-white/75">{level.next ? `再得 ${level.next.need} 积分升级为「${level.next.name}」` : '已达到最高等级，感谢同行'}</p>
      </section>

      <div className="-mt-11 space-y-3.5 px-4">
        <section className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/70 bg-white p-4 text-center shadow-xs">
          <Stat n={stats.issues} label="标记问题" />
          <Stat n={stats.confirmed} label="获得确认" />
          <Stat n={stats.fixed} label="推动整改" />
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <p className="text-[14px] leading-relaxed text-slate-600">
            你标记的问题已获得 <b className="text-brand">{stats.confirmed}</b> 次确认，其中 <b className="text-emerald-600">{stats.fixed}</b> 处已经整改。每一次记录都在帮出行不便的朋友少走弯路。
          </p>
          <button
            onClick={() => setPoster(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white active:bg-brand-dark"
          >
            <Share2 className="h-4 w-4" />
            生成体检官分享海报
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <h2 className="mb-3 text-[15px] font-semibold text-slate-900">成就勋章</h2>
          <ul className="grid grid-cols-4 gap-3">
            {me.badges.map((b) => {
              const Icon = BADGE_ICON[b.id] || Award;
              return (
                <li key={b.id} className={`text-center ${b.got ? '' : 'opacity-40'}`} title={b.desc}>
                  <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${b.got ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-slate-400'}`} aria-hidden>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-700">{b.name}</p>
                  <span className="sr-only">
                    {b.got ? '已获得' : '未获得'}：{b.desc}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <h2 className="text-[15px] font-semibold text-slate-900">举报资料卡</h2>
          <p className="mb-2.5 mt-0.5 text-[12px] text-slate-500">生成 12345 反映文本时自动填入，仅保存在本机。</p>
          <div className="flex gap-2">
            <input
              value={p.name}
              onChange={(e) => setP({ ...p, name: e.target.value })}
              placeholder="姓名"
              className="w-1/3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[14px] outline-none focus:border-brand focus:bg-white"
              aria-label="姓名"
            />
            <input
              value={p.phone}
              onChange={(e) => setP({ ...p, phone: e.target.value })}
              placeholder="联系电话"
              inputMode="tel"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[14px] outline-none focus:border-brand focus:bg-white"
              aria-label="联系电话"
            />
          </div>
          <button
            onClick={() => (saveProfile(p), toast('已保存到本机'))}
            className="mt-2.5 w-full rounded-xl border border-brand py-2 text-[14px] font-semibold text-brand active:bg-brand-soft"
          >
            保存资料
          </button>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[14px] font-semibold text-slate-700">我的标记（{me.issues.length}）</h2>
          <div className="space-y-2.5">
            {me.issues.length === 0 && (
              <p className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center text-[13px] text-slate-400">还没有标记，去随手拍下第一处吧</p>
            )}
            {me.issues.map((i) => (
              <IssueCard key={i.id} issue={i} />
            ))}
          </div>
        </section>
      </div>
      {poster && <Poster nickname={me.nickname} level={level.name} issues={stats.issues} confirmed={stats.confirmed} fixed={stats.fixed} onClose={() => setPoster(false)} />}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="text-[24px] font-bold tracking-tight text-slate-900">{n}</p>
      <p className="text-[12px] text-slate-500">{label}</p>
    </div>
  );
}
