import type { APIContext } from 'astro';
import { requireUser, readBody, str, bool, list, oneOf, ApiError, json } from './api';
import { createUpload, type MediaType } from './uploads';

const ENUMS: Record<string, readonly string[]> = {
  privacy_level: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
  post_mode: ['DIRECT_POST', 'MEDIA_UPLOAD'],
  share_mode: ['CUSTOM', 'TRIAL_REELS_SHARE_TO_FOLLOWERS_IF_LIKED', 'TRIAL_REELS_DONT_SHARE_TO_FOLLOWERS'],
  visibility: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
  privacyStatus: ['public', 'unlisted', 'private'],
  license: ['youtube', 'creativeCommon'],
  video_state: ['DRAFT', 'PUBLISHED'],
  reply_settings: ['following', 'mentionedUsers', 'subscribers', 'verified'],
  poll_reply_settings: ['following', 'mentionedUsers', 'subscribers', 'verified'],
};
const MEDIA_TYPE_ENUM: Record<MediaType, string[]> = { video: ['REELS', 'STORIES'], photo: ['IMAGE', 'STORIES'], text: [], document: [] };
const FB_MEDIA_TYPE: Record<MediaType, string[]> = { video: ['REELS', 'STORIES'], photo: ['POSTS', 'STORIES'], text: [], document: [] };
const ARRAYS = ['tags', 'poll_options', 'tagged_user_ids', 'exclude_reply_user_ids'];

export function uploadEndpoint(mediaType: MediaType) {
  return async (ctx: APIContext) => {
    const { user } = requireUser(ctx);
    const { fields, files } = await readBody(ctx.request);
    const profileUsername = str(fields.user); if (!profileUsername) throw new ApiError(400, 'Missing required parameter: user (profile username)', 'missing_parameter');
    const platforms = list(fields.platform ?? fields['platform[]'] ?? fields.platforms);
    const params: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (['user', 'platform', 'platforms', 'title', 'description', 'scheduled_date', 'timezone', 'async_upload', 'add_to_queue'].includes(k)) continue;
      params[k] = ARRAYS.includes(k) ? list(v) : Array.isArray(v) && !['photos'].includes(k) ? v[0] : v;
    }
    for (const [k, allowed] of Object.entries(ENUMS)) if (params[k] !== undefined) params[k] = oneOf(params[k], allowed, k);
    if (params.media_type !== undefined && MEDIA_TYPE_ENUM[mediaType].length) params.media_type = oneOf(params.media_type, MEDIA_TYPE_ENUM[mediaType], 'media_type');
    if (params.facebook_media_type !== undefined && FB_MEDIA_TYPE[mediaType].length) params.facebook_media_type = oneOf(params.facebook_media_type, FB_MEDIA_TYPE[mediaType], 'facebook_media_type');
    if (mediaType === 'document' && platforms.some((p) => p !== 'linkedin')) throw new ApiError(400, 'Only LinkedIn supports document uploads', 'unsupported_platform');
    if (params.poll_options && (params.poll_options.length < 2 || params.poll_options.length > 4 || params.poll_options.some((o: string) => o.length > 25))) throw new ApiError(400, 'poll_options needs 2-4 options of max 25 characters', 'invalid_parameter');
    if (params.threads_topic_tag && (/[.&]/.test(params.threads_topic_tag) || params.threads_topic_tag.length > 50)) throw new ApiError(400, 'threads_topic_tag must be 1-50 chars without . or &', 'invalid_parameter');
    const photoUrls = mediaType === 'photo' ? list(fields.photos ?? fields['photos[]']).filter((u) => /^https?:\/\//.test(u)) : [];
    const result = await createUpload({ user, mediaType, profileUsername, platforms, title: str(fields.title) ?? null, description: str(fields.description) ?? null, params, files, urls: photoUrls, scheduledDate: str(fields.scheduled_date) ?? null, timezone: str(fields.timezone) ?? null, asyncUpload: bool(fields.async_upload), addToQueue: bool(fields.add_to_queue), dashboard: !!ctx.locals.user && !ctx.request.headers.get('authorization'), source: ctx.request.headers.get('x-upload-source') });
    return json(result.body, result.status);
  };
}
