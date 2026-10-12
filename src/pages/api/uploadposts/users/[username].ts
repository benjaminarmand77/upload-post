import { route, requireUser, json, err } from '../../../../server/api';
import { getProfile, profileView } from '../../../../server/uploads';
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); const p = getProfile(user.id, ctx.params.username!); if (!p) return err(404, 'Profile not found', 'profile_not_found'); return json({ success: true, profile: profileView(p) }); });
