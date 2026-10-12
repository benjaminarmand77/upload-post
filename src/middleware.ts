import { defineMiddleware } from 'astro:middleware';
import { isLang, negotiateLang, type Lang } from './lib/i18n';
import { getDict } from './i18n';

/** Paths that are never language-prefixed. */
const PASSTHROUGH = /^\/(api|app|connect|docs|_astro|_image|icons|images|avatars|logos|fonts|favicon|robots\.txt|sitemap|openapi\.json|llm\.txt|uploads|health|\.well-known)/;

let booted = false;
export const onRequest = defineMiddleware(async (context, next) => {
  if (!booted) { booted = true; import('./server/scheduler').then((m) => m.startScheduler()).catch((e) => console.error('[boot]', e)); }
  const url = context.url;
  const path = url.pathname;

  // Theme cookie (dark by default, like upload-post.com)
  context.locals.theme = context.cookies.get('theme')?.value === 'light' ? 'light' : 'dark';

  // Session (populated lazily; the server module is loaded only when needed)
  context.locals.user = null;
  context.locals.session = null;
  const sid = context.cookies.get('up_session')?.value;
  if (sid) {
    try {
      const { getSessionWithUser } = await import('./server/auth');
      const r = getSessionWithUser(sid);
      if (r) { context.locals.user = r.user; context.locals.session = r.session; }
    } catch { /* database not ready yet */ }
  }

  const isMcpRpc = path === '/mcp' && context.request.method !== 'GET';
  if (PASSTHROUGH.test(path) || isMcpRpc) {
    // App & API are served in the user's preferred language (cookie > Accept-Language)
    const pref = context.cookies.get('lang')?.value;
    const lang: Lang = pref && isLang(pref) ? pref : negotiateLang(context.request.headers.get('accept-language'));
    context.locals.lang = lang === 'fr' ? 'fr' : 'en';
    context.locals.t = getDict(context.locals.lang);
    return next();
  }

  // /en/... → canonical root
  if (path === '/en' || path.startsWith('/en/')) {
    return context.redirect(path.replace(/^\/en/, '') || '/', 301);
  }

  const m = path.match(/^\/([a-z]{2})(\/|$)/);
  if (m && isLang(m[1])) {
    context.locals.lang = m[1];
    context.locals.t = getDict(m[1]);
    context.cookies.set('lang', m[1], { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return next();
  }

  // Root (English) pages are rewritten to the /en/ route files internally
  context.locals.lang = 'en';
  context.locals.t = getDict('en');
  return next(new Request(new URL('/en' + (path === '/' ? '/' : path) + url.search, url), context.request));
});
