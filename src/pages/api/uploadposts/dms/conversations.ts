import { route, requireUser, json, err } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { conversations } from '../../../../server/interactions';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams; if (q.get('platform') !== 'instagram') return err(400, "platform must be 'instagram'", 'invalid_parameter');
  const u = q.get('user'); if (!u) return err(400, 'user is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, 'instagram'); if (!acc) return err(400, 'No Instagram account connected', 'account_not_connected');
  return json({ success: true, conversations: conversations(acc) });
});
