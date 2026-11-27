import { Award, Compass, Eye, Handshake, KeyRound, LogIn, LogOut, Megaphone, Pencil, RefreshCw, Search, Share2, ShieldAlert, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import IssueCard from '../components/IssueCard';
import Poster from '../components/Poster';
import { api, type Issue } from '../lib/api';
import { useApp } from '../lib/store';

type MeData = {
  id: string;
  seq: number;
  nickname: string;
  role: 'user' | 'admin';
  hasPassword: boolean;
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
  const { loggedIn, openAuth, logout, toast, setNickname, markHasPassword, profile, saveProfile, largeText, toggleLargeText } = useApp();
  const [me, setMe] = useState<MeData | null>(null);
  const [poster, setPoster] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState('');
  const [p, setP] = useState(profile);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  const load = () => api<MeData>('/api/me').then((d) => (setMe(d), setName(d.nickname))).catch((e) => toast(e.message));
  useEffect(() => {
    if (loggedIn) load();
    else setMe(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="safe-top flex min-h-full flex-col items-center justify-center bg-surface p-6 text-center [--st-pad:2rem]">
        <img src="/logo.svg" width={64} height={64} alt="" className="rounded-2xl shadow-md" />
        <h1 className="mt-4 text-[20px] font-bold text-slate-900">登录顺路账号</h1>
        <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-slate-500">
          登录后可记录路障、查看个人积分与勋章、跨设备同步你的所有标记。
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
          <button
            onClick={() => openAuth('login')}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-[15px] font-semibold text-white shadow-sm shadow-brand/25"
          >
            <LogIn className="h-4 w-4" />
            已有账号登录
          </button>
          <button
            onClick={() => openAuth('register')}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-[15px] font-semibold text-slate-700"
          >
            注册新账号
          </button>
        </div>
      </div>
    );
  }

  if (!me) return <div className="safe-top p-10 text-center text-slate-400">加载中…</div>;
  const { stats, level } = me;
  const progress = level.next ? Math.min(100, Math.round((stats.points / (stats.points + level.next.need)) * 100)) : 100;

  async function savePwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) return toast('密码至少 6 位');
    try {
      await api('/api/me/password', { method: 'POST', json: { oldPassword: oldPwd, newPassword: newPwd } });
      markHasPassword();
      setOldPwd('');
      setNewPwd('');
      setPwdOpen(false);
      toast('密码已保存，以后换设备也可以用昵称+密码登录');
      load();
    } catch (err) {
      toast((err as Error).message);
    }
  }

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
                toast('昵称已更新');
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
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setEditName(true)} className="inline-flex min-w-0 items-center gap-2 text-left">
              <span className="truncate text-[22px] font-bold tracking-tight">{me.nickname}</span>
              <Pencil className="h-4 w-4 shrink-0 text-white/70" />
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/95">第 {me.seq} 号体检官</span>
              {me.role === 'admin' && <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-900">管理员</span>}
            </div>
          </div>
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
        {!me.hasPassword && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-900">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold">建议立即设置登录密码</p>
                <p className="mt-0.5 text-[12px] text-amber-800/90">你使用的是旧版免密账号，设置密码后即可跨设备安全找回所有记录，防止丢失。</p>
                <button onClick={() => setPwdOpen(true)} className="mt-2 rounded-lg bg-amber-600 px-3 py-1 text-[12px] font-semibold text-white">
                  现在设置密码
                </button>
              </div>
            </div>
          </section>
        )}

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

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">无障碍大字关怀模式</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">放大全站文字与按钮尺寸，方便长辈和弱视朋友阅读</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={largeText}
              onClick={() => (toggleLargeText(), toast(largeText ? '已恢复标准字号' : '已开启大字关怀模式'))}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${largeText ? 'bg-brand' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-xs transition-transform duration-200 ${largeText ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <h2 className="text-[15px] font-semibold text-slate-900">账号与安全</h2>
          <div className="mt-3 flex gap-2.5">
            <button
              onClick={() => setPwdOpen((v) => !v)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-[13px] font-semibold text-slate-700"
            >
              <KeyRound className="h-4 w-4 text-brand" />
              {me.hasPassword ? '修改密码' : '设置密码'}
            </button>
            <button
              onClick={async () => {
                if (!me.hasPassword && !window.confirm('当前账号还没设置密码，退出后将无法再次登录该账号，确定退出吗？')) return;
                await logout();
                toast('已退出登录');
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 py-2.5 text-[13px] font-semibold text-red-600"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
          {pwdOpen && (
            <form onSubmit={savePwd} className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
              {me.hasPassword && (
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="当前密码"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-brand"
                />
              )}
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="新密码（至少 6 位）"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-brand"
              />
              <button className="w-full rounded-lg bg-brand py-2 text-[14px] font-semibold text-white">确认保存密码</button>
            </form>
          )}
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
      {poster && <Poster nickname={me.nickname} seq={me.seq} level={level.name} issues={stats.issues} confirmed={stats.confirmed} fixed={stats.fixed} onClose={() => setPoster(false)} />}
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
