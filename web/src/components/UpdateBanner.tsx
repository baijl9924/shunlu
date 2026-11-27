import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type VersionInfo = { version: string; versionCode: number; notes: string; apkUrl: string };

/** 原生 APK 内检测服务端最新版本号，发现新壳版本时弹出升级横幅 */
export default function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    Promise.all([CapApp.getInfo(), api<VersionInfo>('/api/version')])
      .then(([native, latest]) => {
        const currentCode = Number(native.build || 1);
        const skipKey = `shunlu.skip_ver.${latest.versionCode}`;
        if (latest.versionCode > currentCode && !sessionStorage.getItem(skipKey)) {
          setInfo(latest);
        }
      })
      .catch(() => {});
  }, []);

  if (!info || dismissed) return null;

  function dismiss() {
    if (info) sessionStorage.setItem(`shunlu.skip_ver.${info.versionCode}`, '1');
    setDismissed(true);
  }

  return (
    <div className="sheet-up fixed inset-x-3 bottom-20 z-[950] mx-auto max-w-md rounded-2xl border border-brand/20 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-bold text-slate-900">发现新版本 v{info.version}</p>
            <button onClick={dismiss} className="grid h-6 w-6 place-items-center rounded-full text-slate-400" aria-label="稍后再说">
              <X className="h-4 w-4" />
            </button>
          </div>
          {info.notes && <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">{info.notes}</p>}
          <div className="mt-2.5 flex items-center gap-2">
            <a
              href={info.apkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white"
            >
              <Download className="h-3.5 w-3.5" />
              下载更新 APK
            </a>
            <button onClick={dismiss} className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500">
              暂不更新
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
