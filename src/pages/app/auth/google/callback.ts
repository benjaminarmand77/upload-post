import type { APIRoute } from 'astro';
import { findUserByEmail, createUser, createSession } from '../../../../server/auth';
import { run } from '../../../../server/db';
import { siteUrl } from '../../../../server/connect';
export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get('code'); const state = ctx.url.searchParams.get('state');
  if (!code || !state || state !== ctx.cookies.get('g_state')?.value) return ctx.redirect('/app/login?error=google_failed', 303);
  try {
    const t = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${siteUrl()}/app/auth/google/callback`, grant_type: 'authorization_code' }) }).then((r) => r.json());
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
    if (!info.email) throw new Error('no email');
    let user = findUserByEmail(info.email); const isNew = !user;
    if (!user) user = createUser(info.email, { name: info.name, google_id: info.sub, avatar_url: info.picture, locale: ctx.locals.lang });
    else run('UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?), name = COALESCE(name, ?) WHERE id = ?', info.sub, info.picture, info.name, user.id);
    const s = createSession(user.id, ctx.request.headers.get('user-agent'), ctx.clientAddress);
    ctx.cookies.set('up_session', s.id, { path: '/', httpOnly: true, sameSite: 'lax', secure: ctx.url.protocol === 'https:', expires: new Date(s.expires_at) });
    return ctx.redirect(isNew ? '/app/?welcome=1' : '/app/', 303);
  } catch { return ctx.redirect('/app/login?error=google_failed', 303); }
};
