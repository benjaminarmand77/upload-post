import type { APIRoute } from 'astro';
import { readBody, str, json } from '../../../server/api';
import { getProfile } from '../../../server/uploads';
import { disconnectAccount, validateConnectToken } from '../../../server/connect';
export const POST: APIRoute = async (ctx) => {
  const { fields } = await readBody(ctx.request); const token = str(fields.token);
  let profile;
  if (token) { const v = validateConnectToken(token); if (!v) return json({ success: false }, 401); profile = v.profile; }
  else { if (!ctx.locals.user) return json({ success: false, message: 'Unauthorized' }, 401); profile = getProfile(ctx.locals.user.owner_user_id || ctx.locals.user.id, str(fields.profile) || 'default'); }
  if (!profile) return json({ success: false, message: 'Profile not found' }, 404);
  const ok = disconnectAccount(profile, str(fields.platform) || '');
  if (ctx.request.headers.get('accept')?.includes('text/html')) return ctx.redirect(token ? `/connect?token=${token}` : `/app/manage-users?profile=${encodeURIComponent(profile.username)}`, 303);
  return json({ success: ok });
};
