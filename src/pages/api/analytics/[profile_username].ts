import { route, requireUser, json, err, list } from '../../../server/api';
import { getProfile } from '../../../server/uploads';
import { profileAnalytics } from '../../../server/analytics';
const OK = ['instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube', 'threads', 'pinterest', 'reddit', 'bluesky'];
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const p = getProfile(user.id, ctx.params.profile_username!);
  if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const platforms = list(ctx.url.searchParams.get('platforms')); if (!platforms.length) return err(400, 'platforms is required (comma-separated)', 'missing_parameter');
  const bad = platforms.filter((x) => !OK.includes(x)); if (bad.length) return err(400, `Unsupported analytics platform(s): ${bad.join(', ')}`, 'invalid_platform');
  const days = Math.min(365, Math.max(7, Number(ctx.url.searchParams.get('days') || 30)));
  return json({ success: true, profile_username: p.username, ...profileAnalytics(p.id, platforms, days) });
});
