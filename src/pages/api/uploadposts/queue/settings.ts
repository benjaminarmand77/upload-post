import { route, requireUser, json, err, readBody, str } from '../../../../server/api';
import { getProfile } from '../../../../server/uploads';
import { getQueueSettings, setQueueSettings } from '../../../../server/queue';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const u = ctx.url.searchParams.get('profile_username') || ctx.url.searchParams.get('user');
  if (!u) return err(400, 'profile_username is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  return json({ success: true, queue_settings: getQueueSettings(p.id) });
});
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const u = str(fields.profile_username) || str(fields.user); if (!u) return err(400, 'profile_username is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const slots = typeof fields.slots === 'string' ? JSON.parse(fields.slots) : fields.slots; const days = typeof fields.days_of_week === 'string' ? JSON.parse(fields.days_of_week) : fields.days_of_week;
  return json({ success: true, queue_settings: setQueueSettings(p.id, { timezone: str(fields.timezone), slots, days_of_week: days }) });
});
