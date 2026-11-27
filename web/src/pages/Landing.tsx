import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Github,
  Globe,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CategoryIcon from '../components/CategoryIcon';
import { StatusBadge } from '../components/IssueCard';
import { api, assetUrl, type Issue } from '../lib/api';

type Stats = { issues: number; fixed: number; confirmations: number; cities: number; users: number };

const APK_URL = '/shunlu.apk';
const GITHUB_URL = 'https://github.com/baijl9924/shunlu';
const RELEASE_URL = 'https://github.com/baijl9924/shunlu/releases/tag/apk-latest';

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [qrApk, setQrApk] = useState('');
  const [qrWeb, setQrWeb] = useState('');

  useEffect(() => {
    api<Stats>('/api/stats').then(setStats).catch(() => {});
    api<Issue[]>('/api/issues')
      .then((list) => setIssues(list.slice(0, 4)))
      .catch(() => {});

    const origin = location.origin;
    QRCode.toDataURL(`${origin}${APK_URL}`, { margin: 1, width: 180, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrApk)
      .catch(() => {});
    QRCode.toDataURL(`${origin}/`, { margin: 1, width: 180, color: { dark: '#1677ff', light: '#ffffff' } })
      .then(setQrWeb)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-full bg-[#f7f8fa] text-slate-900">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="#top" className="flex items-center gap-2.5">
            <img src="/logo.svg" width={36} height={36} alt="顺路图标" className="rounded-xl shadow-xs" />
            <div className="flex items-baseline gap-2">
              <span className="font-splash-brush text-[24px] leading-none text-slate-900">顺路</span>
              <span className="hidden rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand sm:inline-block">
                AI 青年行 · 2026 高校好事计划
              </span>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-[14px] font-medium text-slate-600 md:flex" aria-label="官网导航">
            <a href="#features" className="transition hover:text-brand">
              核心能力
            </a>
            <a href="#workflow" className="transition hover:text-brand">
              使用流程
            </a>
            <Link to="/report" className="transition hover:text-brand">
              城市体检报告
            </Link>
            <a href="#download" className="transition hover:text-brand">
              下载安装包
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href={APK_URL}
              download="顺路.apk"
              className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:border-brand hover:text-brand sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" />
              下载 APK
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-brand/25 transition hover:bg-brand-dark"
            >
              在线体验
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero 主视觉 */}
      <section id="top" className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-[#eef5ff] via-white to-[#f7f8fa]">
        <div className="pointer-events-none absolute -top-24 right-1/4 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-12 lg:py-20">
          {/* 左侧文案与下载入口 */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/90 px-3.5 py-1 text-[12px] font-medium text-brand shadow-2xs">
              <Sparkles className="h-3.5 w-3.5" />
              AI 向善 · 城市无障碍环境共治产品
            </div>

            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.18] tracking-tight text-slate-900 sm:text-[46px]">
              随手拍一张，
              <br />
              <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">让每条回家的路都少一道坎</span>
            </h1>

            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-slate-600">
              在街头看到盲道被占、坡道破损或台阶缺少扶手？打开「顺路」拍一张，AI 自动识别问题与严重程度、为人脸和车牌打码、标上无障碍地图，并一键写好 12345 / 12315 规范反映文本，帮轮椅使用者、视障朋友和推婴儿车的家庭提前避障、推动整改。
            </p>

            {/* 主下载与在线体验按钮 */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <a
                href={APK_URL}
                download="顺路.apk"
                className="inline-flex items-center gap-2.5 rounded-2xl bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark active:scale-[0.98]"
              >
                <Download className="h-5 w-5" />
                <span>
                  下载 Android 安装包
                  <span className="ml-1.5 text-[12px] font-normal text-white/80">APK · 4.3 MB</span>
                </span>
              </a>

              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-[15px] font-semibold text-slate-800 shadow-xs transition hover:border-brand/40 hover:text-brand active:scale-[0.98]"
              >
                <Globe className="h-5 w-5 text-brand" />
                免安装 · 打开 H5 网页版
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                全程免费 · 免注册即用
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand" />
                人脸与车牌自动打码
              </span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-600 hover:text-brand">
                <Github className="h-4 w-4" />
                开源代码
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* 桌面扫码卡片 */}
            <div className="mt-8 hidden max-w-md grid-cols-2 gap-3.5 sm:grid">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
                {qrApk ? <img src={qrApk} alt="扫码下载安卓 APK" className="h-16 w-16 shrink-0 rounded-lg" /> : <div className="h-16 w-16 rounded-lg bg-slate-100" />}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">扫码下载 APK</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">安卓手机扫码直接下载安装体验</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
                {qrWeb ? <img src={qrWeb} alt="扫码打开 H5 网页版" className="h-16 w-16 shrink-0 rounded-lg" /> : <div className="h-16 w-16 rounded-lg bg-slate-100" />}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">扫码体验 H5</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">iOS / 安卓微信浏览器直接打开</p>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧手机实景数据展示模型 */}
          <div className="flex justify-center lg:col-span-5">
            <div className="relative w-full max-w-[330px] rounded-[42px] border-[8px] border-slate-900 bg-[#f7f8fa] shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
              {/* 顶部听筒槽 */}
              <div className="mx-auto mt-2.5 h-5 w-24 rounded-full bg-slate-900" />

              {/* 模拟应用顶部胶囊 */}
              <div className="px-3.5 pb-4 pt-3">
                <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-900/5">
                  <img src="/logo.svg" width={28} height={28} alt="" className="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold text-slate-900">顺路</span>
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">实时共治</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {stats ? `${stats.issues} 处记录 · ${stats.fixed} 处已整改` : '连接实时无障碍地图…'}
                    </p>
                  </div>
                  <Link to="/" className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white">
                    进入
                  </Link>
                </div>

                {/* 实时近期上报卡片 */}
                <p className="mb-2 mt-3.5 px-1 text-[11px] font-semibold text-slate-400">最新市民实拍记录</p>
                <div className="space-y-2">
                  {issues.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      to={`/issue/${item.id}`}
                      className="flex items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-white p-2 shadow-2xs transition hover:border-brand/40"
                    >
                      <img src={assetUrl(item.photo)} alt={item.title} className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={item.status} />
                          <span className="inline-flex items-center gap-0.5 truncate text-[10px] text-slate-500">
                            <CategoryIcon category={item.category} className="h-3 w-3" />
                            {item.category}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">{item.title}</p>
                        <p className="truncate text-[11px] text-slate-400">{item.address}</p>
                      </div>
                    </Link>
                  ))}
                  {issues.length === 0 && (
                    <div className="rounded-2xl bg-white p-6 text-center text-[12px] text-slate-400">正在加载实时记录…</div>
                  )}
                </div>

                {/* 底部随手拍入口预览 */}
                <Link
                  to="/capture"
                  className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-[13px] font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark"
                >
                  <Camera className="h-4 w-4" />
                  立即随手拍体验
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 实时共治数据条 */}
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-9 sm:grid-cols-4">
          <Metric value={stats ? stats.issues : '—'} label="已标记无障碍问题" />
          <Metric value={stats ? stats.fixed : '—'} label="已核实推动整改" accent="text-emerald-600" />
          <Metric value={stats ? stats.confirmations : '—'} label="市民「我也遇到」确认" />
          <Metric value={stats ? stats.cities : '—'} label="已覆盖城市" />
        </div>
      </section>

      {/* 核心能力 */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold text-brand">核心能力</p>
          <h2 className="mt-1.5 text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">
            把做好事变成顺手 10 秒的小事
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">
            不做孤立的新投诉平台，而是用 AI 帮每一位普通市民大幅降低记录与反馈门槛，让数据同时服务于残障人士避障与市政整改。
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <FeatureCard
            icon={Camera}
            title="随手拍 · AI 视觉识别与内容审核"
            desc="接入通义千问视觉大模型，拍下照片后自动判断问题分类（盲道、坡道、扶手、电梯等）、评估安全隐患等级、撰写客观现场说明，同时自动过滤无关或不当图片。"
          />
          <FeatureCard
            icon={ShieldCheck}
            title="隐私优先 · 自动打码与本地资料卡"
            desc="AI 自动定位画面中的行人面孔与机动车车牌，服务端即时打码，也支持手指手动补涂；举报人姓名与电话仅存于用户本机，不上传服务器。"
          />
          <FeatureCard
            icon={FileText}
            title="AI 填单助手 · 对接 12345 / 12315"
            desc="自动援引《中华人民共和国无障碍环境建设法》，按场景智能推荐 12345 政务热线、12315 或最高检「益心为公」，一键复制文本或直接拨号提交。"
          />
          <FeatureCard
            icon={BarChart3}
            title="城市无障碍体检报告 · 看见改变"
            desc="按城市与区县实时汇总问题分布、计算无障碍健康度评分，由 AI 生成可落地的整改建议，支持一键生成高清分享长图或导出 PDF 递交相关部门。"
          />
        </div>
      </section>

      {/* 使用流程 */}
      <section id="workflow" className="border-y border-slate-200/70 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <p className="text-[13px] font-semibold text-brand">三步完成一次无障碍体检</p>
            <h2 className="mt-1.5 text-[26px] font-bold tracking-tight text-slate-900 sm:text-[30px]">发现、反映、复查形成闭环</h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <StepCard num="01" icon={Camera} title="拍下路障现场" desc="路过盲道被占、坡道损坏或台阶缺扶手时随手拍照，自动获取精准位置。" />
            <StepCard num="02" icon={ShieldCheck} title="AI 识别与隐私打码" desc="几秒内完成分类评级、人脸车牌自动马赛克，核对无误后标上城市无障碍地图。" />
            <StepCard num="03" icon={Users} title="众包确认与回头看" desc="一键复制 12345 反映文本推动解决，其他路人可点击「我也遇到」并拍复查照确认已整改。" />
          </div>
        </div>
      </section>

      {/* 专属下载安装区 */}
      <section id="download" className="mx-auto max-w-6xl px-5 py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-7 text-white shadow-xl sm:p-11">
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium">
                <Smartphone className="h-3.5 w-3.5" />
                Android 客户端 & 全平台 H5
              </div>
              <h2 className="mt-3 text-[28px] font-bold tracking-tight sm:text-[34px]">立即获取「顺路」安装包</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-white/85">
                安卓手机推荐下载原生封装 APK，支持手势返回、三键虚拟导航栏自适应与快速调用相机；苹果手机或电脑端可直接打开 H5 网页版，功能完全一致。
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={APK_URL}
                  download="顺路.apk"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[15px] font-bold text-brand shadow-md transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <Download className="h-5 w-5" />
                  直接下载顺路.apk（4.3 MB）
                </a>
                <a
                  href={RELEASE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3.5 text-[14px] font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
                >
                  <Github className="h-4 w-4" />
                  GitHub 备用下载
                </a>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3.5 text-[14px] font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
                >
                  <MapPin className="h-4 w-4" />
                  打开 H5 网页版
                </Link>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed text-white/75">
                安装提示：本安装包为赛事公开体验版（未上架商业应用商店），安卓系统安装时若提示「允许安装未知来源应用」，点击允许即可；iOS 用户可在 Safari 打开 H5 后「添加到主屏幕」。
              </p>
            </div>

            <div className="flex justify-center gap-4 lg:col-span-5 lg:justify-end">
              <div className="rounded-2xl bg-white p-3.5 text-center text-slate-900 shadow-lg">
                {qrApk ? <img src={qrApk} alt="扫码下载安卓 APK" className="mx-auto h-32 w-32 rounded-lg" /> : <div className="h-32 w-32 rounded-lg bg-slate-100" />}
                <p className="mt-2 text-[13px] font-bold">Android APK</p>
                <p className="text-[11px] text-slate-500">手机扫码直接下载</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 text-center text-slate-900 shadow-lg">
                {qrWeb ? <img src={qrWeb} alt="扫码体验 H5" className="mx-auto h-32 w-32 rounded-lg" /> : <div className="h-32 w-32 rounded-lg bg-slate-100" />}
                <p className="mt-2 text-[13px] font-bold">H5 网页版</p>
                <p className="text-[11px] text-slate-500">iOS / 微信免安装</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t border-slate-200/80 bg-white py-8 text-[13px] text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" width={24} height={24} alt="" className="rounded-md" />
            <span className="font-semibold text-slate-800">顺路</span>
            <span>· 随手拍，让每条路都顺</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/" className="hover:text-brand">
              无障碍地图
            </Link>
            <Link to="/report" className="hover:text-brand">
              城市体检报告
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-brand">
              GitHub 开源
            </a>
            <Link to="/admin" className="hover:text-brand">
              管理后台
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Metric({ value, label, accent }: { value: number | string; label: string; accent?: string }) {
  return (
    <div className="text-center">
      <p className={`text-[32px] font-extrabold tracking-tight sm:text-[38px] ${accent || 'text-slate-900'}`}>{value}</p>
      <p className="mt-1 text-[13px] text-slate-500">{label}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:border-brand/30 hover:shadow-md">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-[17px] font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}

function StepCard({ num, icon: Icon, title, desc }: { num: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-[#f7f8fa] p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] font-bold text-brand">STEP {num}</span>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand shadow-2xs">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <h3 className="mt-4 text-[17px] font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}
