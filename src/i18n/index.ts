import { fr } from './fr';
import { en } from './en';
import type { Lang } from '../lib/i18n';
import type { Dict } from './fr';
import { es } from './partial/es';
import { br } from './partial/br';
import { de } from './partial/de';
import { it } from './partial/it';
import { ja } from './partial/ja';
import { ko } from './partial/ko';
import { nl } from './partial/nl';
import { tr } from './partial/tr';
import { hi } from './partial/hi';
import { vi } from './partial/vi';
import { id } from './partial/id';
import { ar } from './partial/ar';
import { th } from './partial/th';

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Deep-merges a partial translation over the English dictionary (arrays are replaced, not merged). */
function merge<T>(base: T, over: any): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over as T;
  const out: any = { ...base };
  for (const k of Object.keys(over)) out[k] = merge((base as any)[k], over[k]);
  return out;
}

const PARTIALS: Partial<Record<Lang, DeepPartial<Dict>>> = { es, br, de, it, ja, ko, nl, tr, hi, vi, id, ar, th };
const cache = new Map<Lang, Dict>();

/** Returns the dictionary for a language. FR and EN are complete; other locales translate the high-visibility strings and fall back to English elsewhere. */
export function getDict(lang: Lang): Dict {
  if (lang === 'fr') return fr;
  if (lang === 'en') return en;
  let d = cache.get(lang);
  if (!d) { d = merge(en, { ...(PARTIALS[lang] || {}), code: lang }); cache.set(lang, d); }
  return d;
}
export type { Dict };
