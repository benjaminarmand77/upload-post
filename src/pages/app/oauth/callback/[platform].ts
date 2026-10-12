import type { APIRoute } from 'astro';
import type { PlatformKey } from '../../../../lib/platforms';
import { completeOAuth } from '../../../../server/connect';
export const GET: APIRoute = async (ctx) => {
  const platform = ctx.params.platform as PlatformKey; const q = ctx.url.searchParams;
  const state = q.get('state') || ''; const code = q.get('code');
  if (q.get('error')) return ctx.redirect(`/app/manage-users?error=${encodeURIComponent(q.get('error_description') || q.get('error')!)}`, 303);
  try { const r = await completeOAuth(platform, state, code, q.get('sandbox_name')); return ctx.redirect(r.redirect, 303); }
  catch (e: any) { return ctx.redirect(`/app/manage-users?error=${encodeURIComponent(e.message || 'oauth_failed')}`, 303); }
};
