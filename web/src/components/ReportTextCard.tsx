import { Check, Copy, ExternalLink, FileText, Phone, UserPen } from 'lucide-react';
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
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
          <FileText className="h-4 w-4 text-brand" />
          12345 反映文本
        </h2>
        <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
          <UserPen className="h-3.5 w-3.5" />
          {editing ? '收起资料' : '填写资料'}
        </button>
      </div>
      {editing && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="mb-2 text-[12px] text-slate-500">举报资料仅保存在当前手机，不会上传服务器</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="姓名"
              className="w-1/3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-brand"
              aria-label="姓名"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="联系电话"
              inputMode="tel"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-brand"
              aria-label="联系电话"
            />
          </div>
          <button
            onClick={() => {
              saveProfile({ name: name.trim(), phone: phone.trim() });
              setEditing(false);
              toast('已保存到本机');
            }}
            className="mt-2 w-full rounded-lg bg-brand py-2 text-[14px] font-semibold text-white active:bg-brand-dark"
          >
            保存
          </button>
        </div>
      )}
      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-brand-soft/70 p-3.5 text-[14px] leading-relaxed text-slate-800">{filled}</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 text-[14px]">
        <button onClick={copy} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 font-semibold text-white active:bg-brand-dark">
          <Copy className="h-4 w-4" />
          复制文本
        </button>
        {channel === '12315' ? (
          <a href="https://www.12315.cn/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand py-2.5 font-semibold text-brand">
            <ExternalLink className="h-4 w-4" />
            打开 12315
          </a>
        ) : (
          <a href="tel:12345" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand py-2.5 font-semibold text-brand">
            <Phone className="h-4 w-4" />
            拨打 12345
          </a>
        )}
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-slate-500">
        也可在微信搜索「{channel === '12315' ? '全国12315平台' : '12345'}」小程序提交，或通过最高检「益心为公」小程序提交公益诉讼线索。
      </p>
      <button
        onClick={onReported}
        disabled={reported}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-[14px] font-semibold text-white transition active:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
      >
        {reported && <Check className="h-4 w-4" />}
        {reported ? '已标记为“已反映”' : '我已向相关部门反映（积分 +5）'}
      </button>
    </section>
  );
}
