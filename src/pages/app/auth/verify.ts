import type { APIRoute } from 'astro';
import { consumeMagicLink, findUserByEmail, createUser, createSession } from '../../../server/auth';
import { run } from '../../../server/db';
export const GET: APIRoute = async (ctx) => {
  const token = ctx.url.searchParams.get('token') || '';
  const m = consumeMagicLink(token);
  if (!m) return ctx.redirect('/app/login?error=link_expired', 303);
  let user = findUserByEmail(m.email);
  const isNew = !user;
  if (!user) user = createUser(m.email, { locale: ctx.locals.lang });
  const s = createSession(user.id, ctx.request.headers.get('user-agent'), ctx.request.headers.get('x-forwarded-for') || ctx.clientAddress);
  ctx.cookies.set('up_session', s.id, { path: '/', httpOnly: true, sameSite: 'lax', secure: ctx.url.protocol === 'https:', expires: new Date(s.expires_at) });
  if (m.plan && m.plan !== 'free') run("UPDATE users SET settings_json = json_set(COALESCE(settings_json,'{}'), '$.intended_plan', ?) WHERE id = ?", m.plan, user.id);
  const dest = m.redirect && m.redirect.startsWith('/') ? m.redirect : isNew ? '/app/?welcome=1' : '/app/';
  return ctx.redirect(dest, 303);
};
