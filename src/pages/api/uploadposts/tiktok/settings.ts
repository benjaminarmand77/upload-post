import { route, requireUser, json, err } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { parse } from '../../../../server/db';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx); const pu = ctx.url.searchParams.get('profile') || ctx.url.searchParams.get('user'); if (!pu) return err(400, 'profile is required', 'missing_parameter');
  const p = getProfile(user.id, pu); if (!p) return err(404, 'Profile not found', 'profile_not_found'); const acc = accountFor(p.id, 'tiktok'); if (!acc) return err(409, 'Profile has no TikTok account connected', 'account_not_connected');
  const meta = parse(acc.meta_json, {} as any);
  return json({ success: true, privacy_level_options: meta.privacy_level_options || ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'], max_video_post_duration_sec: meta.max_video_post_duration_sec || 600, comment_disabled: !!meta.comment_disabled, duet_disabled: !!meta.duet_disabled, stitch_disabled: !!meta.stitch_disabled, creator_username: acc.account_name, creator_nickname: acc.display_name });
});
