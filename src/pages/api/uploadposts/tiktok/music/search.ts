import { route, requireUser, json, err, oneOf, int } from '../../../../../server/api';
import { getProfile, accountFor } from '../../../../../server/uploads';
import { trendingTracks, GENRES } from '../../../../../server/tiktok-extras';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams; const pu = q.get('profile') || q.get('user'); if (!pu) return err(400, 'profile is required', 'missing_parameter');
  const p = getProfile(user.id, pu); if (!p) return err(404, 'Profile not found', 'profile_not_found'); if (!accountFor(p.id, 'tiktok')) return err(409, 'Profile has no TikTok account connected', 'account_not_connected');
  const genre = (q.get('genre') || 'ALL').toUpperCase(); const country = (q.get('country_code') || 'US').toUpperCase(); const range = oneOf(q.get('date_range'), ['1DAY', '7DAY', '30DAY', '90DAY'] as const, 'date_range', '7DAY')!; const limit = Math.min(200, int(q.get('limit'), 50)!);
  const all = trendingTracks(genre, country, range, 120); const words = norm(q.get('q') || '').split(/\s+/).filter(Boolean);
  const hits = words.length ? all.filter((t) => words.every((w) => norm(t.title + ' ' + t.artist).includes(w))) : all;
  return json({ success: true, query: q.get('q') || '', genre, country_code: country, date_range: range, limit, total: hits.length, tracks: hits.slice(0, limit), catalog: { tracks_indexed: all.length, genres_indexed: GENRES, cached: true } });
});
