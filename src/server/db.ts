import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

export const newId = (prefix = '', bytes = 12) => prefix + randomBytes(bytes).toString('hex');
export const now = () => new Date().toISOString();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL, last_login_at TEXT, google_id TEXT, avatar_url TEXT, locale TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC', billing_cycle TEXT DEFAULT 'monthly', currency TEXT DEFAULT 'usd',
  plan_renews_at TEXT, extra_profiles INTEGER DEFAULT 0, x_links_addon INTEGER DEFAULT 0,
  settings_json TEXT DEFAULT '{}', owner_user_id TEXT, role TEXT DEFAULT 'owner'
);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, user_agent TEXT, ip TEXT);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS magic_links (token TEXT PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, redirect TEXT, source TEXT, plan TEXT);
CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL, key_prefix TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL, created_at TEXT NOT NULL, settings_json TEXT DEFAULT '{}', UNIQUE(user_id, username));
CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, platform TEXT NOT NULL, account_id TEXT, account_name TEXT, display_name TEXT, avatar_url TEXT,
  access_token TEXT, refresh_token TEXT, expires_at TEXT, scopes TEXT, credentials_json TEXT DEFAULT '{}', status TEXT NOT NULL DEFAULT 'connected',
  sandbox INTEGER NOT NULL DEFAULT 0, connected_at TEXT NOT NULL, updated_at TEXT NOT NULL, meta_json TEXT DEFAULT '{}', UNIQUE(profile_id, platform)
);
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_id TEXT NOT NULL, profile_username TEXT NOT NULL, media_type TEXT NOT NULL, title TEXT, description TEXT,
  params_json TEXT DEFAULT '{}', platforms_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', is_async INTEGER DEFAULT 0, scheduled_date TEXT, job_id TEXT,
  created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT, dashboard INTEGER DEFAULT 0, source TEXT, media_json TEXT DEFAULT '[]', error TEXT
);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, created_at);
CREATE TABLE IF NOT EXISTS upload_results (
  id TEXT PRIMARY KEY, upload_id TEXT NOT NULL, user_id TEXT NOT NULL, profile_username TEXT NOT NULL, platform TEXT NOT NULL, success INTEGER NOT NULL DEFAULT 0, message TEXT,
  post_url TEXT, platform_post_id TEXT, upload_timestamp TEXT NOT NULL, error_code TEXT, media_type TEXT, media_size_bytes INTEGER DEFAULT 0,
  video_was_transcoded INTEGER DEFAULT 0, changes_json TEXT DEFAULT '[]', meta_json TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_results_upload ON upload_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_results_user ON upload_results(user_id, upload_timestamp);
CREATE TABLE IF NOT EXISTS media_files (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, upload_id TEXT, kind TEXT NOT NULL, filename TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT, width INTEGER, height INTEGER, duration REAL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scheduled_jobs (job_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_id TEXT NOT NULL, upload_id TEXT NOT NULL, scheduled_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, run_at TEXT, attempts INTEGER DEFAULT 0, queue_slot INTEGER DEFAULT 0, error TEXT);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON scheduled_jobs(status, scheduled_date);
CREATE TABLE IF NOT EXISTS queue_settings (profile_id TEXT PRIMARY KEY, timezone TEXT NOT NULL DEFAULT 'UTC', slots_json TEXT NOT NULL DEFAULT '[{"hour":9,"minute":0},{"hour":13,"minute":0},{"hour":18,"minute":0}]', days_json TEXT NOT NULL DEFAULT '[0,1,2,3,4]', updated_at TEXT);
CREATE TABLE IF NOT EXISTS notifications (user_id TEXT PRIMARY KEY, channels_json TEXT DEFAULT '{"webhook":false,"telegram":false}', webhook_url TEXT, webhook_secret TEXT, telegram_chat_id TEXT, webhook_events_json TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS webhook_deliveries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event TEXT NOT NULL, url TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL, response_code INTEGER, response_body TEXT, created_at TEXT NOT NULL, attempts INTEGER DEFAULT 1);
CREATE INDEX IF NOT EXISTS idx_wh_user ON webhook_deliveries(user_id, created_at);
CREATE TABLE IF NOT EXISTS ffmpeg_jobs (job_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', full_command TEXT NOT NULL, output_extension TEXT NOT NULL, inputs_json TEXT NOT NULL, output_path TEXT, duration_seconds REAL, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT, error TEXT, publish INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS usage (user_id TEXT NOT NULL, month TEXT NOT NULL, uploads INTEGER DEFAULT 0, ffmpeg_minutes REAL DEFAULT 0, ai_shorts INTEGER DEFAULT 0, x_link_posts INTEGER DEFAULT 0, last_reset TEXT, PRIMARY KEY(user_id, month));
CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, email TEXT NOT NULL, member_user_id TEXT, role TEXT NOT NULL DEFAULT 'member', invited_at TEXT NOT NULL, accepted_at TEXT, token TEXT, UNIQUE(owner_user_id, email));
CREATE TABLE IF NOT EXISTS analytics_snapshots (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, date TEXT NOT NULL, metrics_json TEXT NOT NULL, UNIQUE(account_id, date));
CREATE TABLE IF NOT EXISTS post_metrics (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_username TEXT NOT NULL, platform TEXT NOT NULL, post_id TEXT NOT NULL, date TEXT NOT NULL, captured_at TEXT NOT NULL, metrics_json TEXT NOT NULL, post_url TEXT, media_type TEXT, upload_timestamp TEXT, UNIQUE(platform, post_id, date));
CREATE TABLE IF NOT EXISTS connect_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, config_json TEXT NOT NULL DEFAULT '{}', used_at TEXT);
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, user_id TEXT, profile_id TEXT NOT NULL, platform TEXT NOT NULL, created_at TEXT NOT NULL, redirect TEXT, code_verifier TEXT, connect_token TEXT);
CREATE TABLE IF NOT EXISTS status_incidents (id TEXT PRIMARY KEY, platform TEXT NOT NULL, status TEXT NOT NULL, title TEXT NOT NULL, body TEXT, created_at TEXT NOT NULL, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, text TEXT NOT NULL, stars INTEGER NOT NULL, created_at TEXT NOT NULL, approved INTEGER DEFAULT 0, email TEXT);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id TEXT, type TEXT NOT NULL, data_json TEXT DEFAULT '{}', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, created_at);
CREATE TABLE IF NOT EXISTS comments_cache (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, post_id TEXT NOT NULL, comment_id TEXT NOT NULL, parent_id TEXT, text TEXT, username TEXT, user_id TEXT, timestamp TEXT, hidden INTEGER DEFAULT 0, liked INTEGER DEFAULT 0, pinned INTEGER DEFAULT 0, UNIQUE(account_id, comment_id));
CREATE TABLE IF NOT EXISTS dm_conversations (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, participant_id TEXT NOT NULL, participant_name TEXT, messages_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS autodm_monitors (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_username TEXT NOT NULL, platform TEXT NOT NULL, post_id TEXT NOT NULL, keywords_json TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, expires_at TEXT, sent_count INTEGER DEFAULT 0, logs_json TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS ai_jobs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, input_json TEXT NOT NULL, output_json TEXT, status TEXT NOT NULL DEFAULT 'done', created_at TEXT NOT NULL);
`;

let _db: DatabaseSync | null = null;
export function db(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
  _db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  _db.exec(SCHEMA);
  return _db;
}

export type Row = Record<string, any>;
export function get<T = Row>(sql: string, ...params: any[]): T | undefined { return db().prepare(sql).get(...params) as T | undefined; }
export function all<T = Row>(sql: string, ...params: any[]): T[] { return db().prepare(sql).all(...params) as T[]; }
export function run(sql: string, ...params: any[]) { return db().prepare(sql).run(...params); }
export function tx<T>(fn: () => T): T { const d = db(); d.exec('BEGIN'); try { const r = fn(); d.exec('COMMIT'); return r; } catch (e) { d.exec('ROLLBACK'); throw e; } }
export const json = (v: any) => JSON.stringify(v ?? null);
export const parse = <T = any>(s: string | null | undefined, fallback: T): T => { if (!s) return fallback; try { return JSON.parse(s) as T; } catch { return fallback; } };

export interface UserRow { id: string; email: string; name: string | null; plan: string; created_at: string; last_login_at: string | null; google_id: string | null; avatar_url: string | null; locale: string; timezone: string; billing_cycle: string; currency: string; plan_renews_at: string | null; extra_profiles: number; x_links_addon: number; settings_json: string; owner_user_id: string | null; role: string }
export interface SessionRow { id: string; user_id: string; created_at: string; expires_at: string; user_agent: string | null; ip: string | null }
export interface ProfileRow { id: string; user_id: string; username: string; created_at: string; settings_json: string }
export interface SocialAccountRow { id: string; profile_id: string; platform: string; account_id: string | null; account_name: string | null; display_name: string | null; avatar_url: string | null; access_token: string | null; refresh_token: string | null; expires_at: string | null; scopes: string | null; credentials_json: string; status: string; sandbox: number; connected_at: string; updated_at: string; meta_json: string }
export interface UploadRow { id: string; user_id: string; profile_id: string; profile_username: string; media_type: 'video' | 'photo' | 'text' | 'document'; title: string | null; description: string | null; params_json: string; platforms_json: string; status: string; is_async: number; scheduled_date: string | null; job_id: string | null; created_at: string; started_at: string | null; completed_at: string | null; dashboard: number; source: string | null; media_json: string; error: string | null }
export interface UploadResultRow { id: string; upload_id: string; user_id: string; profile_username: string; platform: string; success: number; message: string | null; post_url: string | null; platform_post_id: string | null; upload_timestamp: string; error_code: string | null; media_type: string | null; media_size_bytes: number; video_was_transcoded: number; changes_json: string; meta_json: string }
export interface ScheduledJobRow { job_id: string; user_id: string; profile_id: string; upload_id: string; scheduled_date: string; status: string; created_at: string; run_at: string | null; attempts: number; queue_slot: number; error: string | null }

export function logEvent(userId: string | null, type: string, data: any = {}) {
  run('INSERT INTO events (id, user_id, type, data_json, created_at) VALUES (?,?,?,?,?)', newId('ev_'), userId, type, json(data), now());
}
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
