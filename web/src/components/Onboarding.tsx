import { Lock, ShieldCheck, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';

/** 登录 / 注册弹窗：昵称全局唯一 + 密码保护，防止重名覆盖，支持游客先浏览 */
export default function Onboarding() {
  const { authModal, closeAuth, login, register, toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>(authModal || 'register');
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const n = name.trim();
    if (n.length < 2) return setErr('昵称至少需要 2 个字');
    if (password.length < 6) return setErr('密码至少需要 6 位');
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(n, password);
        toast(`欢迎加入顺路，${n}`);
      } else {
        await login(n, password);
        toast(`欢迎回来，${n}`);
      }
      setPassword('');
    } catch (error) {
      setErr((error as Error).message);
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
                {mode === 'register' ? '注册顺路账号' : '登录顺路账号'}
              </h1>
              <p className="text-[12px] text-slate-500">昵称全站唯一，跨设备同步你的标记与积分</p>
            </div>
          </div>
          <button type="button" onClick={closeAuth} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 滑动切换：登录 / 注册 */}
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

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">唯一昵称</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="2–16 个字，全站不可重名"
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
                placeholder={mode === 'register' ? '设置至少 6 位密码' : '输入你的登录密码'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-[15px] outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </label>
        </div>

        {err && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600" role="alert">
            <span>{err}</span>
            {mode === 'register' && err.includes('已被使用') && (
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
          {busy ? '请稍候…' : mode === 'register' ? '注册并开始使用' : '登录账号'}
        </button>

        <p className="mt-3 flex items-center justify-center gap-1 text-[12px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          密码经加密哈希存储，游客也可关闭窗口继续浏览地图与报告
        </p>
      </form>
    </div>
  );
}
