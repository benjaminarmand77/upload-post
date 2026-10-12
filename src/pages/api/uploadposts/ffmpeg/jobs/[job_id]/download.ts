import type { APIRoute } from 'astro';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { requireUser, handleError } from '../../../../../../server/api';
import { getFfmpegJob } from '../../../../../../server/ffmpeg';
import { mimeOf } from '../../../../../../server/media';
export const GET: APIRoute = (ctx) => {
  try {
    const { user } = requireUser(ctx); const j = getFfmpegJob(user.id, ctx.params.job_id!);
    if (!j) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
    if (j.status !== 'FINISHED' || !j.output_path || !existsSync(j.output_path)) return new Response(JSON.stringify({ error: `Job is ${j.status}` }), { status: 404 });
    return new Response(Readable.toWeb(createReadStream(j.output_path)) as any, { headers: { 'content-type': mimeOf(j.output_path, 'application/octet-stream')!, 'content-length': String(statSync(j.output_path).size), 'content-disposition': `attachment; filename="${j.job_id}.${j.output_extension}"` } });
  } catch (e) { return handleError(e); }
};
