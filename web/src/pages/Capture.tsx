import { AlertCircle, Camera, CheckCircle2, ChevronLeft, FileText, Image as ImageIcon, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryIcon from '../components/CategoryIcon';
import MapView from '../components/MapView';
import MosaicEditor, { type MosaicHandle } from '../components/MosaicEditor';
import { api, assetUrl, SEVERITY_TEXT } from '../lib/api';
import { DEFAULT_CENTER, locate } from '../lib/geo';
import { compressImage } from '../lib/image';
import { useApp } from '../lib/store';

type Analysis = { category: string; severity: number; title: string; description: string; department: string; channel: string };
type Step = 'pick' | 'analyzing' | 'rejected' | 'confirm' | 'submitting' | 'done';
type Pos = { lat: number; lng: number };

const HINTS = ['盲道被占用', '缺少坡道或坡道损坏', '台阶没有扶手', '无障碍电梯故障', '无障碍停车位被占'];

export default function Capture() {
  const { config, userGeo, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('pick');
  const [preview, setPreview] = useState('');
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState<{ id: string; photo: string; blurredCount: number } | null>(null);
  const [form, setForm] = useState<Analysis | null>(null);
  const [pos, setPos] = useState<Pos | null>(() => (userGeo ? { lat: userGeo.lat, lng: userGeo.lng } : null));
  const [locError, setLocError] = useState('');
  const [geo, setGeo] = useState({ address: userGeo?.address || '', city: userGeo?.city || '', district: userGeo?.district || '' });
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

  useEffect(() => {
    if (!pos) return;
    const t = window.setTimeout(() => {
      api(`/api/geocode?lat=${pos.lat}&lng=${pos.lng}`).then(setGeo).catch(() => {});
    }, 350);
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

  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'));

  return (
    <div className="min-h-full bg-surface pb-28">
      <header className="safe-top sticky top-0 z-20 flex items-center gap-1 border-b border-slate-200/70 bg-white/95 px-2 py-2 backdrop-blur-md">
        <button onClick={goBack} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 active:bg-slate-100" aria-label="返回">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[17px] font-semibold text-slate-900">记录路障</h1>
        <div className="ml-auto mr-2 flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-brand" />
          <span className="max-w-[140px] truncate">{geo.district || geo.city || (pos ? '已定位' : '定位中…')}</span>
        </div>
      </header>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={albumInput} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {step === 'pick' && (
        <div className="p-4">
          {/* 取景框风格拍照主区域 */}
          <div className="relative flex aspect-[4/5] max-h-[58vh] w-full flex-col items-center justify-between overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(22,119,255,0.22),transparent_68%)]" />
            {/* 四角取景框线 */}
            <span className="pointer-events-none absolute left-5 top-5 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-white/40" />
            <span className="pointer-events-none absolute right-5 top-5 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-white/40" />
            <span className="pointer-events-none absolute bottom-5 left-5 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-white/40" />
            <span className="pointer-events-none absolute bottom-5 right-5 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-white/40" />

            <div className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/85 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
              自动识别问题并打码人脸、车牌
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <button
                onClick={() => cameraInput.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-full bg-white text-slate-900 shadow-xl ring-8 ring-white/20 transition active:scale-95"
                aria-label="打开相机拍照"
              >
                <Camera className="h-8 w-8" strokeWidth={2} />
              </button>
              <p className="mt-5 text-[18px] font-semibold">拍下现场照片</p>
              <p className="mt-1 text-[13px] text-white/65">尽量拍到路障和周围环境，方便核实位置</p>
            </div>

            <div className="relative z-10 flex w-full items-center justify-between gap-2 pt-2">
              <button
                onClick={() => albumInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition active:bg-white/20"
              >
                <ImageIcon className="h-4 w-4" />
                从相册选取
              </button>
              <span className="truncate text-[12px] text-white/60">
                {geo.address || (locError ? '位置待手动调整' : pos ? '当前位置就绪' : '正在定位…')}
              </span>
            </div>
          </div>

          {/* 可记录的常见场景（轻量视觉提示） */}
          <div className="mt-5">
            <p className="mb-2.5 px-1 text-[12px] font-medium text-slate-500">常见可记录场景</p>
            <div className="flex flex-wrap gap-2">
              {HINTS.map((h) => (
                <span key={h} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] text-slate-600">
                  <CategoryIcon category={h} className="h-3.5 w-3.5 text-brand" />
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(step === 'analyzing' || step === 'rejected') && (
        <div className="p-4">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-sm">
            <img src={preview} alt="现场照片预览" className={`max-h-[58vh] w-full object-contain ${step === 'rejected' ? 'opacity-50' : 'opacity-90'}`} />
            {step === 'analyzing' && (
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900/80 px-4 py-3 text-[14px] font-medium text-white backdrop-blur-md" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                正在识别画面并处理隐私区域…
              </div>
            )}
          </div>
          {step === 'rejected' && (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-xs" role="alert">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-amber-50 text-amber-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="mt-3 text-[15px] font-medium text-slate-800">{reason}</p>
              <button onClick={() => setStep('pick')} className="mt-4 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white active:bg-brand-dark">
                重新拍一张
              </button>
            </div>
          )}
        </div>
      )}

      {(step === 'confirm' || step === 'submitting') && draft && form && (
        <div className="space-y-3.5 p-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-xs">
            <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {draft.blurredCount > 0 ? `已自动为 ${draft.blurredCount} 处人脸或车牌打码` : '已核验画面，未检测到清晰人脸或车牌'}
            </div>
            <MosaicEditor ref={mosaic} src={assetUrl(draft.photo)} />
          </section>

          <section className="space-y-3.5 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <h2 className="text-[15px] font-semibold text-slate-900">核对问题信息</h2>
            <label className="block">
              <span className="text-[12px] font-medium text-slate-500">问题类型</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-brand focus:bg-white"
              >
                {(config?.categories || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-[12px] font-medium text-slate-500">影响程度</span>
              <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="影响程度">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={form.severity === s}
                    onClick={() => setForm({ ...form, severity: s })}
                    className={`rounded-xl border py-2 text-[14px] font-medium transition ${
                      form.severity === s ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {SEVERITY_TEXT[s]}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-[12px] font-medium text-slate-500">标题</span>
              <input
                value={form.title}
                maxLength={20}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[15px] outline-none focus:border-brand focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-slate-500">现场说明（可修改）</span>
              <textarea
                value={form.description}
                rows={3}
                maxLength={200}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[15px] outline-none focus:border-brand focus:bg-white"
              />
            </label>
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
              建议反映渠道：<b className="text-slate-700">{form.channel}</b> · 责任部门参考：<b className="text-slate-700">{form.department}</b>
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <h2 className="mb-2.5 text-[15px] font-semibold text-slate-900">确认位置</h2>
            {config?.tmapKey && pos ? (
              <>
                <MapView className="h-52 overflow-hidden rounded-xl" tmapKey={config.tmapKey} center={pos} zoom={17} onCenterChange={setPos} />
                <p className="mt-2 text-[12px] text-slate-500">拖动地图微调图钉位置</p>
              </>
            ) : null}
            <p className="mt-2 flex items-start gap-1.5 text-[14px] text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>{geo.address || (pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '定位中…')}</span>
            </p>
            {locError && <p className="mt-1 text-[12px] text-amber-600">{locError}</p>}
          </section>

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-slate-200/80 bg-white/95 p-3.5 backdrop-blur-md">
            <button
              onClick={submit}
              disabled={step === 'submitting' || !pos}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[16px] font-semibold text-white shadow-sm shadow-brand/25 transition active:bg-brand-dark disabled:opacity-60"
            >
              {step === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 'submitting' ? '正在提交…' : '提交，标到地图上'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="p-5 text-center">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-7 shadow-xs" role="status">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="mt-4 text-[20px] font-bold text-slate-900">已标记到地图</h2>
            <span className="mt-1.5 inline-block rounded-full bg-brand-soft px-3 py-0.5 text-[12px] font-semibold text-brand">积分 +10</span>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500">这条记录已经同步到顺路地图，轮椅和视障朋友出门前就能提前看到。</p>
            <button
              onClick={() => nav(`/issue/${doneId}`, { replace: true })}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand/25"
            >
              <FileText className="h-4 w-4" />
              查看 12345 反映文本
            </button>
            <button
              onClick={() => {
                setStep('pick');
                setDraft(null);
                setForm(null);
              }}
              className="mt-2.5 w-full rounded-xl border border-slate-200 py-3 text-[15px] font-medium text-slate-700"
            >
              再拍一张
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
