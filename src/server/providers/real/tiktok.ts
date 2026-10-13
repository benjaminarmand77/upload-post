import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, readMedia, chunk, publicUrl } from './_shared';
import type { OAuthProvider } from '../types';
import { run, now } from '../../db';

const SCOPES = 'user.info.basic,user.info.profile,user.info.stats,video.publish,video.upload,video.list';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function token(acc: any) {
  if (acc.expires_at && new Date(acc.expires_at).getTime() - 60000 < Date.now() && acc.refresh_token) {
    const r = await jsonFetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), grant_type: 'refresh_token', refresh_token: acc.refresh_token }) });
    run('UPDATE social_accounts SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ? WHERE id = ?', r.access_token, r.refresh_token || acc.refresh_token, new Date(Date.now() + r.expires_in * 1000).toISOString(), now(), acc.id);
    return r.access_token as string;
  }
  return acc.access_token as string;
}
const tiktok: OAuthProvider = {
  kind: 'oauth', key: 'tiktok', configured: () => !!env('TIKTOK_CLIENT_KEY'),
  authorizeUrl: (state, redirectUri, extra) => `https://www.tiktok.com/v2/auth/authorize/?${form({ client_key: env('TIKTOK_CLIENT_KEY'), scope: SCOPES, response_type: 'code', redirect_uri: redirectUri, state, code_challenge: extra?.code_challenge, code_challenge_method: extra?.code_challenge ? 'S256' : undefined })}`,
  exchangeCode: (code, redirectUri, extra) => jsonFetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: extra?.code_verifier }) }),
  async fetchAccount(t) {
    const r = await jsonFetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count,video_count', { headers: { authorization: `Bearer ${t.access_token}` } });
    const u = r.data?.user; if (!u) throw new Error(r.error?.message || 'Could not read TikTok user');
    return { account_id: u.open_id, account_name: u.username || u.display_name, display_name: u.display_name, avatar_url: u.avatar_url || null, meta: { follower_count: u.follower_count } };
  },
  async publish(i) {
    try {
      const at = await token(i.account); const h = { authorization: `Bearer ${at}`, 'content-type': 'application/json; charset=UTF-8' }; const p = i.params;
      // drafts by default: unaudited TikTok apps can only direct-post privately
      const draft = (p.post_mode || 'MEDIA_UPLOAD') === 'MEDIA_UPLOAD' || p.tiktok_upload_to_draft === 'true';
      const postInfo: any = { title: (p.tiktok_title || i.title || '').slice(0, 2200), privacy_level: p.privacy_level || 'PUBLIC_TO_EVERYONE', disable_duet: p.disable_duet === 'true', disable_comment: p.disable_comment === 'true', disable_stitch: p.disable_stitch === 'true', brand_content_toggle: p.brand_content_toggle === 'true', brand_organic_toggle: p.brand_organic_toggle === 'true', is_aigc: p.is_aigc === 'true' || p.is_ai_generated === 'true' };
      if (i.mediaType === 'photo') {
        const body = { post_info: { ...postInfo, description: p.tiktok_description || i.description || undefined, auto_add_music: p.auto_add_music === 'true' }, source_info: { source: 'PULL_FROM_URL', photo_cover_index: Number(p.photo_cover_index || 0), photo_images: i.media.slice(0, 35).map((m) => publicUrl(`/uploads/${m.id}`)) }, post_mode: draft ? 'MEDIA_UPLOAD' : 'DIRECT_POST', media_type: 'PHOTO' };
        const r = await jsonFetch('https://open.tiktokapis.com/v2/post/publish/content/init/', { method: 'POST', headers: h, body: JSON.stringify(body) });
        if (r.error?.code && r.error.code !== 'ok') return fail(`TikTok: ${r.error.message}`, r.error.code);
        return await poll(r.data.publish_id, at, i.account.account_name!, draft);
      }
      const m = i.media[0]; const buf = await readMedia(m); // TikTok: count = floor(size / chunk), last chunk absorbs the remainder; files <= 64 MB go in one chunk
      const CH = buf.length <= 64 * 1024 * 1024 ? buf.length : 10 * 1024 * 1024; const n = Math.floor(buf.length / CH); const parts = chunk(buf.subarray(0, (n - 1) * CH), CH).concat([buf.subarray((n - 1) * CH)]);
      const init = await jsonFetch(draft ? 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/' : 'https://open.tiktokapis.com/v2/post/publish/video/init/', { method: 'POST', headers: h, body: JSON.stringify({ ...(draft ? {} : { post_info: { ...postInfo, video_cover_timestamp_ms: Number(p.cover_timestamp || 1000) } }), source_info: { source: 'FILE_UPLOAD', video_size: buf.length, chunk_size: CH, total_chunk_count: parts.length } }) });
      if (init.error?.code && init.error.code !== 'ok') return fail(`TikTok: ${init.error.message}`, init.error.code);
      let offset = 0;
      for (const part of parts) { const r = await fetch(init.data.upload_url, { method: 'PUT', headers: { 'content-type': m.mime || 'video/mp4', 'content-length': String(part.length), 'content-range': `bytes ${offset}-${offset + part.length - 1}/${buf.length}` }, body: part }); if (!r.ok && r.status !== 206) return fail(`TikTok upload chunk failed (${r.status})`, 'platform_error', true); offset += part.length; }
      return await poll(init.data.publish_id, at, i.account.account_name!, draft);
    } catch (e: any) { return fail(`TikTok: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) { const at = await token(acc); const r = await jsonFetch('https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count', { headers: { authorization: `Bearer ${at}` } }); const u = r.data?.user || {}; return { followers: u.follower_count, following: u.following_count, likes: u.likes_count, posts: u.video_count }; },
  async listMedia(acc, limit, cursor) { const at = await token(acc); const r = await jsonFetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count', { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: JSON.stringify({ max_count: Math.min(20, limit), cursor: cursor ? Number(cursor) : undefined }) }); return { media: (r.data?.videos || []).map((v: any) => ({ id: v.id, caption: v.title, media_type: 'VIDEO', media_url: null, permalink: v.share_url, timestamp: new Date(v.create_time * 1000).toISOString(), thumbnail_url: v.cover_image_url, metrics: { views: v.view_count, likes: v.like_count, comments: v.comment_count, shares: v.share_count } })), next_cursor: r.data?.has_more ? String(r.data.cursor) : null }; },
};
async function poll(publishId: string, at: string, handle: string, draft: boolean) {
  for (let k = 0; k < 40; k++) {
    const s = await jsonFetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: JSON.stringify({ publish_id: publishId }) });
    const st = s.data?.status;
    if (st === 'PUBLISH_COMPLETE') { const vid = s.data.publicaly_available_post_id?.[0]; return ok({ post_url: vid ? `https://www.tiktok.com/@${handle}/video/${vid}` : `https://www.tiktok.com/@${handle}`, platform_post_id: String(vid || publishId), message: draft ? 'Sent to TikTok inbox/drafts' : 'Published on TikTok', meta: { publish_id: publishId } }); }
    if (st === 'FAILED') return fail(`TikTok publish failed: ${s.data.fail_reason}`, s.data.fail_reason === 'privacy_level_option_mismatch' ? 'tiktok_privacy_unavailable' : 'platform_error');
    if (st === 'SEND_TO_USER_INBOX') return ok({ post_url: `https://www.tiktok.com/@${handle}`, platform_post_id: publishId, message: 'Sent to TikTok inbox (drafts)', meta: { publish_id: publishId } });
    await sleep(4000);
  }
  return ok({ post_url: `https://www.tiktok.com/@${handle}`, platform_post_id: publishId, message: 'TikTok is still processing the video', meta: { publish_id: publishId } });
}
registerProvider(tiktok);
