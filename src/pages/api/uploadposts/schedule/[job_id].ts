import { route, requireUser, json, err, readBody, str, isoDate } from '../../../../server/api';
import { get, run, now, logEvent } from '../../../../server/db';
import { deleteMedia, mediaForUpload } from '../../../../server/media';
const load = (userId: string, jobId: string) => get<any>('SELECT j.*, u.title, u.description FROM scheduled_jobs j JOIN uploads u ON u.id = j.upload_id WHERE j.job_id = ? AND j.user_id = ?', jobId, userId);
export const DELETE = route(async (ctx) => {
  const { user } = requireUser(ctx); const j = load(user.id, ctx.params.job_id!);
  if (!j) return err(404, 'Scheduled post not found', 'not_found');
  if (j.status !== 'pending') return err(409, `Job is ${j.status} and can no longer be cancelled`, 'invalid_state');
  run("UPDATE scheduled_jobs SET status = 'cancelled' WHERE job_id = ?", j.job_id);
  run("UPDATE uploads SET status = 'cancelled', completed_at = ? WHERE id = ?", now(), j.upload_id);
  for (const m of mediaForUpload(j.upload_id)) await deleteMedia(m.id);
  logEvent(user.id, 'schedule.cancelled', { job_id: j.job_id });
  return json({ success: true, message: 'Scheduled post cancelled' });
});
export const PATCH = route(async (ctx) => {
  const { user } = requireUser(ctx); const j = load(user.id, ctx.params.job_id!);
  if (!j) return err(404, 'Scheduled post not found', 'not_found');
  if (j.status !== 'pending') return err(403, `Job is ${j.status} and can no longer be edited`, 'invalid_state');
  const { fields } = await readBody(ctx.request);
  const sd = isoDate(fields.scheduled_date, 'scheduled_date');
  if (sd) { const t = new Date(sd).getTime(); if (t <= Date.now()) return err(400, 'scheduled_date must be in the future', 'invalid_date'); if (t > Date.now() + 366 * 86400000) return err(400, 'scheduled_date must be within 1 year', 'invalid_date'); run('UPDATE scheduled_jobs SET scheduled_date = ?, queue_slot = 0 WHERE job_id = ?', sd, j.job_id); run('UPDATE uploads SET scheduled_date = ? WHERE id = ?', sd, j.upload_id); }
  const title = str(fields.title); const caption = str(fields.caption) ?? str(fields.description);
  if (title !== undefined) run('UPDATE uploads SET title = ? WHERE id = ?', title, j.upload_id);
  if (caption !== undefined) run('UPDATE uploads SET description = ? WHERE id = ?', caption, j.upload_id);
  const u = get<any>('SELECT title, description, scheduled_date FROM uploads WHERE id = ?', j.upload_id);
  return json({ success: true, job_id: j.job_id, scheduled_date: u.scheduled_date, title: u.title, caption: u.description });
});
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); const j = load(user.id, ctx.params.job_id!); if (!j) return err(404, 'Scheduled post not found', 'not_found'); return json({ success: true, job: j }); });
