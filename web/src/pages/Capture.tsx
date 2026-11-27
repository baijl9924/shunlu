import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import MosaicEditor, { type MosaicHandle } from '../components/MosaicEditor';
import { api, assetUrl, CATEGORY_ICON, SEVERITY_TEXT } from '../lib/api';
import { DEFAULT_CENTER, locate } from '../lib/geo';
import { compressImage } from '../lib/image';
import { useApp } from '../lib/store';

type Analysis = { category: string; severity: number; title: string; description: string; department: string; channel: string };
type Step = 'pick' | 'analyzing' | 'rejected' | 'confirm' | 'submitting' | 'done';
type Pos = { lat: number; lng: number };

export default function Capture() {
  const { config, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('pick');
  const [preview, setPreview] = useState('');
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState<{ id: string; photo: string; blurredCount: number } | null>(null);
  const [form, setForm] = useState<Analysis | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [locError, setLocError] = useState('');
  const [geo, setGeo] = useState({ address: '', city: '', district: '' });
  const [doneId, setDoneId] = useState('');
  const mosaic = useRef<MosaicHandle>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const albumInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    locate()
      .then((p) => setPos(p))
      .catch((e) => {
        setLocError(e.message);
        const s = sessionStorage.getItem('shunlu.center');
        setPos(s ? JSON.parse(s) : DEFAULT_CENTER);
      });
  }, []);

  // 位置变化时做逆地址解析
  useEffect(() => {
    if (!pos) return;
    const t = window.setTimeout(() => {
      api(`/api/geocode?lat=${pos.lat}&lng=${pos.lng}`).then(setGeo).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [pos?.lat, pos?.lng]);

  async function onFile(file?: File) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStep('analyzing');
    try {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.append('image', blob, 'photo.jpg');
      const r = await api('/api/analyze', { method: 'POST', body: fd });
      if (!r.accept) {
        setReason(r.reason);
        setStep('rejected');
        return;
      }
      setDraft({ id: r.draftId, photo: r.photo, blurredCount: r.blurredCount });
      setForm(r.analysis);
      setStep('confirm');
    } catch (e) {
      toast((e as Error).message);
      setStep('pick');
    }
  }

  async function submit() {
    if (!draft || !form || !pos) return;
    setStep('submitting');
    try {
      const fd = new FormData();
      fd.append('draftId', draft.id);
      fd.append('category', form.category);
      fd.append('severity', String(form.severity));
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('lat', String(pos.lat));
      fd.append('lng', String(pos.lng));
      fd.append('address', geo.address);
      fd.append('city', geo.city);
      fd.append('district', geo.district);
      const edited = await mosaic.current?.getBlob();
      if (edited) fd.append('image', edited, 'photo.jpg');
      const r = await api('/api/issues', { method: 'POST', body: fd });
      setDoneId(r.id);
      setStep('done');
    } catch (e) {
      toast((e as Error).message);
      setStep('confirm');
    }
  }

  return (
    <div className="min-h-full bg-[#f3f5f4] pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-white px-2 py-2 shadow-sm">
        <button onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))} className="grid h-11 w-11 place-items-center rounded-full text-2xl" aria-label="返回">
          ‹
        </button>
        <h1 className="text-[18px] font-semibold">随手拍</h1>
        {config?.aiMock && <span className="ml-auto mr-2 rounded bg-amber-100 px-2 py-0.5 text-[12px] text-amber-700">AI 模拟模式</span>}
      </header>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={albumInput} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {step === 'pick' && (
        <div className="p-5">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="text-5xl" aria-hidden>
              📷
            </p>
            <h2 className="mt-3 text-[20px] font-bold">拍下你看到的无障碍问题</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-500">盲道被占、坡道损坏、台阶没扶手、无障碍电梯故障……AI 会帮你识别、打码，并写好反映文本。</p>
            <button onClick={() => cameraInput.current?.click()} className="mt-6 w-full rounded-2xl bg-brand py-4 text-[18px] font-semibold text-white active:bg-brand-dark">
              拍照
            </button>
            <button onClick={() => albumInput.current?.click()} className="mt-3 w-full rounded-2xl border border-gray-300 py-3.5 text-[16px] text-gray-700">
              从相册选择
            </button>
          </div>
          <p className="mt-4 text-center text-[13px] text-gray-400">{pos ? (locError ? `⚠️ ${locError}` : '📍 已获取当前位置') : '📍 正在定位…'}</p>
          <div className="mt-6 rounded-2xl bg-white p-4 text-[14px] leading-relaxed text-gray-600 shadow-sm">
            <p className="mb-1 font-semibold text-gray-800">拍摄小贴士</p>
            <p>· 尽量让问题和周围环境同时入镜，方便定位</p>
            <p>· 注意安全，不要在车流中拍摄</p>
            <p>· 人脸、车牌会被自动打码，也可以手动补涂</p>
          </div>
        </div>
      )}

      {(step === 'analyzing' || step === 'rejected') && (
        <div className="p-5">
          <div className="relative overflow-hidden rounded-3xl bg-black">
            <img src={preview} alt="待识别照片" className={`w-full ${step === 'analyzing' ? 'opacity-80' : 'opacity-50'}`} />
            {step === 'analyzing' && (
              <div className="absolute inset-0">
                <div className="scan-line h-1/2 w-full border-b-4 border-emerald-300 bg-gradient-to-b from-transparent to-emerald-300/40" />
              </div>
            )}
          </div>
          {step === 'analyzing' ? (
            <div className="mt-5 text-center" role="status" aria-live="polite">
              <p className="text-[18px] font-semibold">AI 正在体检…</p>
              <p className="mt-1 text-[14px] text-gray-500">识别问题类型 · 评估严重程度 · 为人脸车牌打码</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-white p-5 text-center shadow-sm" role="alert">
              <p className="text-3xl">🤔</p>
              <p className="mt-2 text-[16px]">{reason}</p>
              <button onClick={() => setStep('pick')} className="mt-4 w-full rounded-xl bg-brand py-3 font-semibold text-white">
                重新拍一张
              </button>
            </div>
          )}
        </div>
      )}

      {(step === 'confirm' || step === 'submitting') && draft && form && (
        <div className="space-y-4 p-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-[14px] text-brand">
              ✅ AI 识别完成{draft.blurredCount > 0 ? `，已自动为 ${draft.blurredCount} 处人脸/车牌打码` : '，未发现需打码的人脸/车牌'}
            </p>
            <MosaicEditor ref={mosaic} src={assetUrl(draft.photo)} />
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">确认问题信息</h2>
            <label className="block">
              <span className="text-[14px] text-gray-500">问题类型</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-[16px]"
              >
                {(config?.categories || []).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICON[c]} {c}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-[14px] text-gray-500">严重程度</span>
              <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="严重程度">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={form.severity === s}
                    onClick={() => setForm({ ...form, severity: s })}
                    className={`rounded-xl border py-2.5 text-[15px] ${form.severity === s ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-gray-200'}`}
                  >
                    {SEVERITY_TEXT[s]}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-[14px] text-gray-500">标题</span>
              <input
                value={form.title}
                maxLength={20}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-[16px]"
              />
            </label>
            <label className="block">
              <span className="text-[14px] text-gray-500">描述（AI 生成，可修改）</span>
              <textarea
                value={form.description}
                rows={3}
                maxLength={200}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-[16px]"
              />
            </label>
            <p className="text-[13px] text-gray-500">
              建议反映渠道：<b>{form.channel}</b> · 可能的责任部门：<b>{form.department}</b>
            </p>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">确认位置</h2>
            {config?.tmapKey && pos ? (
              <>
                <MapView className="h-56 overflow-hidden rounded-xl" tmapKey={config.tmapKey} center={pos} zoom={17} onCenterChange={setPos} />
                <p className="mt-2 text-[13px] text-gray-500">拖动地图，让图钉对准问题所在位置</p>
              </>
            ) : null}
            <p className="mt-2 text-[15px]">📍 {geo.address || (pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '定位中…')}</p>
            {locError && <p className="mt-1 text-[13px] text-amber-700">⚠️ {locError}</p>}
          </section>

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-white/95 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <button
              onClick={submit}
              disabled={step === 'submitting' || !pos}
              className="w-full rounded-2xl bg-brand py-4 text-[18px] font-semibold text-white active:bg-brand-dark disabled:opacity-60"
            >
              {step === 'submitting' ? '正在提交并生成反映文本…' : '提交，标到地图上'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="p-5 text-center">
          <div className="rounded-3xl bg-white p-8 shadow-sm" role="status">
            <p className="text-6xl">🎉</p>
            <h2 className="mt-3 text-[22px] font-bold">标记成功！积分 +10</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600">谢谢你，体检官！这个问题已经出现在地图上，轮椅和视障朋友出门前就能提前避开。</p>
            <button onClick={() => nav(`/issue/${doneId}`, { replace: true })} className="mt-6 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white">
              📝 查看并复制 12345 反映文本
            </button>
            <button
              onClick={() => {
                setStep('pick');
                setDraft(null);
                setForm(null);
              }}
              className="mt-3 w-full rounded-2xl border border-gray-300 py-3.5 text-[16px]"
            >
              再拍一张
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
