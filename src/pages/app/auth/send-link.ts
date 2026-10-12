import type { APIRoute } from 'astro';
import { createMagicLink } from '../../../server/auth';
import { sendMail, magicLinkEmail, smtpConfigured } from '../../../server/mailer';
import { readBody, str } from '../../../server/api';
import { siteUrl } from '../../../server/connect';

const attempts = new Map<string, number[]>();
export const POST: APIRoute = async (ctx) => {
  const { fields } = await readBody(ctx.request);
  const email = (str(fields.email) || '').trim().toLowerCase();
  const lang = ctx.locals.lang;
  const back = (q: string) => ctx.redirect(`/app/login?${q}${fields.source ? `&source=${encodeURIComponent(String(fields.source))}` : ''}${fields.plan ? `&plan=${encodeURIComponent(String(fields.plan))}` : ''}`, 303);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return back('error=invalid_email');
  const ip = ctx.request.headers.get('x-forwarded-for') || ctx.clientAddress || 'local';
  const arr = (attempts.get(ip) || []).filter((t) => Date.now() - t < 3600000); if (arr.length >= 20) return back('error=rate_limited'); arr.push(Date.now()); attempts.set(ip, arr);
  const token = createMagicLink(email, { redirect: str(fields.redirect) || null as any, source: str(fields.source), plan: str(fields.plan) });
  const link = `${siteUrl()}/app/auth/verify?token=${token}`;
  const mail = magicLinkEmail(link, lang);
  const r = await sendMail({ to: email, ...mail });
  // Without SMTP (local/dev) the link is shown on screen so the product stays fully usable
  const dev = !r.sent && !smtpConfigured();
  return ctx.redirect(`/app/login?sent=1&email=${encodeURIComponent(email)}${dev ? `&dev_link=${encodeURIComponent(link)}` : ''}`, 303);
};
