export type Issue = {
  id: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  district: string;
  category: string;
  severity: number;
  title: string;
  description: string;
  department: string;
  channel: '12345' | '12315';
  reportText: string;
  photo: string;
  status: 'pending' | 'reported' | 'fixed';
  hidden: boolean;
  confirmCount: number;
  nickname: string;
  isGuestAuthor?: boolean;
  createdAt: number;
};

export type IssueDetail = Issue & {
  confirmed: boolean;
  reportedByMe: boolean;
  mine: boolean;
  canManage: boolean;
  updates: {
    id: string;
    type: 'reported' | 'fixed' | 'fixed_claim' | 'recheck';
    note: string;
    photo: string | null;
    createdAt: number;
    nickname: string;
  }[];
};

export type Config = { tmapKey: string; aiMock: boolean; categories: string[] };

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
export const assetUrl = (p: string) => (p.startsWith('http') ? p : API_BASE + p);

const TOKEN_KEY = 'shunlu.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t: string) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

/** 带用户鉴权头拉取私有图片（如草稿预览图）并返回本地 Object URL */
export async function fetchAuthedBlobUrl(path: string): Promise<string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['x-user-token'] = token;
  const res = await fetch(API_BASE + path, { headers });
  if (!res.ok) throw new Error('图片加载失败');
  return URL.createObjectURL(await res.blob());
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers['x-user-token'] = token;
  const admin = sessionStorage.getItem('shunlu.admin');
  if (admin) headers['x-admin-token'] = admin;
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(API_BASE + path, { ...init, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data as T;
}

export const STATUS_TEXT: Record<Issue['status'], string> = {
  pending: '待反映',
  reported: '已反映',
  fixed: '已整改',
};
export const STATUS_COLOR: Record<Issue['status'], string> = {
  pending: '#ef4444',
  reported: '#f59e0b',
  fixed: '#10b981',
};
export const SEVERITY_TEXT: Record<number, string> = { 1: '轻微不便', 2: '影响通行', 3: '安全隐患' };

export function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
