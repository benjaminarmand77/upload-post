import { route, requireUser, json, err, readBody, str } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { privateReply } from '../../../../server/interactions';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  if (str(fields.platform) !== 'instagram') return err(400, "platform must be 'instagram'", 'invalid_parameter');
  const u = str(fields.user); const cid = str(fields.comment_id); const message = str(fields.message); if (!u || !cid || !message) return err(400, 'user, comment_id and message are required', 'missing_parameter');
  const buttons = Array.isArray(fields.buttons) ? fields.buttons.slice(0, 3) : undefined;
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, 'instagram'); if (!acc) return err(400, 'No Instagram account connected', 'account_not_connected');
  const r = privateReply(acc, cid, message, buttons); return json({ success: true, ...r, message: 'Private reply sent' });
});
