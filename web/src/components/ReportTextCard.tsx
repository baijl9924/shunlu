import { useState } from 'react';
import { useApp } from '../lib/store';

/** 反映文本卡片：用本机“举报资料卡”替换占位符，个人信息不上传 */
export default function ReportTextCard({ text, channel, onReported, reported }: { text: string; channel: string; onReported: () => void; reported: boolean }) {
  const { profile, saveProfile, toast } = useApp();
  const [editing, setEditing] = useState(!profile.name);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);

  const filled = text.replaceAll('【姓名】', profile.name || '【姓名】').replaceAll('【电话】', profile.phone || '【电话】');

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = filled;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('已复制，可粘贴到 12345 平台或念给接线员');
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">📝 AI 已写好反映文本</h2>
        <button onClick={() => setEditing((v) => !v)} className="text-[14px] text-brand">
          {editing ? '收起' : '修改我的资料'}
        </button>
      </div>
      {editing && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <p className="mb-2 text-[13px] text-gray-500">举报资料卡：仅保存在你的手机里，不会上传服务器</p>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" className="w-1/3 rounded-lg border border-gray-300 px-3 py-2.5 text-[15px]" aria-label="姓名" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="联系电话" inputMode="tel" className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-[15px]" aria-label="联系电话" />
          </div>
          <button
            onClick={() => {
              saveProfile({ name: name.trim(), phone: phone.trim() });
              setEditing(false);
              toast('已保存到本机');
            }}
            className="mt-2 w-full rounded-lg bg-brand py-2.5 text-[15px] font-semibold text-white"
          >
            保存
          </button>
        </div>
      )}
      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-brand-soft p-3 text-[15px] leading-relaxed">{filled}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[15px]">
        <button onClick={copy} className="rounded-xl bg-brand py-3 font-semibold text-white">
          复制文本
        </button>
        {channel === '12315' ? (
          <a href="https://www.12315.cn/" target="_blank" rel="noreferrer" className="rounded-xl border border-brand py-3 text-center font-semibold text-brand">
            打开 12315
          </a>
        ) : (
          <a href="tel:12345" className="rounded-xl border border-brand py-3 text-center font-semibold text-brand">
            📞 拨打 12345
          </a>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
        也可以在微信搜索「{channel === '12315' ? '全国12315平台' : '12345'}」小程序提交，或通过最高检「益心为公」小程序反映公益诉讼线索。
      </p>
      <button
        onClick={onReported}
        disabled={reported}
        className="mt-3 w-full rounded-xl bg-amber-500 py-3 text-[15px] font-semibold text-white disabled:bg-gray-300"
      >
        {reported ? '✅ 你已标记“已反映”' : '我已反映（积分 +5）'}
      </button>
    </section>
  );
}
