import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(import.meta.dirname, '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'shunlu.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  analysis TEXT NOT NULL,
  photo TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  severity INTEGER NOT NULL DEFAULT 2,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '12345',
  report_text TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_city ON issues(city);
CREATE INDEX IF NOT EXISTS idx_issues_user ON issues(user_id);

CREATE TABLE IF NOT EXISTS confirmations (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (issue_id, user_id)
);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  photo TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS report_cache (
  key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

export type User = { id: string; token: string; nickname: string; created_at: number };

export type IssueRow = {
  id: string;
  user_id: string;
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
  channel: string;
  report_text: string;
  photo: string;
  status: 'pending' | 'reported' | 'fixed';
  hidden: number;
  created_at: number;
  updated_at: number;
};

/** 积分：上报 +10，被确认 +2，标记已反映 +5，整改复查 +20 */
export const POINTS_SQL = `
  (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id AND i.hidden = 0) * 10
  + (SELECT COUNT(*) FROM confirmations c JOIN issues i ON i.id = c.issue_id WHERE i.user_id = u.id AND i.hidden = 0) * 2
  + (SELECT COUNT(*) FROM updates up WHERE up.user_id = u.id AND up.type = 'reported') * 5
  + (SELECT COUNT(*) FROM updates up WHERE up.user_id = u.id AND up.type IN ('fixed','recheck')) * 20
`;
