import { route, requireUser, json, err, oneOf, int } from '../../../server/api';
import { getProfile, accountFor } from '../../../server/uploads';
import { oauthProvider } from '../../../server/providers';
import { all } from '../../../server/db';
const OK = ['instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'x', 'threads', 'pinterest', 'bluesky', 'reddit'] as const;
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams;
  const platform = oneOf(q.get('platform'), OK, 'platform'); const u = q.get('user'); if (!platform || !u) return err(400, 'platform and user are required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, platform); if (!acc) return err(400, `No ${platform} account linked to this profile`, 'account_not_connected');
  const limit = Math.min(100, Math.max(1, int(q.get('limit'), 25)!)); const cursor = q.get('cursor');
  if (cursor && ['linkedin', 'bluesky', 'threads'].includes(platform)) return err(400, `cursor pagination is not supported on ${platform}`, 'invalid_parameter');
  const prov = oauthProvider(platform);
  if (!acc.sandbox && prov?.listMedia) { const r = await prov.listMedia(acc, limit, cursor); return json({ success: true, media: r.media, pagination: { limit, next_cursor: r.next_cursor, has_more: !!r.next_cursor } }); }
  const rows = all<any>("SELECT r.*, u.media_type, u.title, u.media_json FROM upload_results r JOIN uploads u ON u.id = r.upload_id WHERE r.user_id = ? AND r.platform = ? AND r.success = 1 AND r.profile_username = ? ORDER BY r.upload_timestamp DESC", user.id, platform, p.username);
  const start = cursor ? parseInt(Buffer.from(cursor, 'base64url').toString(), 10) || 0 : 0; const page = rows.slice(start, start + limit);
  const media = page.map((r) => { const m = JSON.parse(r.media_json || '[]'); const t = r.media_type === 'video' ? 'VIDEO' : r.media_type === 'photo' ? (m.length > 1 ? 'CAROUSEL_ALBUM' : 'IMAGE') : 'TEXT'; return { id: r.platform_post_id, caption: r.title, media_type: t, media_url: ['tiktok', 'youtube'].includes(platform) ? null : m[0]?.url || null, permalink: r.post_url, timestamp: r.upload_timestamp, thumbnail_url: m[0]?.kind === 'photo' ? m[0].url : null }; });
  const next = start + limit < rows.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
  return json({ success: true, media, pagination: { limit, next_cursor: next, has_more: !!next } });
});
