import { route, requireUser, json, err, readBody, str, oneOf } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { commentAction } from '../../../../server/interactions';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const platform = str(fields.platform); if (platform !== 'tiktok') return err(400, 'Only tiktok supports comment actions today', 'platform_not_supported');
  const u = str(fields.user); const cid = str(fields.comment_id); const action = oneOf(fields.action, ['hide', 'unhide', 'like', 'unlike', 'pin', 'unpin'] as const, 'action');
  if (!u || !cid || !action) return err(400, 'user, comment_id and action are required', 'missing_parameter');
  if (['hide', 'unhide', 'pin', 'unpin'].includes(action) && !fields.post_id) return err(400, `post_id is required for ${action}`, 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, 'tiktok'); if (!acc) return err(400, 'No TikTok account connected', 'account_not_connected');
  commentAction(acc, cid, action); return json({ success: true, platform, action, comment_id: cid });
});
