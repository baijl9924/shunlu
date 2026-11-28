import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Copy, Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';

type VersionInfo = { version: string; versionCode: number; notes: string; apkUrl: string };

const GITHUB_APK_URL = 'https://github.com/baijl9924/shunlu/releases/download/apk-latest/shunlu.apk';

/** 原生 APK 内检测服务端最新版本号，发现新壳版本时弹出升级横幅 */
export default function UpdateBanner() {
  const { toast } = useApp();
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [currentCode, setCurrentCode] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    Promise.all([CapApp.getInfo(), api<VersionInfo>('/api/version')])
      .then(([native, latest]) => {
        const cur = Number(native.build || 1);
        setCurrentCode(cur);
        const skipKey = `shunlu.skip_ver.${latest.versionCode}`;
        if (latest.versionCode > cur && !sessionStorage.getItem(skipKey)) {
          setInfo(latest);
        }
      })
      .catch(() => {});
  }, []);

  if (!info || dismissed) return null;

  // 旧版 APK（versionCode < 4）曾把 www.shunlu.cc.cd 写入 allowNavigation 且未挂载 DownloadListener，
  // 导致直链被 WebView 内部吞掉；旧壳改走未被 allowNavigation 拦截的 GitHub 直链拉起系统浏览器，并提供一键复制官网直链。
  const isLegacyShell = currentCode > 0 && currentCode < 4;
  const downloadHref = isLegacyShell ? GITHUB_APK_URL : info.apkUrl;

  function dismiss() {
    if (info) sessionStorage.setItem(`shunlu.skip_ver.${info.versionCode}`, '1');
    setDismissed(true);
  }

  function openDownload() {
    window.location.href = downloadHref;
  }

  async function copyDirectUrl() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.apkUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = info.apkUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('已复制官网直链，粘贴到手机浏览器下载更快');
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
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openDownload}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white active:bg-brand-dark"
            >
              <Download className="h-3.5 w-3.5" />
              {isLegacyShell ? '浏览器下载 APK' : '下载更新 APK'}
            </button>
            <button
              type="button"
              onClick={copyDirectUrl}
              className="inline-flex items-center gap-1 rounded-lg border border-brand/25 bg-brand-soft/45 px-2.5 py-1.5 text-[12px] font-medium text-brand active:bg-brand-soft"
            >
              <Copy className="h-3.5 w-3.5" />
              复制官网直链
            </button>
            <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1.5 text-[12px] text-slate-500">
              暂不
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
