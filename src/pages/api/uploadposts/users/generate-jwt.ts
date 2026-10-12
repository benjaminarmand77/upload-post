import { route, requireUser, json, err, readBody, str, list, bool } from '../../../../server/api';
import { getProfile } from '../../../../server/uploads';
import { createConnectLink } from '../../../../server/connect';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const username = str(fields.username); if (!username) return err(400, 'username is required', 'missing_parameter');
  const p = getProfile(user.id, username); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const platforms = list(fields.platforms);
  const link = createConnectLink(user, p, { redirect_url: str(fields.redirect_url), logo_image: str(fields.logo_image), redirect_button_text: str(fields.redirect_button_text), connect_title: str(fields.connect_title), connect_description: str(fields.connect_description), platforms: platforms.length ? platforms : undefined, show_calendar: fields.show_calendar === undefined ? true : bool(fields.show_calendar, true), language: str(fields.language), ui_labels: typeof fields.ui_labels === 'object' ? fields.ui_labels : undefined });
  return json({ success: true, access_url: link.url, duration: '48h', expires_at: link.expires_at });
});
