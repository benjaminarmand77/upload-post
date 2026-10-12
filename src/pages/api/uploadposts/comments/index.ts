import { route, requireUser, json, err, oneOf, int } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { listComments, resolvePost } from '../../../../server/interactions';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const q = ctx.url.searchParams;
  const platform = oneOf(q.get('platform'), ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'] as const, 'platform', 'instagram')!;
  const u = q.get('user'); if (!u) return err(400, 'user is required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, platform); if (!acc) return err(400, `No ${platform} account connected`, 'account_not_connected');
  const postId = resolvePost(acc, user.id, q.get('post_id'), q.get('post_url'));
  return json({ success: true, platform, post_id: postId, ...listComments(acc, postId, q.get('comment_id'), Math.min(100, int(q.get('limit'), 25)!), q.get('after')) });
});
