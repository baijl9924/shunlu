import OpenAI from 'openai';
import type { PrivacyBox } from './image.js';

export const CATEGORIES = [
  '盲道被占用',
  '盲道断头或损坏',
  '缺少坡道或坡道损坏',
  '坡道过陡',
  '台阶没有扶手',
  '无障碍电梯故障',
  '无障碍卫生间问题',
  '无障碍停车位被占',
  '其他',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Analysis = {
  accept: boolean;
  reject_reason: string;
  category: Category;
  severity: 1 | 2 | 3;
  title: string;
  description: string;
  department: string;
  channel: '12345' | '12315';
  privacy_boxes: PrivacyBox[];
};

const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
export const AI_MOCK = !apiKey;

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 45_000,
    })
  : null;

const VL_MODEL = process.env.QWEN_VL_MODEL || 'qwen3-vl-plus';
const TEXT_MODEL = process.env.QWEN_TEXT_MODEL || 'qwen-plus';

const ANALYZE_PROMPT = `你是“顺路”无障碍环境体检助手。用户在街头随手拍了一张照片，请判断并以 JSON 返回（只输出 JSON，不要任何其他文字）：
{
  "accept": 布尔值。照片是否为真实的城市/校园/建筑环境，且能看出与无障碍设施（盲道、坡道、台阶扶手、无障碍电梯/卫生间/停车位等）相关的问题。自拍、截图、纯文字、与无障碍无关、或含色情暴力等不当内容时为 false,
  "reject_reason": "accept 为 false 时，用一句友好的话说明原因并引导重拍；否则为空字符串",
  "category": 从以下选一个：${CATEGORIES.join('、')},
  "severity": 1-3 的整数，1=轻微不便，2=明显影响通行，3=存在安全隐患或完全无法通行,
  "title": "不超过 14 个字的问题标题，如：共享单车占压盲道",
  "description": "不超过 70 字的客观描述：看到了什么、对谁造成什么影响",
  "department": "最可能的责任部门，如：城管、交警、市政/住建、物业、商场经营方",
  "channel": "通常为 12345；若是商场、酒店、银行等经营场所内部的无障碍设施问题，则为 12315",
  "privacy_boxes": [ {"type": "face" 或 "plate", "bbox": [x1, y1, x2, y2]} ]
}
privacy_boxes 需列出画面中所有可辨认的人脸和机动车车牌；bbox 坐标基于这张 1000x1000 的图片（左上角为原点），没有则返回空数组。`;

function extractJson(text: string): any {
  const cleaned = text.replace(/```json|```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI 未返回 JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitize(raw: any): Analysis {
  const category = CATEGORIES.includes(raw?.category) ? raw.category : '其他';
  const sev = Number(raw?.severity);
  return {
    accept: raw?.accept !== false,
    reject_reason: String(raw?.reject_reason || ''),
    category,
    severity: (sev === 1 || sev === 3 ? sev : 2) as 1 | 2 | 3,
    title: String(raw?.title || category).slice(0, 20),
    description: String(raw?.description || '').slice(0, 120),
    department: String(raw?.department || '城管').slice(0, 20),
    channel: raw?.channel === '12315' ? '12315' : '12345',
    privacy_boxes: Array.isArray(raw?.privacy_boxes)
      ? raw.privacy_boxes
          .filter((b: any) => Array.isArray(b?.bbox) && b.bbox.length === 4)
          .map((b: any) => ({ type: b.type === 'plate' ? 'plate' : 'face', bbox: b.bbox.map(Number) }))
      : [],
  };
}

export async function analyzeImage(aiCanvasJpeg: Buffer): Promise<Analysis> {
  if (!client) {
    await new Promise((r) => setTimeout(r, 1200));
    return sanitize({
      accept: true,
      category: '盲道被占用',
      severity: 2,
      title: '共享单车占压盲道（模拟）',
      description: '【模拟模式】人行道上多辆共享单车停放在盲道上，视障人士沿盲道行走时会被阻挡甚至绊倒。',
      department: '城管',
      channel: '12345',
      privacy_boxes: [],
    });
  }
  const res = await client.chat.completions.create({
    model: VL_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${aiCanvasJpeg.toString('base64')}` } },
          { type: 'text', text: ANALYZE_PROMPT },
        ],
      },
    ],
  });
  return sanitize(extractJson(res.choices[0]?.message?.content || ''));
}

export type ReportInput = {
  category: string;
  title: string;
  description: string;
  address: string;
  department: string;
  channel: string;
  severity: number;
  time: Date;
};

const SEVERITY_TEXT: Record<number, string> = { 1: '造成不便', 2: '明显影响通行', 3: '存在安全隐患' };

/** 反映文本中用 【姓名】【电话】 作为占位符，由前端用本机“举报资料卡”替换，个人信息不上传服务器 */
export function templateReport(r: ReportInput): string {
  const t = r.time.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  return `您好，我是市民【姓名】，联系电话【电话】。
${t}，我在${r.address || '（位置见附图）'}发现无障碍设施问题：${r.title}。
具体情况：${r.description}该问题${SEVERITY_TEXT[r.severity] || '影响通行'}，对视障人士、轮椅使用者、老年人及推婴儿车的家庭出行造成困难。
根据《中华人民共和国无障碍环境建设法》相关规定，恳请${r.department || '相关部门'}核实并尽快处理，处理后请予以回复。谢谢！`;
}

export async function generateReport(r: ReportInput): Promise<string> {
  const fallback = templateReport(r);
  if (!client) return fallback;
  try {
    const res = await client.chat.completions.create(
      {
        model: TEXT_MODEL,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              '你帮市民撰写向政务热线（12345）或 12315 反映无障碍设施问题的文本。要求：礼貌、客观、具体，200 字以内；开头固定写“您好，我是市民【姓名】，联系电话【电话】。”（保留方括号占位符原样）；包含时间、地点、问题、影响人群、诉求；可引用《中华人民共和国无障碍环境建设法》；只输出正文。',
          },
          { role: 'user', content: `参考草稿：\n${fallback}\n\n渠道：${r.channel}；建议责任部门：${r.department}` },
        ],
      },
      { timeout: 15_000 },
    );
    const text = res.choices[0]?.message?.content?.trim();
    return text && text.includes('【姓名】') ? text : fallback;
  } catch {
    return fallback;
  }
}

export async function summarizeCity(scope: string, stats: unknown): Promise<string> {
  const fallback = `${scope}目前共标记无障碍问题若干，详见下方统计。建议优先处理严重程度高、被多人确认的问题点，并对高发类型开展集中整治。`;
  if (!client) return `【模拟模式】${fallback}`;
  try {
    const res = await client.chat.completions.create(
      {
        model: TEXT_MODEL,
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content:
              '你是无障碍环境评估专家。根据市民随手拍汇总的数据，为该地区写一份简明的《无障碍体检报告》摘要：先用 2-3 句总结整体状况与最突出的问题，再给出 3 条具体、可执行的整改建议（编号列出）。300 字以内，语气客观建设性，纯文本不要使用 Markdown 符号。',
          },
          { role: 'user', content: `地区：${scope}\n数据：${JSON.stringify(stats)}` },
        ],
      },
      { timeout: 25_000 },
    );
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}
