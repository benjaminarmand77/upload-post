import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { siteUrl } from '../../../server/connect';
export const GET: APIRoute = (ctx) => {
  if (!process.env.GOOGLE_CLIENT_ID) return ctx.redirect('/app/login?error=google_not_configured', 303);
  const state = randomBytes(12).toString('base64url');
  ctx.cookies.set('g_state', state, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600 });
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${siteUrl()}/app/auth/google/callback`, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
  return ctx.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`, 303);
};
