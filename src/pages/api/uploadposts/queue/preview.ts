import { route, requireUser, json, err, int } from '../../../../server/api';
import { getProfile } from '../../../../server/uploads';
import { previewQueue } from '../../../../server/queue';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const u = ctx.url.searchParams.get('profile_username') || ctx.url.searchParams.get('user');
  if (!u) return err(400, 'profile_username is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  return json({ success: true, ...previewQueue(p.id, Math.min(100, int(ctx.url.searchParams.get('count'), 10)!)) });
});
