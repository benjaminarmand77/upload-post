import { createHmac } from 'node:crypto';
import { get, run, newId, now, parse, json, all } from './db';

export interface NotificationSettings { channels: { webhook: boolean; telegram: boolean }; webhook_url: string | null; telegram_chat_id: string | null; webhook_events: string[]; webhook_secret?: string | null }
export const ALL_EVENTS = ['upload_completed', 'social_account.connected', 'social_account.disconnected', 'social_account.reauth_required'] as const;

export function getNotifications(userId: string): NotificationSettings {
  const r = get<any>('SELECT * FROM notifications WHERE user_id = ?', userId);
  if (!r) return { channels: { webhook: false, telegram: false }, webhook_url: null, telegram_chat_id: null, webhook_events: [...ALL_EVENTS], webhook_secret: null };
  return { channels: parse(r.channels_json, { webhook: false, telegram: false }), webhook_url: r.webhook_url, telegram_chat_id: r.telegram_chat_id, webhook_events: parse(r.webhook_events_json, [...ALL_EVENTS]), webhook_secret: r.webhook_secret };
}
export function setNotifications(userId: string, s: Partial<NotificationSettings>): NotificationSettings {
  const cur = getNotifications(userId);
  const next: NotificationSettings = { channels: { ...cur.channels, ...(s.channels || {}) }, webhook_url: s.webhook_url ?? cur.webhook_url, telegram_chat_id: s.telegram_chat_id ?? cur.telegram_chat_id, webhook_events: s.webhook_events ?? cur.webhook_events, webhook_secret: cur.webhook_secret || newId('whsec_', 16) };
  run('INSERT INTO notifications (user_id, channels_json, webhook_url, webhook_secret, telegram_chat_id, webhook_events_json, updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET channels_json = excluded.channels_json, webhook_url = excluded.webhook_url, webhook_secret = excluded.webhook_secret, telegram_chat_id = excluded.telegram_chat_id, webhook_events_json = excluded.webhook_events_json, updated_at = excluded.updated_at',
    userId, json(next.channels), next.webhook_url, next.webhook_secret, next.telegram_chat_id, json(next.webhook_events), now());
  return next;
}

/** Deliver an event to the user's webhook (signed) and/or Telegram. Never throws. */
export async function emitEvent(userId: string, event: string, payload: Record<string, any>) {
  const s = getNotifications(userId);
  const body = { event, ...payload, created_at: now() };
  if (s.channels.webhook && s.webhook_url && s.webhook_events.includes(event)) {
    const id = newId('whd_');
    const raw = JSON.stringify(body);
    const sig = createHmac('sha256', s.webhook_secret || '').update(raw).digest('hex');
    let status = 'failed', code: number | null = null, text = '';
    try {
      const res = await fetch(s.webhook_url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Upload-Post-Webhook/1.0', 'x-uploadpost-signature': `sha256=${sig}`, 'x-uploadpost-event': event }, body: raw, signal: AbortSignal.timeout(10000) });
      code = res.status; text = (await res.text().catch(() => '')).slice(0, 500); status = res.ok ? 'delivered' : 'failed';
    } catch (e: any) { text = String(e?.message || e).slice(0, 500); }
    run('INSERT INTO webhook_deliveries (id, user_id, event, url, payload_json, status, response_code, response_body, created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, userId, event, s.webhook_url, raw, status, code, text, now());
  }
  if (s.channels.telegram && s.telegram_chat_id && process.env.TELEGRAM_NOTIFY_BOT_TOKEN) {
    const msg = event === 'upload_completed'
      ? `${payload.result?.success ? '✅' : '❌'} ${payload.platform}: ${payload.title || ''}${payload.result?.url ? `\n${payload.result.url}` : ''}${payload.result?.error ? `\n${payload.result.error}` : ''}`
      : `🔔 ${event} — ${payload.platform || ''} ${payload.account_name || ''}`;
    fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_NOTIFY_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: s.telegram_chat_id, text: msg }) }).catch(() => {});
  }
}
export function listDeliveries(userId: string, limit = 50) { return all('SELECT id, event, url, status, response_code, created_at, payload_json FROM webhook_deliveries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, limit); }
