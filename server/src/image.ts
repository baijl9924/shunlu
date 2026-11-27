import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** 图片中的隐私区域，坐标为相对原图宽高的千分比（0-1000） */
export type PrivacyBox = { type: 'face' | 'plate'; bbox: [number, number, number, number] };

export const AI_CANVAS = 1000;

/** 规范化：按 EXIF 旋转、去掉元数据（含 GPS）、限制尺寸 */
export async function normalize(input: Buffer): Promise<{ buf: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buf: data, width: info.width, height: info.height };
}

/**
 * 生成给 AI 的 1000x1000 正方形“信箱”图：长边缩放到 1000，短边居中补灰边。
 * 这样无论模型输出像素坐标还是千分比坐标，数值都一致。
 */
export async function toAiCanvas(buf: Buffer, width: number, height: number) {
  const scale = AI_CANVAS / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const left = Math.floor((AI_CANVAS - w) / 2);
  const top = Math.floor((AI_CANVAS - h) / 2);
  const resized = await sharp(buf).resize(w, h).toBuffer();
  const canvas = await sharp({
    create: { width: AI_CANVAS, height: AI_CANVAS, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([{ input: resized, left, top }])
    .jpeg({ quality: 80 })
    .toBuffer();
  return { canvas, scale, left, top };
}

/** 把 AI 画布上的框映射回原图像素坐标，并外扩 15% */
export function mapBoxToImage(
  bbox: [number, number, number, number],
  t: { scale: number; left: number; top: number },
  width: number,
  height: number,
) {
  let [x1, y1, x2, y2] = bbox.map(Number);
  if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v))) return null;
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];
  let left = (x1 - t.left) / t.scale;
  let top = (y1 - t.top) / t.scale;
  let w = (x2 - x1) / t.scale;
  let h = (y2 - y1) / t.scale;
  const padX = w * 0.15;
  const padY = h * 0.15;
  left = Math.max(0, Math.floor(left - padX));
  top = Math.max(0, Math.floor(top - padY));
  w = Math.min(width - left, Math.ceil(w + padX * 2));
  h = Math.min(height - top, Math.ceil(h + padY * 2));
  if (w < 4 || h < 4) return null;
  return { left, top, width: w, height: h };
}

/** 对指定区域打马赛克 */
export async function pixelate(
  buf: Buffer,
  regions: { left: number; top: number; width: number; height: number }[],
): Promise<Buffer> {
  if (!regions.length) return buf;
  const overlays = await Promise.all(
    regions.map(async (r) => {
      const block = Math.max(8, Math.round(Math.max(r.width, r.height) / 8));
      const small = await sharp(buf)
        .extract(r)
        .resize(Math.max(1, Math.round(r.width / block)), Math.max(1, Math.round(r.height / block)))
        .toBuffer();
      const big = await sharp(small).resize(r.width, r.height, { kernel: 'nearest' }).toBuffer();
      return { input: big, left: r.left, top: r.top };
    }),
  );
  return sharp(buf).composite(overlays).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

export function saveImage(buf: Buffer, sub = ''): string {
  const name = `${sub ? sub + '/' : ''}${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
  const full = path.join(UPLOAD_DIR, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  return name.replace(/\\/g, '/');
}

export function moveImage(name: string, sub: string): string {
  const target = `${sub}/${path.basename(name)}`;
  fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
  fs.renameSync(path.join(UPLOAD_DIR, name), path.join(UPLOAD_DIR, target));
  return target;
}
