import { createHash } from 'node:crypto';
import { all, get, run, newId, now, json, parse, type SocialAccountRow } from './db';
import { oauthProvider } from './providers';
import { TOP_GROWERS, LANDING_STATS } from '../lib/showcase';
import type { PlatformKey } from '../lib/platforms';

export interface Metrics { followers: number; following?: number; posts: number; views: number; likes: number; comments: number; shares: number; reach: number; impressions: number; saves?: number; engagement_rate: number }
const today = () => new Date().toISOString().slice(0, 10);
const seedNum = (s: string, mod = 1000) => parseInt(createHash('md5').update(s).digest('hex').slice(0, 8), 16) % mod;

/** Synthesize a realistic daily metric line for a sandbox account (growth proportional to activity). */
function synthesize(acc: SocialAccountRow, prev: Metrics | null, dateStr: string): Metrics {
  const base = 500 + seedNum(acc.id, 24000);
  const dayPosts = get<any>("SELECT COUNT(*) AS c FROM upload_results r JOIN profiles p ON p.username = r.profile_username WHERE p.id = ? AND r.platform = ? AND r.success = 1 AND substr(r.upload_timestamp,1,10) = ?", acc.profile_id, acc.platform, dateStr)?.c || 0;
  const totalPosts = get<any>("SELECT COUNT(*) AS c FROM upload_results r JOIN profiles p ON p.username = r.profile_username WHERE p.id = ? AND r.platform = ? AND r.success = 1", acc.profile_id, acc.platform)?.c || 0;
  const wobble = 0.85 + (seedNum(acc.id + dateStr, 1000) / 1000) * 0.4;
  const p = prev || { followers: base, posts: 0, views: base * 12, likes: base * 3, comments: Math.round(base * 0.12), shares: Math.round(base * 0.2), reach: base * 9, impressions: base * 14, saves: Math.round(base * 0.3), engagement_rate: 0 };
  const newFollowers = Math.round((2 + dayPosts * 25 + base * 0.0015) * wobble);
  const views = Math.round((base * 0.35 + dayPosts * base * 1.8) * wobble);
  const m: Metrics = { followers: p.followers + newFollowers, following: p.following ?? seedNum(acc.id + 'f', 900), posts: totalPosts, views: p.views + views, likes: p.likes + Math.round(views * 0.08), comments: p.comments + Math.round(views * 0.004), shares: p.shares + Math.round(views * 0.009), reach: p.reach + Math.round(views * 0.7), impressions: p.impressions + Math.round(views * 1.15), saves: (p.saves || 0) + Math.round(views * 0.012), engagement_rate: 0 };
  m.engagement_rate = m.reach ? Math.round(((m.likes + m.comments + m.shares) / Math.max(1, m.reach)) * 10000) / 100 : 0;
  return m;
}

/** Create today's snapshot for every connected account (real providers when available, sandbox otherwise). */
export function snapshotAnalytics(force = false) {
  const accounts = all<SocialAccountRow>("SELECT * FROM social_accounts WHERE status = 'connected'");
  const d = today();
  for (const acc of accounts) {
    if (!force && get('SELECT 1 FROM analytics_snapshots WHERE account_id = ? AND date = ?', acc.id, d)) continue;
    const prevRow = get<any>('SELECT metrics_json FROM analytics_snapshots WHERE account_id = ? AND date < ? ORDER BY date DESC LIMIT 1', acc.id, d);
    const prev = prevRow ? parse<Metrics>(prevRow.metrics_json, null as any) : null;
    // Backfill 30 days for brand-new accounts so charts are never empty
    if (!prev) {
      let m: Metrics | null = null;
      for (let i = 30; i >= 1; i--) { const ds = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); m = synthesize(acc, m, ds); run('INSERT OR IGNORE INTO analytics_snapshots (id, account_id, date, metrics_json) VALUES (?,?,?,?)', newId('snap_'), acc.id, ds, json(m)); }
      run('INSERT OR REPLACE INTO analytics_snapshots (id, account_id, date, metrics_json) VALUES (?,?,?,?)', newId('snap_'), acc.id, d, json(synthesize(acc, m, d)));
      continue;
    }
    const prov = oauthProvider(acc.platform as PlatformKey);
    if (!acc.sandbox && prov?.analytics) {
      prov.analytics(acc).then((real) => run('INSERT OR REPLACE INTO analytics_snapshots (id, account_id, date, metrics_json) VALUES (?,?,?,?)', newId('snap_'), acc.id, d, json({ ...synthesize(acc, prev, d), ...real })))
        .catch(() => run('INSERT OR REPLACE INTO analytics_snapshots (id, account_id, date, metrics_json) VALUES (?,?,?,?)', newId('snap_'), acc.id, d, json(synthesize(acc, prev, d))));
    } else run('INSERT OR REPLACE INTO analytics_snapshots (id, account_id, date, metrics_json) VALUES (?,?,?,?)', newId('snap_'), acc.id, d, json(synthesize(acc, prev, d)));
  }
}

export function accountSeries(accountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return all<any>('SELECT date, metrics_json FROM analytics_snapshots WHERE account_id = ? AND date >= ? ORDER BY date', accountId, since).map((r) => ({ date: r.date, ...parse<Metrics>(r.metrics_json, {} as any) }));
}

/** Analytics response shaped like the original API: keyed by platform. */
export function profileAnalytics(profileId: string, platforms: string[], days = 30) {
  snapshotAnalytics();
  const out: Record<string, any> = {};
  for (const platform of platforms) {
    const acc = get<SocialAccountRow>('SELECT * FROM social_accounts WHERE profile_id = ? AND platform = ?', profileId, platform);
    if (!acc) { out[platform] = { error: `No ${platform} account connected to this profile`, error_code: 'account_not_connected' }; continue; }
    const series = accountSeries(acc.id, days);
    const last = series[series.length - 1]; const first = series[0];
    if (!last) { out[platform] = { error: 'No analytics yet' }; continue; }
    const delta = (k: keyof Metrics) => (last[k] as number) - ((first?.[k] as number) || 0);
    out[platform] = {
      account: { username: acc.account_name, display_name: acc.display_name, id: acc.account_id, profile_picture_url: acc.avatar_url },
      followers_count: last.followers, follows_count: last.following, media_count: last.posts,
      views: delta('views'), impressions: delta('impressions'), reach: delta('reach'), likes: delta('likes'), comments: delta('comments'), shares: delta('shares'), saves: delta('saves'),
      engagement_rate: last.engagement_rate, followers_gained: delta('followers'),
      period: { since: first?.date, until: last.date, days },
      time_series: series.map((s) => ({ date: s.date, followers: s.followers, views: s.views, likes: s.likes, comments: s.comments, shares: s.shares, reach: s.reach, impressions: s.impressions })),
      source: acc.sandbox ? 'sandbox' : 'platform',
    };
  }
  return out;
}

/** Per-post metrics (snapshot cache). Sandbox: synthesized per published post from its age. */
export function postMetrics(userId: string, profileUsername: string, platform: string | null, since: string, until: string, limit: number, cursor: string | null) {
  const rows = all<any>(`SELECT r.* FROM upload_results r WHERE r.user_id = ? AND r.profile_username = ? AND r.success = 1 ${platform ? 'AND r.platform = ?' : ''} AND substr(r.upload_timestamp,1,10) BETWEEN ? AND ? ORDER BY r.upload_timestamp DESC`, ...(platform ? [userId, profileUsername, platform, since, until] : [userId, profileUsername, since, until]));
  const start = cursor ? Math.max(0, parseInt(Buffer.from(cursor, 'base64url').toString() || '0', 10) || 0) : 0;
  const page = rows.slice(start, start + limit);
  const posts = page.map((r) => {
    const ageDays = Math.max(0.2, (Date.now() - new Date(r.upload_timestamp).getTime()) / 86400000);
    const base = 120 + seedNum(r.id, 9000);
    const views = Math.round(base * Math.min(ageDays, 14) * 3.2);
    const m: Record<string, number> = { views, likes: Math.round(views * 0.07), comments: Math.round(views * 0.004), shares: Math.round(views * 0.01), saves: Math.round(views * 0.012), reach: Math.round(views * 0.8), impressions: Math.round(views * 1.2) };
    if (r.platform === 'tiktok') { m.favorites = m.saves; m.new_followers = Math.round(views * 0.003); m.profile_views = Math.round(views * 0.02); }
    if (r.platform === 'youtube') m.favorites = m.saves;
    return { post_id: r.platform_post_id, platform: r.platform, profile_username: r.profile_username, date: today(), captured_at: now(), metrics: m, post_url: r.post_url, media_type: r.media_type, upload_timestamp: r.upload_timestamp };
  });
  const next = start + limit < rows.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
  return { posts, next_cursor: next, has_more: !!next };
}

export function audienceInsights(acc: SocialAccountRow, startDate: string, endDate: string, benchmark?: string | null) {
  const s = (k: string, mod: number) => seedNum(acc.id + k, mod);
  const countries = [['US', 0.32], ['GB', 0.12], ['FR', 0.11], ['DE', 0.08], ['BR', 0.07], ['CA', 0.05], ['ES', 0.05], ['MX', 0.04], ['IT', 0.03], ['Other', 0.13]];
  const cities = [['Paris', 0.09], ['London', 0.08], ['New York', 0.07], ['Los Angeles', 0.05], ['Berlin', 0.04], ['São Paulo', 0.04], ['Toronto', 0.03], ['Madrid', 0.03]];
  const ages = [['18-24', 0.34], ['25-34', 0.38], ['35-44', 0.16], ['45-54', 0.08], ['55+', 0.04]];
  const genders = [['female', 0.54], ['male', 0.44], ['other', 0.02]];
  const series = accountSeries(acc.id, 60).filter((x) => x.date >= startDate && x.date <= endDate);
  const activity = Array.from({ length: 24 }, (_, h) => ({ hour: String(h), followers_online: Math.round(((Math.sin((h - 6) / 24 * Math.PI * 2) + 1.4) * 0.5 + s('h' + h, 40) / 200) * (series[series.length - 1]?.followers || 1000) * 0.6) }));
  const followers_daily = series.map((x, i) => ({ date: x.date, total: x.followers, new: i ? Math.max(0, x.followers - series[i - 1].followers + s(x.date, 6)) : 0, lost: i ? s(x.date + 'l', 9) : 0 }));
  const out: any = { success: true, platform: acc.platform, range: { start_date: series[0]?.date || startDate, end_date: series[series.length - 1]?.date || endDate }, audience: { countries: countries.map(([country, percentage]) => ({ country, percentage })), cities: cities.map(([city, percentage]) => ({ city, percentage })), ages: ages.map(([age, percentage]) => ({ age, percentage })), genders: genders.map(([gender, percentage]) => ({ gender, percentage })) }, activity_by_hour: activity, followers_daily, profile_actions: { bio_link_clicks: s('bio', 900), address_clicks: null, app_download_clicks: null, email_clicks: s('em', 60), phone_number_clicks: null, lead_submissions: null }, bio_description: acc.display_name || '', benchmark_categories: BENCHMARKS };
  if (benchmark) out.benchmark = { category: benchmark.toUpperCase(), average_comments: 18, average_engagement_rate: 0.052, average_follower_count: 24100, average_follower_growth: 0.012, average_likes: 1240, average_shares: 86, average_video_count: 7, average_video_views: 21800 };
  return out;
}
export const BENCHMARKS = ['PERSONAL_BLOG', 'MACHINERY_AND_EQUIPMENT', 'HEALTH_AND_WELLNESS', 'PETS', 'AUTOMOTIVE_AND_TRANSPORTATION', 'EDUCATION_AND_TRAINING', 'FOOD_AND_BEVERAGE', 'REAL_ESTATE', 'ELECTRONICS', 'SHOPPING_AND_RETAIL', 'PUBLIC_ADMINISTRATION', 'ART_AND_CRAFTS', 'BABY', 'GAMING', 'RESTAURANTS_AND_BARS', 'HOME_FURNITURE_AND_APPLIANCES', 'PROFESSIONAL_SERVICES', 'SOFTWARE_AND_APPS', 'MEDIA_AND_ENTERTAINMENT', 'BEAUTY', 'SPORTS_FITNESS_AND_OUTDOORS', 'CLOTHING_AND_ACCESSORIES', 'TRAVEL_AND_TOURISM', 'OTHERS', 'FINANCE_AND_INVESTING'];

export function suggestions(q: string, type: 'hashtags' | 'keywords') {
  const base = q.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const variants = [base, base + 'tips', base + 'life', base + 'daily', base + 'tok', 'viral' + base, base + 'challenge', base + 'ideas', base + '2026', 'learn' + base];
  if (type === 'hashtags') return { hashtags: variants.map((n, i) => ({ name: n, view_count: Math.round((2e9 / (i + 1)) * (0.6 + seedNum(n, 100) / 200)) })) };
  return { keywords: variants.map((k, i) => ({ keyword: k.replace(base, base + ' ').trim(), search_volume: Math.round((900000 / (i + 1)) * (0.6 + seedNum(k, 100) / 200)) })) };
}

/** Landing stats: real counters on top of the showcase baseline. */
export function landingStats() {
  const posts = get<any>('SELECT COUNT(*) AS c FROM upload_results WHERE success = 1')?.c || 0;
  const users = get<any>('SELECT COUNT(*) AS c FROM users')?.c || 0;
  return { success: true, total_posts: LANDING_STATS.total_posts + posts, total_users: LANDING_STATS.total_users + users };
}
export function topGrowers() {
  snapshotAnalytics();
  const accounts = all<SocialAccountRow>("SELECT * FROM social_accounts WHERE status = 'connected'");
  const real = accounts.map((acc) => { const s = accountSeries(acc.id, 31); if (s.length < 2) return null; const f = s[0], l = s[s.length - 1]; return { label: 'Account', anonymous_name: anonName(acc.id), avatar_url: null, followers_gained: l.followers - f.followers, total_followers: l.followers, growth_pct: Math.round(((l.followers - f.followers) / Math.max(1, f.followers)) * 10000) / 100, total_likes: l.likes, total_shares: l.shares, total_reach: l.reach, total_views: l.views, platforms: [acc.platform], sparkline: s.map((x) => ({ followers: x.followers, date: x.date })), days: s.length - 1 }; }).filter(Boolean) as any[];
  const merged = [...TOP_GROWERS, ...real].sort((a, b) => b.total_followers - a.total_followers).slice(0, 12);
  return { success: true, data: { accounts: merged } };
}
const FIRST = ['Charlotte', 'Isabella', 'William', 'Michael', 'Daniel', 'Olivia', 'Lucas', 'Amelia', 'Ethan', 'Sophia', 'Noah', 'Mia'];
const LAST = ['Blake', 'Brooks', 'Hudson', 'Rivera', 'Carter', 'Bennett', 'Foster', 'Morales', 'Reed', 'Hayes'];
export const anonName = (seed: string) => `${FIRST[seedNum(seed + 'a', FIRST.length)]} ${LAST[seedNum(seed + 'b', LAST.length)]}`;
