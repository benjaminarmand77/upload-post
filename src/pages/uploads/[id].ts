import type { APIRoute } from 'astro';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { getMedia } from '../../server/media';
import { get } from '../../server/db';

/** Serves stored media (upload inputs, FFmpeg outputs). IDs are unguessable. */
export const GET: APIRoute = ({ params, request }) => {
  const id = params.id!;
  let file: { path: string; mime: string | null; filename: string } | null = null;
  const m = getMedia(id);
  if (m) file = { path: m.path, mime: m.mime, filename: m.filename };
  else { const f = get<any>('SELECT output_path, output_extension FROM ffmpeg_jobs WHERE job_id = ?', id); if (f?.output_path) file = { path: f.output_path, mime: null, filename: `${id}.${f.output_extension}` }; }
  if (!file || !existsSync(file.path)) return new Response('Not found', { status: 404 });
  const size = statSync(file.path).size;
  const range = request.headers.get('range');
  const type = file.mime || 'application/octet-stream';
  if (range) {
    const m2 = range.match(/bytes=(\d*)-(\d*)/); const start = m2?.[1] ? parseInt(m2[1]) : 0; const end = m2?.[2] ? Math.min(parseInt(m2[2]), size - 1) : size - 1;
    return new Response(Readable.toWeb(createReadStream(file.path, { start, end })) as any, { status: 206, headers: { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': String(end - start + 1), 'cache-control': 'private, max-age=3600' } });
  }
  return new Response(Readable.toWeb(createReadStream(file.path)) as any, { headers: { 'content-type': type, 'content-length': String(size), 'accept-ranges': 'bytes', 'content-disposition': `inline; filename="${file.filename}"`, 'cache-control': 'private, max-age=3600' } });
};
