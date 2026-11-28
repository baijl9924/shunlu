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
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  analysis TEXT NOT NULL,
  photo TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
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

// 平滑迁移老库：补齐 password_hash / role / is_guest 与 drafts.is_demo 字段，并将历史重名空号去重后加上唯一索引
const cols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
if (!cols.includes('password_hash')) {
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
}
if (!cols.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}
if (!cols.includes('is_guest')) {
  db.exec('ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0');
}
const draftCols = (db.prepare('PRAGMA table_info(drafts)').all() as { name: string }[]).map((c) => c.name);
if (!draftCols.includes('is_demo')) {
  db.exec('ALTER TABLE drafts ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
}

// 将老用户的 token 迁移到 sessions 表（如果尚未存在），保障老设备平滑在线
db.exec(`
  INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at)
  SELECT token, id, created_at, created_at + 365 * 86400000 FROM users WHERE token <> '';
`);

// 清理历史重名冲突（保留有上报记录或最早注册的账号原名，重复账号自动加序号后缀）
{
  const dupGroups = db
    .prepare(
      `SELECT LOWER(nickname) AS lname FROM users GROUP BY LOWER(nickname) HAVING COUNT(*) > 1`,
    )
    .all() as { lname: string }[];
  for (const g of dupGroups) {
    const members = db
      .prepare(
        `SELECT u.id, u.nickname,
          (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id) AS issue_cnt
         FROM users u
         WHERE LOWER(u.nickname) = ?
         ORDER BY issue_cnt DESC, u.created_at ASC`,
      )
      .all(g.lname) as { id: string; nickname: string; issue_cnt: number }[];
    for (let idx = 1; idx < members.length; idx++) {
      let suffix = idx + 1;
      let candidate = `${members[idx].nickname}_${suffix}`.slice(0, 16);
      while (db.prepare('SELECT 1 FROM users WHERE LOWER(nickname) = LOWER(?)').get(candidate)) {
        suffix++;
        candidate = `${members[idx].nickname}_${suffix}`.slice(0, 16);
      }
      db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(candidate, members[idx].id);
    }
  }
}

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname_unique ON users(nickname COLLATE NOCASE)');

export type User = {
  id: string;
  token: string;
  nickname: string;
  password_hash: string;
  role: 'user' | 'admin';
  is_guest: number;
  created_at: number;
};

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
  + (SELECT COUNT(*) FROM updates up WHERE up.user_id = u.id AND up.type IN ('fixed','recheck','fixed_claim')) * 20
`;
