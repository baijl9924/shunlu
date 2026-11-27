import { Download, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type Props = {
  title: string;
  score: number;
  grade: string;
  gradeColor: string;
  total: { n: number; fixed: number; reported: number; severe: number; users: number };
  byCategory: { category: string; n: number }[];
  overview: string;
  suggestions: string[];
  onClose: () => void;
};

/** 一键生成城市无障碍体检报告长图（PNG） */
export default function ReportPoster({ title, score, grade, gradeColor, total, byCategory, overview, suggestions, onClose }: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const onBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('shunlu:back', onBack);
    return () => window.removeEventListener('shunlu:back', onBack);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const W = 750;
      const font = '"PingFang SC", "Microsoft YaHei", sans-serif';

      // 先测量正文高度以动态计算长图总高
      const tmp = document.createElement('canvas').getContext('2d')!;
      tmp.font = `26px ${font}`;
      const overviewLines = measureWrap(tmp, overview, W - 148);
      const sugLines = suggestions.slice(0, 3).map((s) => measureWrap(tmp, s, W - 208));
      const cats = byCategory.slice(0, 5);
      const catH = cats.length * 46 + 90;
      const summaryH = overviewLines.length * 40 + 100 + sugLines.reduce((acc, ls) => acc + ls.length * 38 + 26, 0) + 50;
      const H = 260 + 230 + catH + summaryH + 240;

      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d')!;

      // 背景
      ctx.fillStyle = '#f7f8fa';
      ctx.fillRect(0, 0, W, H);

      // 顶部晴空蓝横幅
      const g = ctx.createLinearGradient(0, 0, W, 270);
      g.addColorStop(0, '#2563eb');
      g.addColorStop(1, '#0e5fd8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 270);

      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = `24px ${font}`;
      ctx.fillText('顺路 · 城市无障碍环境体检', 48, 78);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 52px ${font}`;
      ctx.fillText(title, 48, 148);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `22px ${font}`;
      ctx.fillText(`生成日期：${new Date().toLocaleDateString('zh-CN')}`, 48, 195);

      // 健康度评分卡（悬浮压在蓝底上）
      let y = 225;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 40, y, W - 80, 210, 28);
      ctx.fill();

      // 环形进度条
      const cx = 148;
      const cy = y + 105;
      const r = 64;
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = gradeColor;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * score) / 100);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 44px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(score), cx, cy + 12);
      ctx.fillStyle = '#64748b';
      ctx.font = `20px ${font}`;
      ctx.fillText('健康度', cx, cy + 40);
      ctx.textAlign = 'left';

      // 右侧数据
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 30px ${font}`;
      ctx.fillText(`综合评级：${grade}`, 254, y + 66);
      const fixRate = total.n ? Math.round(((total.fixed || 0) / total.n) * 100) : 0;
      const kpis = [
        [`${total.n}`, '已记录'],
        [`${total.severe || 0}`, '安全隐患'],
        [`${fixRate}%`, '整改率'],
        [`${total.users}`, '参与市民'],
      ];
      kpis.forEach(([val, lbl], idx) => {
        const kx = 254 + idx * 112;
        ctx.fillStyle = idx === 1 && Number(val) > 0 ? '#ef4444' : '#0f172a';
        ctx.font = `bold 34px ${font}`;
        ctx.fillText(val, kx, y + 132);
        ctx.fillStyle = '#64748b';
        ctx.font = `21px ${font}`;
        ctx.fillText(lbl, kx, y + 166);
      });

      // 类型分布卡
      y += 238;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 40, y, W - 80, catH, 28);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 28px ${font}`;
      ctx.fillText('高发问题分布', 72, y + 52);
      const maxCat = Math.max(1, ...cats.map((c) => c.n));
      cats.forEach((item, idx) => {
        const ry = y + 96 + idx * 46;
        ctx.fillStyle = '#334155';
        ctx.font = `23px ${font}`;
        ctx.fillText(item.category.slice(0, 9), 72, ry);
        const barX = 290;
        const barW = 320;
        ctx.fillStyle = '#f1f5f9';
        roundRect(ctx, barX, ry - 18, barW, 20, 10);
        ctx.fill();
        ctx.fillStyle = '#1677ff';
        roundRect(ctx, barX, ry - 18, Math.max(20, (item.n / maxCat) * barW), 20, 10);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold 23px ${font}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${item.n} 处`, W - 72, ry);
        ctx.textAlign = 'left';
      });

      // 结论与建议卡
      y += catH + 24;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 40, y, W - 80, summaryH, 28);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 28px ${font}`;
      ctx.fillText('体检结论与整改建议', 72, y + 52);

      let ty = y + 98;
      ctx.fillStyle = '#334155';
      ctx.font = `25px ${font}`;
      for (const line of overviewLines) {
        ctx.fillText(line, 72, ty);
        ty += 40;
      }
      ty += 16;
      sugLines.forEach((lines, idx) => {
        ctx.fillStyle = '#eef5ff';
        roundRect(ctx, 72, ty - 26, 42, 34, 10);
        ctx.fill();
        ctx.fillStyle = '#1677ff';
        ctx.font = `bold 22px ${font}`;
        ctx.textAlign = 'center';
        ctx.fillText(`0${idx + 1}`, 93, ty - 2);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1e293b';
        ctx.font = `24px ${font}`;
        lines.forEach((line, li) => {
          ctx.fillText(line, 128, ty + li * 38);
        });
        ty += lines.length * 38 + 24;
      });

      // 底部二维码署名栏
      const fy = H - 205;
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, 40, fy, W - 80, 165, 28);
      ctx.fill();
      const qr = await QRCode.toDataURL(location.href, { margin: 1, width: 140, color: { dark: '#0f172a', light: '#ffffff' } });
      const img = new Image();
      img.src = qr;
      await img.decode();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 64, fy + 22, 120, 120, 16);
      ctx.fill();
      ctx.drawImage(img, 70, fy + 28, 108, 108);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 30px ${font}`;
      ctx.fillText('顺路 · 让每条路都顺', 210, fy + 74);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `22px ${font}`;
      ctx.fillText('扫码查看完整实时报告，随手拍参与城市共治', 210, fy + 116);

      setUrl(c.toDataURL('image/png'));
    })();
  }, [title, score, grade, gradeColor, total, byCategory, overview, suggestions]);

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950/80 p-5 backdrop-blur-xs" role="dialog" aria-modal aria-label="报告分享长图" onClick={onClose}>
      <button onClick={onClose} className="absolute right-4 top-12 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white" aria-label="关闭">
        <X className="h-5 w-5" />
      </button>
      {url ? (
        <img src={url} alt={title} className="sheet-up max-h-[72vh] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
      ) : (
        <p className="text-[14px] text-white">正在生成高清长图…</p>
      )}
      <p className="mt-3 text-[13px] text-white/80">长按图片可直接保存到相册或转发给朋友</p>
      {url && (
        <a
          href={url}
          download={`${title}.png`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-brand shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-4 w-4" />
          下载长图
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

function measureWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      if (line) lines.push(line);
      line = '';
      continue;
    }
    if (ctx.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}
