import { route, json } from '../../../../server/api';
import { validateConnectToken } from '../../../../server/connect';
import { profileView } from '../../../../server/uploads';
export const GET = route(async (ctx) => {
  const h = ctx.request.headers.get('authorization') || ''; const token = h.replace(/^Bearer\s+/i, '') || ctx.url.searchParams.get('token') || '';
  const v = validateConnectToken(token);
  if (!v) return json({ success: true, isValid: false }, 200);
  return json({ success: true, isValid: true, profile: profileView(v.profile), config: v.config, expires_at: v.expires_at });
});
