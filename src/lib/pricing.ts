export type PlanKey = 'free' | 'basic' | 'professional' | 'advanced' | 'business';
export type Currency = 'usd' | 'eur';
export type Cycle = 'monthly' | 'yearly';

export const PRICES: Record<Currency, Record<Cycle, Record<Exclude<PlanKey, 'free'>, { price: number; billed: number | null }>>> = {
  usd: {
    monthly: { basic: { price: 24, billed: null }, professional: { price: 50, billed: null }, advanced: { price: 147, billed: null }, business: { price: 438, billed: null } },
    yearly: { basic: { price: 16, billed: 192 }, professional: { price: 33, billed: 400 }, advanced: { price: 118, billed: 1411 }, business: { price: 350, billed: 4205 } },
  },
  eur: {
    monthly: { basic: { price: 19, billed: null }, professional: { price: 42, billed: null }, advanced: { price: 126, billed: null }, business: { price: 378, billed: null } },
    yearly: { basic: { price: 13, billed: 152 }, professional: { price: 28, billed: 336 }, advanced: { price: 101, billed: 1210 }, business: { price: 302, billed: 3629 } },
  },
};

export const EXTRA_PROFILES: Record<Currency, Partial<Record<PlanKey, { count: number; monthly: number; yearly: number }[]>>> = {
  eur: { basic: [{ count: 5, monthly: 12, yearly: 96 }, { count: 10, monthly: 20, yearly: 160 }], professional: [{ count: 15, monthly: 29, yearly: 232 }, { count: 25, monthly: 45, yearly: 360 }], advanced: [{ count: 25, monthly: 49, yearly: 490 }, { count: 50, monthly: 89, yearly: 890 }] },
  usd: { basic: [{ count: 5, monthly: 15, yearly: 120 }, { count: 10, monthly: 25, yearly: 200 }], professional: [{ count: 15, monthly: 35, yearly: 280 }, { count: 25, monthly: 55, yearly: 440 }], advanced: [{ count: 25, monthly: 65, yearly: 650 }, { count: 50, monthly: 115, yearly: 1150 }] },
};
export const X_LINKS_ADDON: Record<Currency, number> = { eur: 18, usd: 19 };
export const BUSINESS_EXTRA_PROFILE: Record<Currency, number> = { eur: 0.75, usd: 1 };

export const PLAN_LIMITS: Record<PlanKey, { uploads: number | null; profiles: number; ffmpegMinutes: number; aiShorts: number; seats: number; whitelabel: boolean; priority: boolean; tiktok: boolean; order: number }> = {
  free: { uploads: 10, profiles: 2, ffmpegMinutes: 30, aiShorts: 10, seats: 1, whitelabel: false, priority: false, tiktok: false, order: 0 },
  basic: { uploads: null, profiles: 5, ffmpegMinutes: 300, aiShorts: 100, seats: 1, whitelabel: false, priority: false, tiktok: true, order: 1 },
  professional: { uploads: null, profiles: 25, ffmpegMinutes: 1000, aiShorts: 300, seats: 2, whitelabel: true, priority: false, tiktok: true, order: 2 },
  advanced: { uploads: null, profiles: 75, ffmpegMinutes: 3000, aiShorts: 600, seats: 5, whitelabel: true, priority: true, tiktok: true, order: 3 },
  business: { uploads: null, profiles: 225, ffmpegMinutes: 10000, aiShorts: 1000, seats: 10, whitelabel: true, priority: true, tiktok: true, order: 4 },
};
export const PLAN_KEYS: PlanKey[] = ['free', 'basic', 'professional', 'advanced', 'business'];

const EUR_LANGS = ['es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'fi', 'da', 'no', 'pl', 'cs', 'sk', 'hu', 'ro', 'el', 'bg'];
export function currencyForLang(lang: string): Currency { return EUR_LANGS.includes(lang.split('-')[0].toLowerCase()) ? 'eur' : 'usd'; }
export function fmtPrice(n: number, cur: Currency, locale = 'en-US'): string {
  const sym = cur === 'eur' ? '€' : '$';
  return sym + Number(n).toLocaleString(locale, { minimumFractionDigits: n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
}
