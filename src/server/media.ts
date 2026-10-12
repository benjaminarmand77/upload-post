import { writeFile, readFile, stat, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR, newId, now, run, get, all } from './db';
import { ApiError } from './api';

export interface StoredMedia { id: string; kind: 'video' | 'photo' | 'document' | 'image' | 'audio' | 'other'; filename: string; path: string; size: number; mime: string | null; width?: number | null; height?: number | null; duration?: number | null; url?: string }

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const EXT_MIME: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v', avi: 'video/x-msvideo', mkv: 'video/x-matroska', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', mp3: 'audio/mpeg', wav: 'audio/wav' };

export const extOf = (name: string) => (name.split('?')[0].split('.').pop() || '').toLowerCase();
export const mimeOf = (name: string, fallback: string | null = null) => EXT_MIME[extOf(name)] ?? fallback;
export const kindOf = (mime: string | null, name: string): StoredMedia['kind'] => {
  const m = mime || mimeOf(name) || '';
  if (m.startsWith('video/')) return 'video'; if (m.startsWith('image/')) return 'photo'; if (m.startsWith('audio/')) return 'audio';
  if (m.includes('pdf') || m.includes('presentation') || m.includes('word') || m.includes('msword')) return 'document';
  return 'other';
};

function userDir(userId: string) { const d = path.join(UPLOAD_DIR, userId); if (!existsSync(d)) mkdir(d, { recursive: true }); return d; }
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';

/** Persist an uploaded File (multipart) to disk and index it. */
export async function storeFile(userId: string, file: File, uploadId: string | null = null): Promise<StoredMedia> {
  if (file.size > MAX_BYTES) throw new ApiError(413, `File too large (${Math.round(file.size / 1048576)} MB). Maximum is 2048 MB.`, 'file_too_large');
  const id = newId('med_');
  const filename = safeName(file.name || 'upload');
  const dest = path.join(userDir(userId), `${id}_${filename}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
  const mime = file.type || mimeOf(filename);
  const kind = kindOf(mime, filename);
  const dims = kind === 'photo' ? await imageDimensions(dest) : null;
  run('INSERT INTO media_files (id, user_id, upload_id, kind, filename, path, size, mime, width, height, duration, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    id, userId, uploadId, kind, filename, dest, file.size, mime, dims?.width ?? null, dims?.height ?? null, null, now());
  return { id, kind, filename, path: dest, size: file.size, mime, width: dims?.width, height: dims?.height, url: `/uploads/${id}` };
}

/** Download a public URL (video=https://... style) to disk. */
export async function storeUrl(userId: string, url: string, uploadId: string | null = null): Promise<StoredMedia> {
  let u: URL; try { u = new URL(url); } catch { throw new ApiError(400, `Invalid media URL: ${url}`, 'invalid_url'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new ApiError(400, 'Only http(s) media URLs are supported', 'invalid_url');
  const res = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Upload-Post/1.0 (+https://upload-post.com)' } }).catch((e) => { throw new ApiError(400, `Could not download media URL: ${e.message}`, 'download_failed'); });
  if (!res.ok) throw new ApiError(400, `Could not download media URL (HTTP ${res.status})`, 'download_failed');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new ApiError(413, 'Remote file too large', 'file_too_large');
  const nameFromUrl = safeName(decodeURIComponent(u.pathname.split('/').pop() || 'remote'));
  const mime = res.headers.get('content-type')?.split(';')[0] || mimeOf(nameFromUrl);
  const filename = extOf(nameFromUrl) ? nameFromUrl : nameFromUrl + (mime?.startsWith('video/') ? '.mp4' : mime === 'image/png' ? '.png' : mime?.startsWith('image/') ? '.jpg' : '');
  const id = newId('med_');
  const dest = path.join(userDir(userId), `${id}_${filename}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  const kind = kindOf(mime, filename);
  const dims = kind === 'photo' ? await imageDimensions(dest) : null;
  run('INSERT INTO media_files (id, user_id, upload_id, kind, filename, path, size, mime, width, height, duration, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    id, userId, uploadId, kind, filename, dest, buf.length, mime, dims?.width ?? null, dims?.height ?? null, null, now());
  return { id, kind, filename, path: dest, size: buf.length, mime, width: dims?.width, height: dims?.height, url: `/uploads/${id}` };
}

export function getMedia(id: string) { return get<any>('SELECT * FROM media_files WHERE id = ?', id); }
export function mediaForUpload(uploadId: string) { return all<any>('SELECT * FROM media_files WHERE upload_id = ? ORDER BY created_at', uploadId); }
export async function deleteMedia(id: string) { const m = getMedia(id); if (!m) return; try { await unlink(m.path); } catch {} run('DELETE FROM media_files WHERE id = ?', id); }

/** Minimal PNG / JPEG / GIF / WebP header parser (no native deps). */
export async function imageDimensions(file: string): Promise<{ width: number; height: number } | null> {
  try {
    const fh = await readFile(file);
    if (fh.length < 24) return null;
    if (fh[0] === 0x89 && fh[1] === 0x50) return { width: fh.readUInt32BE(16), height: fh.readUInt32BE(20) };
    if (fh[0] === 0x47 && fh[1] === 0x49) return { width: fh.readUInt16LE(6), height: fh.readUInt16LE(8) };
    if (fh[0] === 0xff && fh[1] === 0xd8) {
      let i = 2;
      while (i < fh.length) {
        if (fh[i] !== 0xff) { i++; continue; }
        const marker = fh[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: fh.readUInt16BE(i + 5), width: fh.readUInt16BE(i + 7) };
        const len = fh.readUInt16BE(i + 2); i += 2 + len;
      }
    }
    if (fh.toString('ascii', 0, 4) === 'RIFF' && fh.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = fh.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') return { width: fh.readUInt16LE(26) & 0x3fff, height: fh.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L') { const b = fh.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      if (chunk === 'VP8X') return { width: (fh.readUIntLE(24, 3)) + 1, height: (fh.readUIntLE(27, 3)) + 1 };
    }
  } catch {}
  return null;
}

export async function fileSize(p: string) { try { return (await stat(p)).size; } catch { return 0; } }
