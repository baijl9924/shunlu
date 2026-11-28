import { AlertCircle, Camera, CheckCircle2, ChevronLeft, FileText, Image as ImageIcon, Loader2, LocateFixed, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryIcon from '../components/CategoryIcon';
import MapView from '../components/MapView';
import MosaicEditor, { type MosaicHandle } from '../components/MosaicEditor';
import ReportTextCard from '../components/ReportTextCard';
import { api, fetchAuthedBlobUrl, SEVERITY_TEXT } from '../lib/api';
import { appHomePath } from '../App';
import { DEFAULT_CENTER, locate } from '../lib/geo';
import { compressImage } from '../lib/image';
import { useApp } from '../lib/store';

type Analysis = { category: string; severity: number; title: string; description: string; department: string; channel: string };
type Step = 'pick' | 'analyzing' | 'rejected' | 'confirm' | 'submitting' | 'done' | 'demoDone';
type Pos = { lat: number; lng: number };

const HINTS = ['盲道被占用', '缺少坡道或坡道损坏', '台阶没有扶手', '无障碍电梯故障', '无障碍停车位被占'];

export default function Capture() {
  const { config, isGuest, ensureSession, openAuth, userGeo, refreshGeo, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('pick');
  const [preview, setPreview] = useState('');
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState<{ id: string; photo: string; blurredCount: number; isDemo: boolean } | null>(null);
  const [form, setForm] = useState<Analysis | null>(null);
  const [demoReport, setDemoReport] = useState<{ reportText: string; channel: string; department: string } | null>(null);
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

  async function onFile(file?: File, isDemo = false) {
    if (!file) return;
    const ready = await ensureSession();
    if (!ready) return;
    setPreview(URL.createObjectURL(file));
    setStep('analyzing');
    try {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.append('image', blob, 'photo.jpg');
      if (isDemo) fd.append('demo', '1');
      const r = await api('/api/analyze', { method: 'POST', body: fd });
      if (!r.accept) {
        setReason(r.reason);
        setStep('rejected');
        return;
      }
      const blobUrl = await fetchAuthedBlobUrl(r.photo);
      setDraft({ id: r.draftId, photo: blobUrl, blurredCount: r.blurredCount, isDemo: !!r.isDemo });
      setForm(r.analysis);
      setDemoReport(null);
      setStep('confirm');
    } catch (e) {
      toast((e as Error).message);
      setStep('pick');
    }
  }

  async function runDemoSample() {
    try {
      const res = await fetch('/demo-barrier.jpg');
      if (!res.ok) throw new Error('示例图片加载失败');
      const blob = await res.blob();
      const file = new File([blob], 'demo-barrier.jpg', { type: 'image/jpeg' });
      await onFile(file, true);
    } catch (e) {
      toast((e as Error).message || '示例图加载失败');
    }
  }

  async function previewDemoReport() {
    if (!draft || !form) return;
    setStep('submitting');
    try {
      const r = await api<{ reportText: string; channel: string; department: string }>(`/api/drafts/${draft.id}/preview-report`, {
        method: 'POST',
        json: {
          category: form.category,
          severity: form.severity,
          title: form.title,
          description: form.description,
          address: geo.address || '示范路段人行道盲道处',
        },
      });
      setDemoReport(r);
      setStep('demoDone');
    } catch (e) {
      toast((e as Error).message);
      setStep('confirm');
    }
  }

  async function submit() {
    if (!draft || !form) return;
    if (draft.isDemo) {
      await previewDemoReport();
      return;
    }
    if (!pos) return;
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

  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav(appHomePath()));

  return (
    <div className="safe-bottom min-h-full bg-surface [--sb-pad:7rem]">
      <header className="safe-top sticky top-0 z-20 flex items-center gap-1 border-b border-slate-200/70 bg-white/95 px-2 pb-2 backdrop-blur-md [--st-pad:0.5rem]">
        <button onClick={goBack} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 transition active:scale-90 active:bg-slate-100" aria-label="返回">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[17px] font-semibold text-slate-900">记录路障</h1>
        <div className="ml-auto mr-2 flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-brand" />
          <span className="max-w-[140px] truncate">{geo.district || geo.city || (pos ? '已定位' : '定位中…')}</span>
        </div>
      </header>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          onFile(f, false);
        }}
      />
      <input
        ref={albumInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          onFile(f, false);
        }}
      />

      {step === 'pick' && (
        <div className="p-4">
          {/* 仿原生相机取景框 + 底部对称快门栏 */}
          <div className="relative flex aspect-[4/5] max-h-[60vh] w-full flex-col justify-between overflow-hidden rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(22,119,255,0.22),transparent_68%)]" />

            {/* 顶部隐私提示胶囊 */}
            <div className="relative z-10 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/85 backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
                免注册即拍 · 自动识别并打码人脸与车牌
              </span>
            </div>

            {/* 中央独立取景框（与底部按钮完全分离，互不重叠） */}
            <div className="relative z-10 mx-2 my-4 flex flex-1 flex-col items-center justify-center text-center">
              <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 rounded-tl-md border-l-2 border-t-2 border-white/45" />
              <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 rounded-tr-md border-r-2 border-t-2 border-white/45" />
              <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 rounded-bl-md border-b-2 border-l-2 border-white/45" />
              <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 rounded-br-md border-b-2 border-r-2 border-white/45" />
              <p className="text-[19px] font-semibold tracking-tight">对准路障拍一张</p>
              <p className="mt-1.5 max-w-[230px] text-[13px] leading-relaxed text-white/60">尽量让障碍物和周边路面同时入镜，方便定位核实</p>
              {geo.address && (
                <p className="mt-3 max-w-[260px] truncate rounded-full bg-black/25 px-3 py-1 text-[11px] text-white/70">
                  {geo.address}
                </p>
              )}
            </div>

            {/* 底部原生相机对称快门栏：左相册 · 中快门 · 右定位 */}
            <div className="relative z-10 grid grid-cols-3 items-center pt-1">
              <div className="flex justify-center">
                <button
                  onClick={() => albumInput.current?.click()}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90"
                  aria-label="从相册选取照片"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur-sm">
                    <ImageIcon className="h-5 w-5 text-white" />
                  </span>
                  <span className="text-[11px] text-white/75">相册</span>
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => cameraInput.current?.click()}
                  className="grid h-[76px] w-[76px] place-items-center rounded-full border-[3px] border-white/85 p-1.5 shadow-xl transition duration-150 active:scale-90"
                  aria-label="打开相机拍照"
                >
                  <span className="grid h-full w-full place-items-center rounded-full bg-white text-slate-900">
                    <Camera className="h-7 w-7" strokeWidth={2.1} />
                  </span>
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={async () => {
                    const g = await refreshGeo(false);
                    if (g) {
                      setPos({ lat: g.lat, lng: g.lng });
                      setGeo({ address: g.address, city: g.city, district: g.district });
                      toast(g.city ? `已更新位置：${g.city}${g.district}` : '位置已更新');
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90"
                  aria-label="刷新当前位置"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10 backdrop-blur-sm">
                    <LocateFixed className={`h-5 w-5 ${pos && !locError ? 'text-sky-300' : 'text-white/60'}`} />
                  </span>
                  <span className="text-[11px] text-white/75">{pos ? '已定位' : '定位中'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 零门槛示例图 AI 试玩入口（仅预览，不写入公共地图） */}
          <button
            type="button"
            onClick={runDemoSample}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-brand/20 bg-white p-3.5 text-left shadow-xs transition hover:border-brand/40 active:scale-[0.99]"
          >
            <img src="/demo-barrier.jpg" alt="示例路障照片" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[14px] font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                没有现成照片？用示例图试玩 AI 识别
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500">一键体验自动识别、人脸车牌打码与 12345 文本（仅预览不入图）</p>
            </div>
          </button>

          {/* 常见场景轻量提示 */}
          <div className="mt-4">
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
        <div className="page-enter p-4">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-md">
            <img src={preview} alt="现场照片预览" className={`max-h-[58vh] w-full object-contain ${step === 'rejected' ? 'opacity-50' : 'opacity-95'}`} />
            {step === 'analyzing' && (
              <>
                {/* 丝滑绿线扫描动效 */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="scan-beam h-1/3 w-full border-b-2 border-emerald-400 bg-gradient-to-b from-transparent via-emerald-400/10 to-emerald-400/35 shadow-[0_6px_24px_rgba(52,211,153,0.7)]" />
                </div>
                <div
                  className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900/75 px-4 py-2.5 text-[14px] font-medium text-white backdrop-blur-md"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  正在识别问题并保护人脸、车牌隐私…
                </div>
              </>
            )}
          </div>
          {step === 'rejected' && (
            <div className="sheet-up mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-xs" role="alert">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-amber-50 text-amber-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="mt-3 text-[15px] font-medium text-slate-800">{reason}</p>
              <button onClick={() => setStep('pick')} className="mt-4 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white transition active:scale-[0.98] active:bg-brand-dark">
                重新拍一张
              </button>
            </div>
          )}
        </div>
      )}

      {(step === 'confirm' || step === 'submitting') && draft && form && (
        <div className="page-enter space-y-3.5 p-4">
          {draft.isDemo && (
            <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-sky-800">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>
                <b>示例图试玩模式：</b>当前已由 AI 真实完成识别与人脸/车牌自动打码，继续点击下方按钮可预览生成的 12345 反映文本，<b>不会写入公共地图</b>。
              </p>
            </div>
          )}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-xs">
            <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {draft.blurredCount > 0 ? `已自动为 ${draft.blurredCount} 处人脸或车牌打码` : '已核验画面，未检测到清晰人脸或车牌'}
            </div>
            <MosaicEditor ref={mosaic} src={draft.photo} />
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
              <div className="relative mt-1 grid grid-cols-3 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="影响程度">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-lg bg-white shadow-xs transition-transform duration-200 ease-out"
                  style={{ transform: `translateX(${(form.severity - 1) * 100}%)` }}
                />
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={form.severity === s}
                    onClick={() => setForm({ ...form, severity: s })}
                    className={`relative z-10 rounded-lg py-2 text-[14px] font-medium transition-colors duration-200 ${
                      form.severity === s ? 'text-brand' : 'text-slate-500'
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

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-slate-200/80 bg-white/95 px-3.5 pt-3 backdrop-blur-md [--sb-pad:0.875rem]">
            {!draft.isDemo && isGuest && (
              <p className="mb-2 text-center text-[11px] text-slate-500">当前为访客体验（每日限发布 3 条真实标记），发布后可随时设昵称转正入榜</p>
            )}
            <button
              onClick={submit}
              disabled={step === 'submitting' || (!draft.isDemo && !pos)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[16px] font-semibold text-white shadow-sm shadow-brand/25 transition active:scale-[0.98] active:bg-brand-dark disabled:opacity-60"
            >
              {step === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 'submitting'
                ? draft.isDemo
                  ? '正在生成 12345 文本预览…'
                  : '正在提交…'
                : draft.isDemo
                  ? '生成 12345 反映文本预览'
                  : '提交，标到地图上'}
            </button>
          </div>
        </div>
      )}

      {step === 'demoDone' && draft && demoReport && (
        <div className="page-enter space-y-3.5 p-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-xs">
            <div className="mb-2 flex items-center justify-between gap-2 text-[13px] font-medium text-emerald-700">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {draft.blurredCount > 0 ? `示例图已自动打码 ${draft.blurredCount} 处隐私` : '示例图已完成 AI 隐私核验'}
              </span>
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand">试玩预览</span>
            </div>
            <img src={draft.photo} alt="示例图打码效果" className="max-h-56 w-full rounded-xl bg-slate-950 object-contain" />
          </section>

          <ReportTextCard text={demoReport.reportText} channel={demoReport.channel} previewMode />

          <div className="space-y-2.5 pt-1">
            <button
              onClick={() => {
                setStep('pick');
                setDraft(null);
                setForm(null);
                setDemoReport(null);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand/25 transition active:scale-[0.98]"
            >
              <Camera className="h-4 w-4" />
              拍一张真实路障试试
            </button>
            {isGuest && (
              <button
                onClick={() => openAuth('upgrade')}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-white py-3 text-[14px] font-semibold text-brand transition active:bg-brand-soft"
              >
                <Sparkles className="h-4 w-4" />
                升级正式账号，记录积分上排行榜
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="page-enter p-5 text-center">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-7 shadow-xs" role="status">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="mt-4 text-[20px] font-bold text-slate-900">已标记到地图</h2>
            <span className="mt-1.5 inline-block rounded-full bg-brand-soft px-3 py-0.5 text-[12px] font-semibold text-brand">
              {isGuest ? '已累计 +10 公益分（访客暂不入榜）' : '积分 +10'}
            </span>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500">这条记录已经同步到顺路地图，轮椅和视障朋友出门前就能提前看到。</p>
            <button
              onClick={() => nav(`/issue/${doneId}`, { replace: true })}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand/25 transition active:scale-[0.98]"
            >
              <FileText className="h-4 w-4" />
              查看 12345 反映文本
            </button>
            {isGuest && (
              <button
                onClick={() => openAuth('upgrade')}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand-soft/45 py-3 text-[14px] font-semibold text-brand transition active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                设个昵称转正，永久保存并入榜
              </button>
            )}
            <button
              onClick={() => {
                setStep('pick');
                setDraft(null);
                setForm(null);
              }}
              className="mt-2.5 w-full rounded-xl border border-slate-200 py-3 text-[15px] font-medium text-slate-700 transition active:scale-[0.98]"
            >
              再拍一张
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
