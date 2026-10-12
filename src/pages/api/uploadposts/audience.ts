import { route, requireUser, json, err } from '../../../server/api';
import { getProfile, accountFor } from '../../../server/uploads';
import { audienceInsights, BENCHMARKS } from '../../../server/analytics';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams;
  if (q.get('platform') !== 'tiktok') return err(400, "Only 'tiktok' answers today. Supported: tiktok", 'platform_not_supported');
  const u = q.get('user') || q.get('profile'); if (!u) return err(400, 'user is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, 'tiktok'); if (!acc) return err(409, 'No TikTok account connected', 'account_not_connected');
  const end = q.get('end_date') || new Date(Date.now() - 86400000).toISOString().slice(0, 10); const start = q.get('start_date') || new Date(new Date(end).getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const bench = q.get('benchmark_category'); if (bench && !BENCHMARKS.includes(bench.toUpperCase())) return err(400, `Unknown benchmark_category. Allowed: ${BENCHMARKS.join(', ')}`, 'invalid_parameter');
  return json(audienceInsights(acc, start, end, bench));
});
