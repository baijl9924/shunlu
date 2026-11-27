import { Check, Paintbrush, Undo2 } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { loadImage } from '../lib/image';

export type MosaicHandle = { getBlob: () => Promise<Blob | null> };

/** 在照片上用手指涂抹马赛克 */
const MosaicEditor = forwardRef<MosaicHandle, { src: string }>(function MosaicEditor({ src }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const original = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    loadImage(src).then((img) => {
      original.current = img;
      reset();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function reset() {
    const img = original.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    setEdited(false);
  }

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    const ctx = c.getContext('2d')!;
    const block = Math.max(10, Math.round(c.width / 40));
    const radius = block * 2;
    for (let bx = x - radius; bx < x + radius; bx += block) {
      for (let by = y - radius; by < y + radius; by += block) {
        const gx = Math.floor(bx / block) * block;
        const gy = Math.floor(by / block) * block;
        if (gx < 0 || gy < 0 || gx >= c.width || gy >= c.height) continue;
        const [r, g, b] = ctx.getImageData(gx + block / 2, gy + block / 2, 1, 1).data;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(gx, gy, block, block);
      }
    }
    setEdited(true);
  }

  useImperativeHandle(ref, () => ({
    getBlob: () =>
      edited && canvasRef.current
        ? new Promise((resolve) => canvasRef.current!.toBlob((b) => resolve(b), 'image/jpeg', 0.88))
        : Promise.resolve(null),
  }));

  return (
    <div>
      <canvas
        ref={canvasRef}
        className={`w-full rounded-xl bg-slate-100 ${editing ? 'touch-none ring-2 ring-brand' : ''}`}
        aria-label="打码后的现场照片"
        onPointerDown={(e) => {
          if (!editing) return;
          drawing.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          paint(e);
        }}
        onPointerMove={(e) => editing && drawing.current && paint(e)}
        onPointerUp={() => (drawing.current = false)}
      />
      <div className="mt-2.5 flex gap-2 text-[13px]">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-medium transition ${
            editing ? 'bg-brand text-white' : 'border border-slate-200 bg-white text-slate-700'
          }`}
        >
          {editing ? <Check className="h-4 w-4" /> : <Paintbrush className="h-4 w-4" />}
          {editing ? '完成涂抹' : '手动补涂马赛克'}
        </button>
        {edited && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-600"
          >
            <Undo2 className="h-4 w-4" />
            撤销
          </button>
        )}
      </div>
      {editing && <p className="mt-1.5 text-[12px] text-slate-500">用手指在照片上涂抹需要遮挡的人脸或车牌</p>}
    </div>
  );
});

export default MosaicEditor;
