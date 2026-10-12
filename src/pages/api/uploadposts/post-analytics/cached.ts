import { route, requireUser, json, err, int, oneOf } from '../../../../server/api';
import { getProfile } from '../../../../server/uploads';
import { postMetrics } from '../../../../server/analytics';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams;
  const u = q.get('user') || q.get('profile'); if (!u) return err(400, 'user is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const platform = oneOf(q.get('platform'), ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'pinterest', 'reddit', 'x', 'bluesky'] as const, 'platform') ?? null;
  const since = q.get('since') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10); const until = q.get('until') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return err(400, 'since/until must be YYYY-MM-DD', 'invalid_date');
  const limit = Math.min(200, Math.max(1, int(q.get('limit'), 50)!));
  const r = postMetrics(user.id, p.username, platform, since, until, limit, q.get('cursor'));
  return json({ success: true, profile_username: p.username, platform, since, until, source: 'snapshot_cache', posts: r.posts, limit, next_cursor: r.next_cursor, has_more: r.has_more });
});
