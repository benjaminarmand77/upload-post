import { createHmac } from 'node:crypto';
const secret = () => process.env.APP_SECRET || 'dev-secret-change-me';
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function signJwt(payload: Record<string, any>, ttlSeconds: number): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
export function verifyJwt<T = Record<string, any>>(token: string): T | null {
  const parts = token.split('.'); if (parts.length !== 3) return null;
  const sig = createHmac('sha256', secret()).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (sig !== parts[2]) return null;
  try { const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); if (p.exp && p.exp < Date.now() / 1000) return null; return p as T; } catch { return null; }
}
