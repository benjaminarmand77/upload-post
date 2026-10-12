import { route, requireUser, json, err, readBody, str, oneOf } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { deleteComment } from '../../../../server/interactions';
const handler = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const platform = oneOf(fields.platform, ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'] as const, 'platform'); const u = str(fields.user); const cid = str(fields.comment_id);
  if (!platform || !u || !cid) return err(400, 'platform, user and comment_id are required', 'missing_parameter');
  if (platform === 'linkedin' && !fields.post_id) return err(400, 'LinkedIn requires post_id (the post URN)', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, platform); if (!acc) return err(400, `No ${platform} account connected`, 'account_not_connected');
  deleteComment(acc, cid); return json({ success: true, message: 'Comment deleted' });
});
export const DELETE = handler; export const POST = handler;
