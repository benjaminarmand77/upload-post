import { get, run, all, now, parse, json } from './db';
import { ApiError } from './api';

export interface QueueSlot { hour: number; minute: number }
export interface QueueSettings { timezone: string; slots: QueueSlot[]; days_of_week: number[] }
const DEFAULT: QueueSettings = { timezone: 'UTC', slots: [{ hour: 9, minute: 0 }, { hour: 13, minute: 0 }, { hour: 18, minute: 0 }], days_of_week: [0, 1, 2, 3, 4] };

export function isValidTimezone(tz: string) { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; } }

export function getQueueSettings(profileId: string): QueueSettings {
  const r = get<any>('SELECT * FROM queue_settings WHERE profile_id = ?', profileId);
  if (!r) return { ...DEFAULT };
  return { timezone: r.timezone || 'UTC', slots: parse(r.slots_json, DEFAULT.slots), days_of_week: parse(r.days_json, DEFAULT.days_of_week) };
}
export function setQueueSettings(profileId: string, s: Partial<QueueSettings>): QueueSettings {
  const cur = getQueueSettings(profileId);
  const next: QueueSettings = { timezone: s.timezone ?? cur.timezone, slots: s.slots ?? cur.slots, days_of_week: s.days_of_week ?? cur.days_of_week };
  if (!isValidTimezone(next.timezone)) throw new ApiError(400, `Invalid timezone: ${next.timezone}`, 'invalid_timezone');
  if (!Array.isArray(next.slots) || next.slots.length === 0 || next.slots.length > 24) throw new ApiError(400, 'slots must contain between 1 and 24 entries', 'invalid_slots');
  for (const sl of next.slots) if (!(Number.isInteger(sl.hour) && sl.hour >= 0 && sl.hour <= 23 && Number.isInteger(sl.minute) && sl.minute >= 0 && sl.minute <= 59)) throw new ApiError(400, 'Each slot needs hour 0-23 and minute 0-59', 'invalid_slots');
  next.slots = [...next.slots].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  if (!Array.isArray(next.days_of_week) || next.days_of_week.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new ApiError(400, 'days_of_week must contain integers 0 (Monday) to 6 (Sunday)', 'invalid_days');
  run('INSERT INTO queue_settings (profile_id, timezone, slots_json, days_json, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET timezone = excluded.timezone, slots_json = excluded.slots_json, days_json = excluded.days_json, updated_at = excluded.updated_at',
    profileId, next.timezone, json(next.slots), json(next.days_of_week), now());
  return next;
}

/** Offset (minutes) of a timezone at a given UTC instant. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(at)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}
/** Convert a wall-clock time in a timezone to a UTC Date. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMinutes(tz, guess);
  const utc = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffsetMinutes(tz, utc);
  return off2 === off ? utc : new Date(guess.getTime() - off2 * 60000);
}
/** Interpret an ISO string without zone as local time in tz. */
export function interpretInTimezone(iso: string, tz?: string | null): Date {
  if (!tz || /([zZ]|[+-]\d\d:?\d\d)$/.test(iso)) return new Date(iso);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return new Date(iso);
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
}
export function formatLocal(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return f.format(d).replace(' ', 'T');
}

export interface PreviewSlot { datetime_utc: string; datetime_local: string; available: boolean; is_queue_slot: boolean; scheduled_post: { job_id: string; title: string; platforms: string[] } | null }

/** Compute upcoming queue slots for a profile, merging posts already scheduled. */
export function previewQueue(profileId: string, count = 10): { timezone: string; slots: PreviewSlot[]; next_available: string | null } {
  const s = getQueueSettings(profileId);
  const taken = all<any>("SELECT j.job_id, j.scheduled_date, u.title, u.platforms_json FROM scheduled_jobs j JOIN uploads u ON u.id = j.upload_id WHERE j.profile_id = ? AND j.status = 'pending' ORDER BY j.scheduled_date", profileId);
  const byIso = new Map(taken.map((t) => [new Date(t.scheduled_date).toISOString(), t]));
  const slots: PreviewSlot[] = [];
  const nowMs = Date.now();
  const startLocal = new Date(nowMs + tzOffsetMinutes(s.timezone, new Date(nowMs)) * 60000);
  let y = startLocal.getUTCFullYear(), m = startLocal.getUTCMonth() + 1, d = startLocal.getUTCDate();
  for (let day = 0; day < 120 && slots.length < count; day++) {
    const dt = new Date(Date.UTC(y, m - 1, d + day));
    const dow = (dt.getUTCDay() + 6) % 7; // 0 = Monday
    if (!s.days_of_week.includes(dow)) continue;
    for (const sl of s.slots) {
      const utc = zonedToUtc(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), sl.hour, sl.minute, s.timezone);
      if (utc.getTime() <= nowMs + 60000) continue;
      const iso = utc.toISOString();
      const t = byIso.get(iso);
      slots.push({ datetime_utc: iso, datetime_local: formatLocal(utc, s.timezone), available: !t, is_queue_slot: true, scheduled_post: t ? { job_id: t.job_id, title: t.title || '', platforms: parse(t.platforms_json, []) } : null });
      if (slots.length >= count) break;
    }
  }
  // Also surface non-slot scheduled posts within the window
  const first = slots[0]?.datetime_utc, last = slots[slots.length - 1]?.datetime_utc;
  for (const t of taken) {
    const iso = new Date(t.scheduled_date).toISOString();
    if (!byIso.has(iso) || slots.some((x) => x.datetime_utc === iso)) continue;
    if (first && last && iso >= first && iso <= last) slots.push({ datetime_utc: iso, datetime_local: formatLocal(new Date(iso), s.timezone), available: false, is_queue_slot: false, scheduled_post: { job_id: t.job_id, title: t.title || '', platforms: parse(t.platforms_json, []) } });
  }
  slots.sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc));
  return { timezone: s.timezone, slots, next_available: slots.find((x) => x.available)?.datetime_utc ?? null };
}
export function nextQueueSlot(profileId: string) { const p = previewQueue(profileId, 200); const n = p.slots.find((x) => x.available); return n ? { datetime_utc: n.datetime_utc, datetime_local: n.datetime_local, timezone: p.timezone } : null; }
