import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, readMedia, chunk, splitThread } from './_shared';
import type { OAuthProvider } from '../types';
import { run, now } from '../../db';

const SCOPES = 'tweet.read tweet.write users.read offline.access media.write';
const basic = () => 'Basic ' + Buffer.from(`${env('X_CLIENT_ID')}:${env('X_CLIENT_SECRET')}`).toString('base64');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function token(acc: any) {
  if (acc.expires_at && new Date(acc.expires_at).getTime() - 60000 < Date.now() && acc.refresh_token) {
    const r = await jsonFetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basic() }, body: form({ grant_type: 'refresh_token', refresh_token: acc.refresh_token, client_id: env('X_CLIENT_ID') }) });
    run('UPDATE social_accounts SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ? WHERE id = ?', r.access_token, r.refresh_token || acc.refresh_token, new Date(Date.now() + r.expires_in * 1000).toISOString(), now(), acc.id);
    return r.access_token as string;
  }
  return acc.access_token as string;
}
async function uploadMedia(at: string, m: any, category: string) {
  const buf = await readMedia(m); const h = { authorization: `Bearer ${at}` };
  const init = await jsonFetch('https://api.x.com/2/media/upload/initialize', { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ total_bytes: buf.length, media_type: m.mime || 'video/mp4', media_category: category }) });
  const id = init.data?.id || init.media_id_string;
  for (const [idx, part] of chunk(buf, 4 * 1024 * 1024).entries()) { const fd = new FormData(); fd.append('media', new Blob([part])); fd.append('segment_index', String(idx)); const r = await fetch(`https://api.x.com/2/media/upload/${id}/append`, { method: 'POST', headers: h, body: fd }); if (!r.ok) throw new Error(`media append failed ${r.status}`); }
  let fin = await jsonFetch(`https://api.x.com/2/media/upload/${id}/finalize`, { method: 'POST', headers: h });
  while (fin.data?.processing_info && ['pending', 'in_progress'].includes(fin.data.processing_info.state)) { await sleep((fin.data.processing_info.check_after_secs || 2) * 1000); fin = await jsonFetch(`https://api.x.com/2/media/upload?command=STATUS&media_id=${id}`, { headers: h }); }
  if (fin.data?.processing_info?.state === 'failed') throw new Error('media processing failed');
  return id as string;
}
const x: OAuthProvider = {
  kind: 'oauth', key: 'x', configured: () => !!env('X_CLIENT_ID'),
  authorizeUrl: (state, redirectUri, extra) => `https://x.com/i/oauth2/authorize?${form({ response_type: 'code', client_id: env('X_CLIENT_ID'), redirect_uri: redirectUri, scope: SCOPES, state, code_challenge: extra?.code_challenge, code_challenge_method: 'S256' })}`,
  exchangeCode: (code, redirectUri, extra) => jsonFetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basic() }, body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: extra?.code_verifier, client_id: env('X_CLIENT_ID') }) }),
  async fetchAccount(t) { const r = await jsonFetch('https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics', { headers: { authorization: `Bearer ${t.access_token}` } }); return { account_id: r.data.id, account_name: r.data.username, display_name: r.data.name, avatar_url: r.data.profile_image_url || null, meta: { followers: r.data.public_metrics?.followers_count } }; },
  async publish(i) {
    try {
      const at = await token(i.account); const p = i.params; const h = { authorization: `Bearer ${at}`, 'content-type': 'application/json' };
      const text = p.x_title || i.title || '';
      if (/https?:\/\//.test(text) && !p.__x_links_allowed) return fail('Posting links on X requires the "Post links on X / Twitter" add-on', 'x_links_addon_required');
      const mediaIds: string[] = [];
      if (i.mediaType === 'video') mediaIds.push(await uploadMedia(at, i.media[0], 'tweet_video'));
      else if (i.mediaType === 'photo') for (const m of i.media.slice(0, 4)) mediaIds.push(await uploadMedia(at, m, m.kind === 'video' ? 'tweet_video' : 'tweet_image'));
      const parts = p.x_long_text_as_post ? [text] : splitThread(text, 280);
      let first: string | null = null, prev: string | null = p.reply_to_id ? String(p.reply_to_id).split('/').pop()! : null;
      for (const [idx, part] of parts.entries()) {
        const body: any = { text: part };
        if (idx === 0 && mediaIds.length) body.media = { media_ids: mediaIds, tagged_user_ids: p.tagged_user_ids || undefined };
        if (prev) body.reply = { in_reply_to_tweet_id: prev, exclude_reply_user_ids: idx === 0 ? p.exclude_reply_user_ids || undefined : undefined };
        if (idx === 0) { if (p.reply_settings) body.reply_settings = p.reply_settings; if (p.quote_tweet_id) body.quote_tweet_id = p.quote_tweet_id; if (p.poll_options) body.poll = { options: Array.isArray(p.poll_options) ? p.poll_options : String(p.poll_options).split(','), duration_minutes: Number(p.poll_duration || 1440), reply_settings: p.poll_reply_settings || undefined }; if (p.geo_place_id) body.geo = { place_id: p.geo_place_id }; if (p.nullcast === 'true') body.nullcast = true; if (p.for_super_followers_only === 'true') body.for_super_followers_only = true; if (p.community_id) { body.community_id = p.community_id; if (p.share_with_followers === 'true') body.share_with_followers = true; } if (p.direct_message_deep_link) body.direct_message_deep_link = p.direct_message_deep_link; if (p.card_uri) body.card_uri = p.card_uri; }
        const r = await jsonFetch('https://api.x.com/2/tweets', { method: 'POST', headers: h, body: JSON.stringify(body) });
        prev = r.data.id; if (!first) first = r.data.id;
      }
      if (i.firstComment && prev) jsonFetch('https://api.x.com/2/tweets', { method: 'POST', headers: h, body: JSON.stringify({ text: i.firstComment, reply: { in_reply_to_tweet_id: prev } }) }).catch(() => {});
      return ok({ post_url: `https://x.com/${i.account.account_name}/status/${first}`, platform_post_id: first!, message: parts.length > 1 ? `Posted as a thread of ${parts.length}` : 'Posted on X' });
    } catch (e: any) { return fail(`X: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) { const at = await token(acc); const r = await jsonFetch('https://api.x.com/2/users/me?user.fields=public_metrics', { headers: { authorization: `Bearer ${at}` } }); const m = r.data.public_metrics || {}; return { followers: m.followers_count, following: m.following_count, posts: m.tweet_count }; },
  async listMedia(acc, limit, cursor) { const at = await token(acc); const r = await jsonFetch(`https://api.x.com/2/users/${acc.account_id}/tweets?max_results=${Math.min(100, Math.max(5, limit))}&tweet.fields=created_at,public_metrics,attachments${cursor ? `&pagination_token=${cursor}` : ''}`, { headers: { authorization: `Bearer ${at}` } }); return { media: (r.data || []).map((t: any) => ({ id: t.id, caption: t.text, media_type: t.attachments ? 'IMAGE' : 'TEXT', media_url: null, permalink: `https://x.com/${acc.account_name}/status/${t.id}`, timestamp: t.created_at, thumbnail_url: null, metrics: t.public_metrics })), next_cursor: r.meta?.next_token || null }; },
  async unpublish(acc, postId) { const at = await token(acc); await jsonFetch(`https://api.x.com/2/tweets/${postId}`, { method: 'DELETE', headers: { authorization: `Bearer ${at}` } }); },
};
registerProvider(x);
