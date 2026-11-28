import { Compass, Lock, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp, type AuthModalMode } from '../lib/store';

/** 登录 / 注册 / 游客转正弹窗：支持一键免注册游客体验，并随时升级为正式账号保留全部记录与积分 */
export default function Onboarding() {
  const { authModal, closeAuth, login, register, enterAsGuest, upgradeGuest, loggedIn, isGuest, toast } = useApp();
  const [mode, setMode] = useState<Exclude<AuthModalMode, null>>(authModal || 'register');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authModal) {
      setMode(authModal);
      setErr('');
    }
  }, [authModal]);

  useEffect(() => {
    if (!authModal) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      closeAuth();
    };
    window.addEventListener('shunlu:back', onBack);
    return () => window.removeEventListener('shunlu:back', onBack);
  }, [authModal, closeAuth]);

  if (!authModal) return null;

  const isUpgrade = mode === 'upgrade';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const n = name.trim();
    if (n.length < 2) return setErr('昵称至少需要 2 个字');
    if (password.length < 6) return setErr('密码至少需要 6 位');
    setBusy(true);
    try {
      if (isUpgrade) {
        await upgradeGuest(n, password);
        toast(`升级成功！欢迎成为正式顺路体检官，${n}`);
      } else if (mode === 'register') {
        await register(n, password);
        toast(`欢迎加入顺路，${n}`);
      } else {
        await login(n, password);
        toast(`欢迎回来，${n}`);
      }
      setPassword('');
      setName('');
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startGuest() {
    setErr('');
    setBusy(true);
    try {
      const ok = await enterAsGuest();
      if (ok) toast('已开启免注册游客体验，可直接拍照识别与生成 12345 文本');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="auth-title"
      onClick={closeAuth}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="sheet-up safe-bottom w-full max-w-md rounded-t-3xl bg-white px-6 pt-5 shadow-2xl [--sb-pad:2rem] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" width={40} height={40} alt="" className="rounded-xl shadow-xs" />
            <div>
              <h1 id="auth-title" className="text-[19px] font-bold tracking-tight text-slate-900">
                {isUpgrade ? '升级正式体检官账号' : mode === 'register' ? '注册顺路账号' : '登录顺路账号'}
              </h1>
              <p className="text-[12px] text-slate-500">
                {isUpgrade ? '保留当前访客记录与积分，解锁排行榜与勋章' : '跨设备同步你的标记、积分与勋章'}
              </p>
            </div>
          </div>
          <button type="button" onClick={closeAuth} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isUpgrade ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-soft/60 px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-700">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <p>设置昵称和密码后，当前访客的标记、积分与复查记录将全部保留并立即参与排行。</p>
          </div>
        ) : (
          /* 滑动切换：登录 / 注册 */
          <div className="relative mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-xs transition-transform duration-200 ease-out"
              style={{ transform: mode === 'register' ? 'translateX(0%)' : 'translateX(100%)' }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => (setMode('register'), setErr(''))}
              className={`relative z-10 rounded-lg py-2 text-[14px] font-semibold transition-colors ${mode === 'register' ? 'text-brand' : 'text-slate-500'}`}
            >
              注册新账号
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => (setMode('login'), setErr(''))}
              className={`relative z-10 rounded-lg py-2 text-[14px] font-semibold transition-colors ${mode === 'login' ? 'text-brand' : 'text-slate-500'}`}
            >
              已有账号登录
            </button>
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">昵称</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="2–16 个字"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
                autoFocus
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">登录密码</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={64}
                placeholder={mode === 'login' ? '输入你的登录密码' : '设置至少 6 位密码'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </label>
        </div>

        {err && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600" role="alert">
            <span>{err}</span>
            {(mode === 'register' || isUpgrade) && err.includes('已被使用') && (
              <button type="button" onClick={() => (setMode('login'), setErr(''))} className="shrink-0 font-semibold text-brand underline">
                去登录
              </button>
            )}
          </div>
        )}

        <button
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand/25 transition active:scale-[0.98] active:bg-brand-dark disabled:opacity-60"
        >
          {busy ? '请稍候…' : isUpgrade ? '确认升级并入榜保存' : mode === 'register' ? '注册并开始使用' : '登录账号'}
        </button>

        {!loggedIn && !isUpgrade && (
          <button
            type="button"
            disabled={busy}
            onClick={startGuest}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/25 bg-brand-soft/45 py-3 text-[14px] font-semibold text-brand transition active:scale-[0.98] disabled:opacity-60"
          >
            <Compass className="h-4 w-4" />
            暂不注册，一键游客体验
          </button>
        )}

        {isUpgrade && isGuest && (
          <button
            type="button"
            onClick={() => (setMode('login'), setErr(''))}
            className="mt-2.5 w-full py-1.5 text-center text-[13px] font-medium text-slate-500 hover:text-brand"
          >
            已有正式账号？切换到登录
          </button>
        )}

        <p className="mt-3 flex items-center justify-center gap-1 text-[12px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          {isUpgrade ? '密码经加密哈希存储，升级后可在任意设备找回记录' : '游客可直接体验 AI 识别、自动打码与 12345 文本，暂不计入排行榜'}
        </p>
      </form>
    </div>
  );
}
