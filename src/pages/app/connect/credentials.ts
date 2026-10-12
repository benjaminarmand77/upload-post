import type { APIRoute } from 'astro';
import { PLATFORM_MAP, type PlatformKey } from '../../../lib/platforms';
import { readBody, str, handleError, json } from '../../../server/api';
import { getProfile } from '../../../server/uploads';
import { connectWithCredentials, validateConnectToken } from '../../../server/connect';
/** POST credentials for Discord/Telegram/WordPress/... (dashboard or whitelabel page). */
export const POST: APIRoute = async (ctx) => {
  try {
    const { fields } = await readBody(ctx.request);
    const platform = str(fields.platform) as PlatformKey; if (!(platform in PLATFORM_MAP)) return json({ success: false, message: 'Unknown platform' }, 400);
    const token = str(fields.token);
    let profile;
    if (token) { const v = validateConnectToken(token); if (!v) return json({ success: false, message: 'Link expired' }, 401); profile = v.profile; }
    else { if (!ctx.locals.user) return json({ success: false, message: 'Unauthorized' }, 401); profile = getProfile(ctx.locals.user.owner_user_id || ctx.locals.user.id, str(fields.profile) || 'default'); }
    if (!profile) return json({ success: false, message: 'Profile not found' }, 404);
    const creds: Record<string, string> = {}; for (const f of PLATFORM_MAP[platform].credentialFields || []) creds[f.key] = str(fields[f.key]) || '';
    const acc = await connectWithCredentials(platform, profile, creds, { sandbox: str(fields.mode) === 'sandbox' });
    return json({ success: true, account: { platform: acc.platform, account_name: acc.account_name, display_name: acc.display_name, sandbox: !!acc.sandbox } });
  } catch (e) { return handleError(e); }
};
