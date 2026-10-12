import type { APIRoute } from 'astro';
import { PLATFORM_MAP, type PlatformKey } from '../../../lib/platforms';
import { getProfile } from '../../../server/uploads';
import { beginOAuth, validateConnectToken } from '../../../server/connect';
import { get, type ProfileRow } from '../../../server/db';
/** Start connecting a platform to a profile. Works for logged-in users and for whitelabel connect tokens. */
export const GET: APIRoute = (ctx) => {
  const platform = ctx.params.platform as PlatformKey; if (!(platform in PLATFORM_MAP)) return new Response('Unknown platform', { status: 404 });
  const token = ctx.url.searchParams.get('token');
  let profile: ProfileRow | undefined; let userId: string | null = null; let redirect = '/app/manage-users';
  if (token) { const v = validateConnectToken(token); if (!v) return ctx.redirect('/connect?error=expired', 303); profile = v.profile; userId = v.user.id; redirect = `/connect?token=${token}&connected=${platform}`; }
  else { if (!ctx.locals.user) return ctx.redirect('/app/login?redirect=' + encodeURIComponent(ctx.url.pathname + ctx.url.search), 303); const owner = ctx.locals.user.owner_user_id || ctx.locals.user.id; const pu = ctx.url.searchParams.get('profile') || 'default'; profile = getProfile(owner, pu); userId = owner; redirect = `/app/manage-users?profile=${encodeURIComponent(pu)}&connected=${platform}`; }
  if (!profile) return ctx.redirect('/app/manage-users?error=profile_not_found', 303);
  if (PLATFORM_MAP[platform].auth === 'credentials') return ctx.redirect(`${redirect.split('&connected')[0]}${redirect.includes('?') ? '&' : '?'}credentials=${platform}`, 303);
  const r = beginOAuth(platform, profile, userId, redirect, token);
  return ctx.redirect(r.url, 303);
};
