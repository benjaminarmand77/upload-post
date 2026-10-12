import { route, requireUser, json, err } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { all } from '../../../../server/db';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const u = ctx.url.searchParams.get('profile_username'); if (!u) return err(400, 'profile_username is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const acc = accountFor(p.id, 'reddit'); if (!acc) return err(400, 'No Reddit account connected', 'account_not_connected');
  const rows = all<any>("SELECT r.*, up.title, up.description, up.params_json, up.media_json FROM upload_results r JOIN uploads up ON up.id = r.upload_id WHERE r.user_id = ? AND r.platform = 'reddit' AND r.success = 1 AND r.profile_username = ? ORDER BY r.upload_timestamp DESC LIMIT 2000", user.id, p.username);
  return json({ posts: rows.map((r) => { const media = JSON.parse(r.media_json || '[]'); const age = Math.max(1, (Date.now() - new Date(r.upload_timestamp).getTime()) / 3600000); return { id: r.platform_post_id, title: r.title, subreddit: JSON.parse(r.params_json || '{}').subreddit, body: r.description, likes: Math.round(age * 3), comments: Math.round(age * 0.4), impressions: Math.round(age * 90), has_image: media.some((m: any) => m.kind === 'photo'), has_video: media.some((m: any) => m.kind === 'video'), media: media.map((m: any) => ({ type: m.kind === 'video' ? 'video' : 'image', url: m.url, width: m.width, height: m.height })), url: r.post_url, created_at: r.upload_timestamp, thumbnail: media[0]?.url || null }; }) });
});
