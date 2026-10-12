import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { StoredMedia } from '../../media';
export { jsonFetch, form, env, ok, fail } from '../types';

export const pkce = () => { const verifier = randomBytes(48).toString('base64url'); const challenge = createHash('sha256').update(verifier).digest('base64url'); return { verifier, challenge }; };
export const readMedia = (m: StoredMedia) => readFile(m.path);
export const blob = async (m: StoredMedia) => new Blob([await readFile(m.path)], { type: m.mime || 'application/octet-stream' });
export const chunk = (buf: Buffer, size: number) => { const out: Buffer[] = []; for (let i = 0; i < buf.length; i += size) out.push(buf.subarray(i, i + size)); return out; };
export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export const hashtagsFrom = (s: string) => (s.match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.slice(1));
export const publicUrl = (path: string) => (process.env.SITE_URL || 'http://127.0.0.1:4321').replace(/\/$/, '') + path;
/** Split long text into a thread of chunks at sentence/word boundaries. */
export function splitThread(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = []; let rest = text.trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit - 6); if (cut < limit * 0.4) cut = rest.lastIndexOf('. ', limit - 6); if (cut < limit * 0.4) cut = rest.lastIndexOf(' ', limit - 6); if (cut <= 0) cut = limit - 6;
    parts.push(rest.slice(0, cut + (rest[cut] === '.' ? 1 : 0)).trim()); rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts.map((p, i) => (parts.length > 1 ? `${p} (${i + 1}/${parts.length})` : p)).map((p) => (p.length > limit ? p.slice(0, limit) : p));
}
