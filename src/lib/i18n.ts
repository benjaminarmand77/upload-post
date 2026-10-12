export const LANGS = [
  { code: 'en', name: 'English', flag: '🇺🇸', locale: 'en-US', dir: 'ltr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', locale: 'es-ES', dir: 'ltr' },
  { code: 'br', name: 'Português', flag: '🇧🇷', locale: 'pt-BR', dir: 'ltr' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', locale: 'de-DE', dir: 'ltr' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', locale: 'it-IT', dir: 'ltr' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', locale: 'ja-JP', dir: 'ltr' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', locale: 'ko-KR', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', locale: 'hi-IN', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', locale: 'vi-VN', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', locale: 'id-ID', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', locale: 'tr-TR', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', locale: 'nl-NL', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', locale: 'ar', dir: 'rtl' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭', locale: 'th-TH', dir: 'ltr' },
] as const;

export type Lang = (typeof LANGS)[number]['code'];
export const LANG_CODES = LANGS.map((l) => l.code) as readonly Lang[];
export const DEFAULT_LANG: Lang = 'en';
export const isLang = (x: string): x is Lang => (LANG_CODES as readonly string[]).includes(x);
export const langInfo = (code: Lang) => LANGS.find((l) => l.code === code)!;

/** Build a localized path. English lives at the root, every other language is prefixed. */
export function localePath(lang: Lang, path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('#')) return path;
  let p = path.startsWith('/') ? path : '/' + path;
  if (lang === 'en' || /^\/(app|docs|api|connect|openapi\.json|llm\.txt|uploads)(\/|$)/.test(p)) return p;
  if (p === '/') return `/${lang}/`;
  return `/${lang}${p}`;
}

/** Strip a language prefix from a pathname and return [lang, pathWithoutPrefix]. */
export function splitLang(pathname: string): [Lang, string] {
  const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (m && isLang(m[1])) {
    const rest = pathname.slice(m[1].length + 1) || '/';
    return [m[1], rest];
  }
  return ['en', pathname];
}

/** Pick the best language from an Accept-Language header. */
export function negotiateLang(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const parts = header.split(',').map((s) => s.trim().split(';')[0].toLowerCase());
  for (const p of parts) {
    if (p.startsWith('pt')) return 'br';
    const base = p.split('-')[0];
    if (isLang(base)) return base;
  }
  return DEFAULT_LANG;
}

export function fmtNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(langInfo(lang).locale === 'ar' ? 'ar-u-nu-latn' : langInfo(lang).locale).format(n);
}
export function fmtCompact(n: number, lang: Lang): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return fmtNumber(n, lang);
}
export function fmtDate(d: string | Date, lang: Lang, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(langInfo(lang).locale, opts).format(typeof d === 'string' ? new Date(d) : d);
}
