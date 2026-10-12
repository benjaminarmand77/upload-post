import { PLAN_LIMITS, type PlanKey } from '../lib/pricing';
import { get, run, monthKey, type UserRow } from './db';
import { ApiError } from './api';

export function planOf(user: UserRow): PlanKey { return (user.plan in PLAN_LIMITS ? user.plan : 'free') as PlanKey; }
export function limitsOf(user: UserRow) { const l = PLAN_LIMITS[planOf(user)]; return { ...l, profiles: l.profiles + (user.extra_profiles || 0) }; }

export interface UsageRow { user_id: string; month: string; uploads: number; ffmpeg_minutes: number; ai_shorts: number; x_link_posts: number; last_reset: string | null }
export function usageOf(userId: string, month = monthKey()): UsageRow {
  let u = get<UsageRow>('SELECT * FROM usage WHERE user_id = ? AND month = ?', userId, month);
  if (!u) { run('INSERT INTO usage (user_id, month, last_reset) VALUES (?,?,?)', userId, month, new Date(month + '-01T00:00:00Z').toISOString()); u = get<UsageRow>('SELECT * FROM usage WHERE user_id = ? AND month = ?', userId, month)!; }
  return u;
}
export function usageInfo(user: UserRow) {
  const u = usageOf(user.id); const l = limitsOf(user);
  return { count: u.uploads, limit: l.uploads ?? 999999, last_reset: u.last_reset };
}
export function assertUploadQuota(user: UserRow, count = 1) {
  const l = limitsOf(user); if (l.uploads === null) return;
  const u = usageOf(user.id);
  if (u.uploads + count > l.uploads) throw new ApiError(429, `Monthly upload limit reached (${l.uploads} uploads on the ${planOf(user)} plan). Upgrade your plan to continue.`, 'upload_limit_reached', { usage: { count: u.uploads, limit: l.uploads, last_reset: u.last_reset } });
}
export function bumpUsage(userId: string, field: 'uploads' | 'ai_shorts' | 'x_link_posts', n = 1) { usageOf(userId); run(`UPDATE usage SET ${field} = ${field} + ? WHERE user_id = ? AND month = ?`, n, userId, monthKey()); }
export function bumpFfmpeg(userId: string, minutes: number) { usageOf(userId); run('UPDATE usage SET ffmpeg_minutes = ffmpeg_minutes + ? WHERE user_id = ? AND month = ?', minutes, userId, monthKey()); }
export function assertPlatformAllowed(user: UserRow, platform: string) {
  if (platform === 'tiktok' && !limitsOf(user).tiktok) throw new ApiError(403, 'TikTok publishing requires a paid plan (Basic or higher).', 'plan_upgrade_required');
}
export function assertProfileQuota(user: UserRow, currentCount: number) {
  const l = limitsOf(user);
  if (currentCount >= l.profiles) throw new ApiError(403, `Profile limit reached (${l.profiles} profiles on the ${planOf(user)} plan).`, 'profile_limit_reached', { limit: l.profiles, plan: planOf(user) });
}
