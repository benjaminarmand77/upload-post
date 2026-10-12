import { route, requireUser, json, err } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { searchLocations } from '../../../../server/tiktok-extras';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams; const pu = q.get('profile') || q.get('user'); if (!pu) return err(400, 'profile is required', 'missing_parameter');
  const query = q.get('q'); if (!query) return err(400, 'q is required', 'missing_parameter');
  const p = getProfile(user.id, pu); if (!p) return err(404, 'Profile not found', 'profile_not_found'); if (!accountFor(p.id, 'tiktok')) return err(409, 'Profile has no TikTok account connected', 'account_not_connected');
  return json({ success: true, query, locations: searchLocations(query) });
});
