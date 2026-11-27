import { Camera, FileText, MapPin, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../lib/store';

export default function Onboarding() {
  const { register, toast } = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast('先给自己起个昵称吧');
    setBusy(true);
    try {
      await register(name.trim());
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal aria-labelledby="ob-title">
      <form onSubmit={submit} className="safe-bottom w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center gap-3.5">
          <img src="/logo.svg" width={46} height={46} alt="" className="rounded-2xl shadow-sm" />
          <div>
            <h1 id="ob-title" className="text-[22px] font-bold tracking-tight text-slate-900">顺路</h1>
            <p className="text-[14px] text-slate-500">随手拍，让每条路都顺</p>
          </div>
        </div>
        <div className="mb-5 space-y-2.5 rounded-2xl bg-slate-50 p-4 text-[14px] text-slate-700">
          <Row icon={Camera} text="看到盲道被占、坡道破损，顺手拍一张" />
          <Row icon={ShieldCheck} text="自动识别问题，并为人脸和车牌打码" />
          <Row icon={MapPin} text="标在地图上，帮轮椅与视障朋友提前避障" />
          <Row icon={FileText} text="自动生成 12345 反映文本，推动整改" />
        </div>
        <label className="mb-2 block text-[14px] font-medium text-slate-700" htmlFor="ob-name">
          起个昵称开始使用
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="例如：热心市民小顺"
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[16px] outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
          autoFocus
        />
        <button disabled={busy} className="w-full rounded-xl bg-brand py-3.5 text-[16px] font-semibold text-white shadow-sm shadow-brand/25 transition active:bg-brand-dark disabled:opacity-60">
          {busy ? '正在进入…' : '进入顺路'}
        </button>
        <p className="mt-3 text-center text-[12px] text-slate-400">无需注册，身份仅保存在当前设备</p>
      </form>
    </div>
  );
}

function Row({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
        <Icon className="h-4 w-4" />
      </span>
      <span>{text}</span>
    </div>
  );
}
