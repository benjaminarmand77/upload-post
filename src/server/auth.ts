import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, get, run, all, newId, now, type UserRow, type SessionRow, logEvent } from './db';

const SESSION_DAYS = 30;
const MAGIC_MINUTES = 20;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function findUserByEmail(email: string): UserRow | undefined {
  return get<UserRow>('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase());
}
export function getUser(id: string): UserRow | undefined { return get<UserRow>('SELECT * FROM users WHERE id = ?', id); }

export function createUser(email: string, extra: Partial<UserRow> = {}): UserRow {
  const id = newId('usr_');
  const e = email.trim().toLowerCase();
  run('INSERT INTO users (id, email, name, plan, created_at, locale, timezone, google_id, avatar_url) VALUES (?,?,?,?,?,?,?,?,?)',
    id, e, extra.name ?? e.split('@')[0], extra.plan ?? 'free', now(), extra.locale ?? 'en', extra.timezone ?? 'UTC', extra.google_id ?? null, extra.avatar_url ?? null);
  // Every account starts with a default profile and an API key
  const pid = newId('prf_');
  run('INSERT INTO profiles (id, user_id, username, created_at) VALUES (?,?,?,?)', pid, id, 'default', now());
  createApiKey(id, 'Default key');
  logEvent(id, 'user.created', { email: e });
  return getUser(id)!;
}

export function createSession(userId: string, ua?: string | null, ip?: string | null): SessionRow {
  const id = randomBytes(32).toString('hex');
  const created = now();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  run('INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent, ip) VALUES (?,?,?,?,?,?)', id, userId, created, expires, ua ?? null, ip ?? null);
  run('UPDATE users SET last_login_at = ? WHERE id = ?', created, userId);
  return { id, user_id: userId, created_at: created, expires_at: expires, user_agent: ua ?? null, ip: ip ?? null };
}
export function getSessionWithUser(sessionId: string): { session: SessionRow; user: UserRow } | null {
  const session = get<SessionRow>('SELECT * FROM sessions WHERE id = ?', sessionId);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) { run('DELETE FROM sessions WHERE id = ?', sessionId); return null; }
  const user = getUser(session.user_id);
  if (!user) return null;
  return { session, user };
}
export function destroySession(sessionId: string) { run('DELETE FROM sessions WHERE id = ?', sessionId); }

export function createMagicLink(email: string, opts: { redirect?: string; source?: string; plan?: string } = {}) {
  const token = randomBytes(24).toString('base64url');
  run('INSERT INTO magic_links (token, email, created_at, expires_at, redirect, source, plan) VALUES (?,?,?,?,?,?,?)',
    token, email.trim().toLowerCase(), now(), new Date(Date.now() + MAGIC_MINUTES * 60000).toISOString(), opts.redirect ?? null, opts.source ?? null, opts.plan ?? null);
  return token;
}
export function consumeMagicLink(token: string): { email: string; redirect: string | null; source: string | null; plan: string | null } | null {
  const row = get<any>('SELECT * FROM magic_links WHERE token = ?', token);
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  run('UPDATE magic_links SET used_at = ? WHERE token = ?', now(), token);
  return { email: row.email, redirect: row.redirect, source: row.source, plan: row.plan };
}

/** API keys look like the originals: 40 hex chars. Only a SHA-256 hash is stored. */
export function createApiKey(userId: string, label = 'API key'): { id: string; key: string; prefix: string } {
  const key = randomBytes(20).toString('hex');
  const id = newId('key_');
  run('INSERT INTO api_keys (id, user_id, key_hash, key_prefix, label, created_at) VALUES (?,?,?,?,?,?)', id, userId, sha256(key), key.slice(0, 8), label, now());
  return { id, key, prefix: key.slice(0, 8) };
}
export function listApiKeys(userId: string) { return all('SELECT id, key_prefix, label, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC', userId); }
export function revokeApiKey(userId: string, id: string) { run('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?', now(), id, userId); }

export function userFromApiKey(key: string): UserRow | null {
  if (!key || key.length < 16) return null;
  const row = get<any>('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL', sha256(key));
  if (!row) return null;
  run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', now(), row.id);
  const user = getUser(row.user_id);
  if (!user) return null;
  // Team members act on behalf of the workspace owner
  return user.owner_user_id ? getUser(user.owner_user_id) ?? user : user;
}

/** Resolve the Authorization header of an API request ("Apikey XXX" or "Bearer XXX"). */
export function authenticateApiRequest(req: Request): { user: UserRow; scheme: 'apikey' | 'bearer'; token: string } | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^(Apikey|ApiKey|apikey|Bearer)\s+(.+)$/);
  if (!m) return null;
  const token = m[2].trim();
  if (/^bearer$/i.test(m[1])) {
    const u = userFromApiKey(token);
    return u ? { user: u, scheme: 'bearer', token } : null;
  }
  const u = userFromApiKey(token);
  return u ? { user: u, scheme: 'apikey', token } : null;
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Workspace owner for a user (team members share the owner's plan, profiles and keys). */
export function workspaceOwner(user: UserRow): UserRow { return user.owner_user_id ? getUser(user.owner_user_id) ?? user : user; }

export function ensureDb() { db(); }
