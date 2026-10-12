import { route, requireUser, json, err, oneOf } from '../../../server/api';
import { getProfile, accountFor } from '../../../server/uploads';
import { suggestions } from '../../../server/analytics';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams;
  if (q.get('platform') !== 'tiktok') return err(400, "Only 'tiktok' answers today. Supported: tiktok", 'platform_not_supported');
  const u = q.get('user') || q.get('profile'); const kw = q.get('q'); if (!u || !kw) return err(400, 'user and q are required', 'missing_parameter');
  const type = oneOf(q.get('type'), ['hashtags', 'keywords'] as const, 'type', 'hashtags')!;
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); if (!accountFor(p.id, 'tiktok')) return err(409, 'No TikTok account connected', 'account_not_connected');
  return json({ success: true, platform: 'tiktok', type, query: kw, ...suggestions(kw, type) });
});
