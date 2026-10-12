import { route, requireUser, json } from '../../../../server/api';
import { all, parse } from '../../../../server/db';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx);
  const rows = all<any>("SELECT j.job_id, j.scheduled_date, j.status, j.queue_slot, u.media_type, u.profile_username, u.title, u.description, u.platforms_json, u.media_json, u.id AS request_id FROM scheduled_jobs j JOIN uploads u ON u.id = j.upload_id WHERE j.user_id = ? AND j.status = 'pending' ORDER BY j.scheduled_date", user.id);
  return json({ scheduled_posts: rows.map((r) => { const media = parse<any[]>(r.media_json, []); return { job_id: r.job_id, scheduled_date: r.scheduled_date, post_type: r.media_type === 'document' ? 'text' : r.media_type, profile_username: r.profile_username, title: r.title, caption: r.description, platforms: parse(r.platforms_json, []), preview_url: media[0]?.url ?? null, from_queue: !!r.queue_slot, request_id: r.request_id }; }) });
});
