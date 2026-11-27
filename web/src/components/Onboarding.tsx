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
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal aria-labelledby="ob-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-3">
          <img src="/logo.svg" width={48} height={48} alt="" />
          <div>
            <h1 id="ob-title" className="text-2xl font-bold text-brand">顺路</h1>
            <p className="text-[15px] text-gray-500">随手拍，让每条路都顺</p>
          </div>
        </div>
        <ul className="mb-5 space-y-2 rounded-2xl bg-brand-soft p-4 text-[15px] leading-relaxed text-gray-700">
          <li>📷 看到盲道被占、坡道损坏，<b>拍一张</b></li>
          <li>🤖 AI 自动识别问题、给人脸车牌<b>打码</b></li>
          <li>🗺️ 标上地图，帮轮椅、视障朋友<b>避开路障</b></li>
          <li>📝 一键生成 <b>12345 反映文本</b>，推动整改</li>
        </ul>
        <label className="mb-2 block text-[15px] font-medium" htmlFor="ob-name">
          给自己起个昵称
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="例如：热心市民小顺"
          className="mb-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-[17px] outline-none focus:border-brand"
          autoFocus
        />
        <button disabled={busy} className="w-full rounded-xl bg-brand py-3.5 text-[17px] font-semibold text-white active:bg-brand-dark disabled:opacity-60">
          {busy ? '请稍候…' : '开始体检'}
        </button>
        <p className="mt-3 text-center text-[13px] text-gray-400">免注册，身份仅保存在本机</p>
      </form>
    </div>
  );
}
