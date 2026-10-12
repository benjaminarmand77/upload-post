import { route, requireUser, json, err, readBody, str, oneOf } from '../../../../server/api';
import { get, run, now } from '../../../../server/db';
import { getProfile, accountFor } from '../../../../server/uploads';
import { oauthProvider } from '../../../../server/providers';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const platform = oneOf(fields.platform, ['facebook', 'youtube', 'x', 'linkedin', 'threads'] as const, 'platform');
  if (!platform) return err(400, 'platform is required (facebook, youtube, x, linkedin, threads). Instagram and TikTok do not support deletion via API.', 'missing_parameter');
  const u = str(fields.user); const postId = str(fields.post_id); if (!u || !postId) return err(400, 'user and post_id are required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  const acc = accountFor(p.id, platform); if (!acc) return err(400, `No ${platform} account connected`, 'account_not_connected');
  const r = get<any>('SELECT id FROM upload_results WHERE user_id = ? AND platform = ? AND platform_post_id = ?', user.id, platform, postId);
  if (!acc.sandbox) { const prov = oauthProvider(platform); if (!prov?.unpublish) return err(400, 'Deletion not supported', 'unsupported'); try { await prov.unpublish(acc, postId); } catch (e: any) { return err(403, `Could not delete post: ${e.message}`, 'platform_error'); } }
  else if (!r) return err(404, 'No post found for the given post_id', 'not_found');
  if (r) run("UPDATE upload_results SET message = 'Unpublished', post_url = NULL, meta_json = json_set(COALESCE(meta_json,'{}'), '$.unpublished_at', ?) WHERE id = ?", now(), r.id);
  return json({ success: true, message: `Post ${postId} deleted from ${platform}` });
});
