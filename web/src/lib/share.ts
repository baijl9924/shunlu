import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * 海报保存/分享能力检测：
 * - native：新版 APK 内置 Filesystem + Share 原生插件，调起系统分享面板（可发微信 / 保存到相册）
 * - web：浏览器支持 Web Share Level 2（安卓 Chrome、iOS Safari 等），可分享图片文件
 * - none：只能用 <a download> 或长按保存
 * 旧版 APK 加载线上网页时没有这两个插件，会自动回退，不会报错。
 */
export type ShareMode = 'native' | 'web' | 'none';

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(head)?.[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

export function getShareMode(): ShareMode {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem') ? 'native' : 'none';
  }
  try {
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [probe] })) return 'web';
  } catch {
    /* 不支持 */
  }
  return 'none';
}

const isCancel = (e: unknown) => {
  const msg = String((e as Error)?.message || e || '').toLowerCase();
  return (e as Error)?.name === 'AbortError' || msg.includes('cancel') || msg.includes('abort');
};

/**
 * 原生 APK 内直接保存到系统相册：写入公共目录 Pictures/顺路/，Filesystem 插件会自动触发媒体扫描，相册里立即可见。
 * Android 11+ 无需任何存储权限；Android 10 及以下需要 WRITE_EXTERNAL_STORAGE（CI 中以 maxSdkVersion=29 声明）。
 */
export async function saveImageToGallery(dataUrl: string, baseName: string): Promise<string> {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const path = `Pictures/顺路/${baseName}-${stamp}.png`;
  await Filesystem.writeFile({
    path,
    data: dataUrl.split(',')[1],
    directory: Directory.ExternalStorage,
    recursive: true,
  });
  return path;
}

/** 分享 / 保存海报图片。返回 false 表示用户取消，抛错表示失败 */
export async function shareImage(dataUrl: string, fileName: string, title: string, text?: string): Promise<boolean> {
  const mode = getShareMode();
  try {
    if (mode === 'native') {
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: dataUrl.split(',')[1],
        directory: Directory.Cache,
      });
      await Share.share({ title, text, files: [uri], dialogTitle: '分享或保存海报' });
      return true;
    }
    if (mode === 'web') {
      await navigator.share({ title, text, files: [dataUrlToFile(dataUrl, fileName)] });
      return true;
    }
    throw new Error('当前环境不支持分享，请长按图片保存');
  } catch (e) {
    if (isCancel(e)) return false;
    throw e;
  }
}
