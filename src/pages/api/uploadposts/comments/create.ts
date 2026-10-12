import { route, requireUser, json, err, readBody, str, oneOf } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { createComment, resolvePost } from '../../../../server/interactions';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const platform = oneOf(fields.platform, ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'] as const, 'platform'); const u = str(fields.user); const message = str(fields.message);
  if (!platform || !u || !message) return err(400, 'platform, user and message are required', 'missing_parameter');
  const targets = [fields.comment_id, fields.post_id, fields.post_url].filter(Boolean); if (targets.length !== 1 && !(platform === 'tiktok' && fields.post_id)) return err(400, 'Provide exactly one of comment_id, post_id or post_url', 'invalid_parameter');
  if (platform === 'instagram' && !fields.comment_id) return err(400, 'Instagram supports replies only: comment_id is required', 'invalid_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, platform); if (!acc) return err(400, `No ${platform} account connected`, 'account_not_connected');
  const postId = fields.comment_id ? null : resolvePost(acc, user.id, str(fields.post_id), str(fields.post_url));
  const id = createComment(acc, { postId, commentId: str(fields.comment_id), message });
  return json({ success: true, id, message: fields.comment_id ? 'Reply posted' : 'Comment posted' });
});
