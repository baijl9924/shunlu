import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Stats = { issues: number; fixed: number };

/** 冷启动暖心开屏缓冲（约 1.4s，后台同步加载地图与定位后丝滑渐隐） */
export default function Splash() {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    api<Stats>('/api/stats')
      .then((s) => alive && setStats(s))
      .catch(() => {});
    const t1 = window.setTimeout(() => setPhase('fade'), 1380);
    const t2 = window.setTimeout(() => setPhase('gone'), 1820);
    return () => {
      alive = false;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[1200] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#f4f8ff] via-white to-[#f7f8fa] px-6 py-16 transition-all duration-400 ease-out ${
        phase === 'fade' ? 'scale-[1.03] opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      {/* 柔和晴空光晕 */}
      <div className="absolute top-[22%] h-64 w-64 rounded-full bg-brand/10 blur-3xl" />

      <div />

      {/* 中央品牌动效 */}
      <div className="relative flex flex-col items-center text-center">
        <div className="splash-logo relative h-24 w-24 overflow-hidden rounded-[26px] shadow-[0_16px_38px_rgba(22,119,255,0.28)]">
          <svg viewBox="0 0 128 128" className="h-full w-full">
            <defs>
              <linearGradient id="sp-bg" x1="12" y1="6" x2="116" y2="124" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4da3ff" />
                <stop offset="52%" stopColor="#1677ff" />
                <stop offset="100%" stopColor="#0a4ec4" />
              </linearGradient>
              <radialGradient id="sp-glow" cx="82" cy="40" r="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sp-road" x1="28" y1="106" x2="82" y2="66" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#dbeafe" />
              </linearGradient>
              <linearGradient id="sp-gold" x1="0" y1="-12" x2="0" y2="8" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#ea8c00" />
              </linearGradient>
            </defs>
            <rect width="128" height="128" rx="32" fill="url(#sp-bg)" />
            <rect width="128" height="128" rx="32" fill="url(#sp-glow)" />
            <rect x="2" y="2" width="124" height="124" rx="30" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2" />

            <g fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.8">
              <circle cx="82" cy="42" r="24" />
              <circle cx="82" cy="42" r="44" strokeDasharray="6 6" />
              <circle cx="82" cy="42" r="66" />
            </g>
            <path d="M18 68 H44 M96 86 H112 M34 22 V42" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2.2" strokeLinecap="round" />

            <path
              d="M26 105 C32 82, 48 73, 80 67 C60 76, 48 86, 46 105 C44 110, 25 110, 26 105 Z"
              fill="#07348a"
              fillOpacity="0.22"
              transform="translate(2, 4)"
            />
            <path
              d="M26 105 C32 82, 48 73, 80 67 C60 76, 48 86, 46 105 C44 110, 25 110, 26 105 Z"
              fill="url(#sp-road)"
            />
            <g fill="#f59e0b">
              <rect x="33.5" y="92.5" width="4.8" height="9.5" rx="2.4" transform="rotate(14 36 97)" className="splash-dot" style={{ animationDelay: '180ms' }} />
              <rect x="42.5" y="81.5" width="4.2" height="8" rx="2.1" transform="rotate(42 44.5 85.5)" className="splash-dot" style={{ animationDelay: '280ms' }} />
              <circle cx="55.5" cy="76" r="2.4" className="splash-dot" style={{ animationDelay: '360ms' }} />
              <circle cx="65.5" cy="71.5" r="2" className="splash-dot" style={{ animationDelay: '440ms' }} />
            </g>

            <ellipse cx="82" cy="67" rx="10" ry="3.6" fill="#ffffff" fillOpacity="0.28" className="splash-dot" style={{ animationDelay: '360ms' }} />
            <g transform="translate(82, 42)" className="splash-dot" style={{ animationDelay: '320ms' }}>
              <circle cx="0" cy="0" r="21" fill="#ffffff" fillOpacity="0.16" />
              <path
                d="M0 -22 C11.5 -22, 19 -13.5, 19 -3 C19 9.5, 5.5 19.5, 0 24.5 C-5.5 19.5, -19 9.5, -19 -3 C-19 -13.5, -11.5 -22, 0 -22 Z"
                fill="#ffffff"
              />
              <circle cx="0" cy="-3" r="9.5" fill="url(#sp-gold)" />
              <path d="M-4.2 -3 L-1.2 0 L4.5 -5.8" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        </div>

        <h1
          className="splash-text font-splash-brush mt-5 bg-gradient-to-br from-slate-900 via-slate-800 to-brand bg-clip-text text-[46px] font-normal leading-none tracking-[0.18em] text-transparent"
          style={{ animationDelay: '180ms' }}
        >
          顺路
        </h1>
        <p
          className="splash-text font-splash-tagline mt-3 text-[18px] tracking-[0.2em] text-slate-600"
          style={{ animationDelay: '340ms' }}
        >
          顺路 · 让每条路都顺
        </p>

        {/* 底部渐入实时公益数据 */}
        <div
          className="splash-text mt-6 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/85 px-4 py-1.5 text-[13px] text-slate-600 shadow-xs backdrop-blur-sm"
          style={{ animationDelay: '520ms' }}
        >
          <span className="h-2 w-2 rounded-full bg-brand" />
          {stats && stats.issues > 0 ? (
            <span>
              已帮大家记录 <b className="font-semibold text-brand">{stats.issues}</b> 处路障
              {stats.fixed > 0 ? (
                <>
                  {' '}
                  · <b className="font-semibold text-emerald-600">{stats.fixed}</b> 处已整改
                </>
              ) : null}
            </span>
          ) : (
            <span>随手拍下路障，点亮无障碍出行地图</span>
          )}
        </div>
      </div>

      {/* 底部极简署名 */}
      <p className="splash-text text-[11px] tracking-widest text-slate-400" style={{ animationDelay: '450ms' }}>
        AI 向善 · 城市无障碍共治
      </p>
    </div>
  );
}
