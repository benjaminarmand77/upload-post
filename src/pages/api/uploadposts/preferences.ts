import { route, requireUser, json, readBody, str } from '../../../server/api';
import { run, parse, json as J } from '../../../server/db';
import { isValidTimezone } from '../../../server/queue';
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); return json({ success: true, preferences: { timezone: user.timezone, locale: user.locale, name: user.name, ...parse(user.settings_json, {}) } }); });
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const tz = str(fields.timezone); if (tz && !isValidTimezone(tz)) return json({ success: false, message: 'Invalid timezone' }, 400);
  const settings = { ...parse(user.settings_json, {}), ...(fields.settings || {}) };
  for (const k of ['email_notifications', 'default_profile', 'ai_language', 'marketing_emails']) if (fields[k] !== undefined) settings[k] = fields[k];
  run('UPDATE users SET timezone = COALESCE(?, timezone), locale = COALESCE(?, locale), name = COALESCE(?, name), settings_json = ? WHERE id = ?', tz ?? null, str(fields.locale) ?? null, str(fields.name) ?? null, J(settings), user.id);
  return json({ success: true, preferences: { timezone: tz ?? user.timezone, locale: str(fields.locale) ?? user.locale, name: str(fields.name) ?? user.name, ...settings } });
});
