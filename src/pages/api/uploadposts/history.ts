import { route, requireUser, json, int, paginate } from '../../../server/api';
import { all, get, parse } from '../../../server/db';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx);
  const { page, limit, offset } = paginate(int(ctx.url.searchParams.get('page'), 1), int(ctx.url.searchParams.get('limit'), 10));
  const platform = ctx.url.searchParams.get('platform'); const profile = ctx.url.searchParams.get('profile') || ctx.url.searchParams.get('user');
  const where = ['r.user_id = ?']; const args: any[] = [user.id];
  if (platform) { where.push('r.platform = ?'); args.push(platform); }
  if (profile) { where.push('r.profile_username = ?'); args.push(profile); }
  const total = get<any>(`SELECT COUNT(*) AS c FROM upload_results r WHERE ${where.join(' AND ')}`, ...args)?.c || 0;
  const rows = all<any>(`SELECT r.*, u.title AS post_title, u.description AS post_caption, u.is_async, u.job_id, u.dashboard, u.platforms_json, u.media_json FROM upload_results r JOIN uploads u ON u.id = r.upload_id WHERE ${where.join(' AND ')} ORDER BY r.upload_timestamp DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  const history = rows.map((r) => ({ user_email: user.email, profile_username: r.profile_username, platform: r.platform, media_type: r.media_type === 'document' ? 'text' : r.media_type, upload_timestamp: r.upload_timestamp, success: !!r.success, platform_post_id: r.platform_post_id, post_url: r.post_url, error_message: r.success ? null : r.message, error_code: r.success ? null : r.error_code, media_size_bytes: r.media_size_bytes, post_title: r.post_title, post_caption: r.post_caption, is_async: !!r.is_async, job_id: r.job_id, video_was_transcoded: !!r.video_was_transcoded, changes: parse(r.changes_json, []), prevalidation_metadata: (parse(r.media_json, []) as any[])[0] ? { width: parse(r.media_json, [] as any[])[0].width, height: parse(r.media_json, [] as any[])[0].height, mime: parse(r.media_json, [] as any[])[0].mime, filename: parse(r.media_json, [] as any[])[0].filename } : null, request_id: r.upload_id, request_id_logs: r.id, request_total_platforms: parse(r.platforms_json, []).length, dashboard: !!r.dashboard }));
  return json({ history, total, page, limit });
});
