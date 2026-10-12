import { route, requireUser, json, err, oneOf } from '../../../../../server/api';
import { getProfile, accountFor } from '../../../../../server/uploads';
import { trendingTracks } from '../../../../../server/tiktok-extras';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams; const pu = q.get('profile') || q.get('user'); if (!pu) return err(400, 'profile is required', 'missing_parameter');
  const p = getProfile(user.id, pu); if (!p) return err(404, 'Profile not found', 'profile_not_found'); if (!accountFor(p.id, 'tiktok')) return err(409, 'Profile has no TikTok account connected', 'account_not_connected');
  const genre = (q.get('genre') || 'ALL').toUpperCase(); const country = (q.get('country_code') || 'US').toUpperCase(); const range = oneOf(q.get('date_range'), ['1DAY', '7DAY', '30DAY', '90DAY'] as const, 'date_range', '7DAY')!;
  return json({ success: true, genre, country_code: country, date_range: range, cached: true, tracks: trendingTracks(genre, country, range) });
});
