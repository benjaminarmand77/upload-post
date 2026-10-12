import { route, requireUser, json, err } from '../../../../server/api';
import { getProfile } from '../../../../server/uploads';
import { nextQueueSlot } from '../../../../server/queue';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const u = ctx.url.searchParams.get('profile_username') || ctx.url.searchParams.get('user');
  if (!u) return err(400, 'profile_username is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const n = nextQueueSlot(p.id);
  return json(n ? { success: true, next_slot: n } : { success: true, next_slot: null, message: 'No available queue slot. Configure slots and active days first.' });
});
