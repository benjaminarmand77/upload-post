import { route, requireUser, json, err, readBody, str, list } from '../../../../server/api';
import { getNotifications, setNotifications, ALL_EVENTS, listDeliveries } from '../../../../server/webhooks';
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); const n = getNotifications(user.id); return json({ success: true, notifications: { channels: n.channels, webhook_url: n.webhook_url, telegram_chat_id: n.telegram_chat_id, webhook_events: n.webhook_events, webhook_secret: n.webhook_secret }, recent_deliveries: listDeliveries(user.id, 20) }); });
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const channels = typeof fields.channels === 'string' ? JSON.parse(fields.channels) : fields.channels;
  const url = str(fields.webhook_url); if (url && !/^https?:\/\//.test(url)) return err(400, 'webhook_url must be an http(s) URL', 'invalid_parameter');
  const events = fields.webhook_events === undefined ? undefined : list(fields.webhook_events);
  if (events && events.some((e) => !(ALL_EVENTS as readonly string[]).includes(e))) return err(400, `webhook_events must be among: ${ALL_EVENTS.join(', ')}`, 'invalid_parameter');
  const n = setNotifications(user.id, { channels, webhook_url: url ?? undefined, telegram_chat_id: str(fields.telegram_chat_id), webhook_events: events && events.length ? events : events ? [...ALL_EVENTS] : undefined });
  return json({ success: true, notifications: { channels: n.channels, webhook_url: n.webhook_url, telegram_chat_id: n.telegram_chat_id, webhook_events: n.webhook_events, webhook_secret: n.webhook_secret } });
});
