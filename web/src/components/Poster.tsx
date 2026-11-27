import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type Props = { nickname: string; level: string; issues: number; confirmed: number; fixed: number; onClose: () => void };

/** 生成分享海报（Canvas 绘制） */
export default function Poster({ nickname, level, issues, confirmed, fixed, onClose }: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    (async () => {
      const W = 750;
      const H = 1200;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0f7b55');
      g.addColorStop(1, '#0a4f37');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 装饰：盲道圆点
      ctx.fillStyle = 'rgba(251,191,36,0.18)';
      for (let x = 40; x < W; x += 60) for (let y = 40; y < 300; y += 60) (ctx.beginPath(), ctx.arc(x, y, 10, 0, Math.PI * 2), ctx.fill());

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 76px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('顺路', 60, 150);
      ctx.font = '32px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('随手拍，让每条路都顺', 60, 210);

      // 卡片
      ctx.fillStyle = '#fff';
      roundRect(ctx, 50, 300, W - 100, 600, 36);
      ctx.fill();
      ctx.fillStyle = '#1f2933';
      ctx.font = 'bold 44px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(nickname, 100, 390);
      ctx.fillStyle = '#0f7b55';
      ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(`🏅 ${level}`, 100, 445);

      const items = [
        [issues, '标记问题'],
        [confirmed, '获得确认'],
        [fixed, '推动整改'],
      ] as const;
      items.forEach(([n, label], i) => {
        const x = 100 + i * 190;
        ctx.fillStyle = '#0f7b55';
        ctx.font = 'bold 72px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(String(n), x, 580);
        ctx.fillStyle = '#6b7280';
        ctx.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x, 625);
      });

      ctx.fillStyle = '#374151';
      ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif';
      wrap(ctx, `我在顺路标记了 ${issues} 个无障碍问题，帮轮椅、视障朋友和推婴儿车的家长提前避开路障。`, 100, 720, W - 200, 46);

      // 二维码
      const qr = await QRCode.toDataURL(location.origin, { margin: 1, width: 220, color: { dark: '#0a4f37', light: '#ffffff' } });
      const img = new Image();
      img.src = qr;
      await img.decode();
      ctx.fillStyle = '#fff';
      roundRect(ctx, 60, 950, 200, 200, 20);
      ctx.fill();
      ctx.drawImage(img, 70, 960, 180, 180);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('扫码一起体检', 300, 1030);
      ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('看到路障，拍一张就是做好事', 300, 1080);

      setUrl(c.toDataURL('image/png'));
    })();
  }, [nickname, level, issues, confirmed, fixed]);

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/80 p-6" role="dialog" aria-modal aria-label="分享海报" onClick={onClose}>
      {url ? <img src={url} alt="我的顺路体检官海报" className="max-h-[75vh] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} /> : <p className="text-white">生成中…</p>}
      <p className="mt-4 text-[15px] text-white">长按图片保存或分享</p>
      {url && (
        <a href={url} download="顺路海报.png" className="mt-3 rounded-full bg-white px-6 py-2.5 font-semibold text-brand" onClick={(e) => e.stopPropagation()}>
          下载海报
        </a>
      )}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lh;
    } else line += ch;
  }
  ctx.fillText(line, x, y);
}
