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
        <div className="splash-logo relative grid h-20 w-20 place-items-center rounded-[24px] bg-gradient-to-br from-[#3b82f6] to-[#1677ff] shadow-[0_14px_34px_rgba(22,119,255,0.28)]">
          <svg viewBox="0 0 64 64" className="h-16 w-16">
            <path
              d="M16 49 C 24 38, 21 29, 32 23 S 44 14, 47 11"
              fill="none"
              stroke="#ffffff"
              strokeWidth="5.5"
              strokeLinecap="round"
              className="splash-path"
            />
            <circle cx="20" cy="45" r="2.2" fill="#93c5fd" className="splash-dot" style={{ animationDelay: '220ms' }} />
            <circle cx="25" cy="36" r="2.2" fill="#93c5fd" className="splash-dot" style={{ animationDelay: '340ms' }} />
            <circle cx="32" cy="24" r="2.4" fill="#ffffff" className="splash-dot" style={{ animationDelay: '460ms' }} />
            <circle cx="44" cy="14" r="3.2" fill="#fbbf24" className="splash-dot" style={{ animationDelay: '580ms' }} />
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
