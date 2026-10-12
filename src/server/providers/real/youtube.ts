import { registerProvider } from '../registry';
import { env, fail, ok, readMedia, jsonFetch, form, hashtagsFrom } from './_shared';
import type { OAuthProvider } from '../types';
import { run, now } from '../../db';

const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl';
async function token(acc: any) {
  if (acc.expires_at && new Date(acc.expires_at).getTime() - 60000 < Date.now() && acc.refresh_token) {
    const r = await jsonFetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ client_id: env('YOUTUBE_CLIENT_ID') || env('GOOGLE_CLIENT_ID'), client_secret: env('YOUTUBE_CLIENT_SECRET') || env('GOOGLE_CLIENT_SECRET'), refresh_token: acc.refresh_token, grant_type: 'refresh_token' }) });
    run('UPDATE social_accounts SET access_token = ?, expires_at = ?, updated_at = ? WHERE id = ?', r.access_token, new Date(Date.now() + r.expires_in * 1000).toISOString(), now(), acc.id);
    return r.access_token as string;
  }
  return acc.access_token as string;
}
const youtube: OAuthProvider = {
  kind: 'oauth', key: 'youtube',
  configured: () => !!(env('YOUTUBE_CLIENT_ID') || env('GOOGLE_CLIENT_ID')),
  authorizeUrl: (state, redirectUri) => `https://accounts.google.com/o/oauth2/v2/auth?${form({ client_id: env('YOUTUBE_CLIENT_ID') || env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent', state })}`,
  exchangeCode: (code, redirectUri) => jsonFetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ code, client_id: env('YOUTUBE_CLIENT_ID') || env('GOOGLE_CLIENT_ID'), client_secret: env('YOUTUBE_CLIENT_SECRET') || env('GOOGLE_CLIENT_SECRET'), redirect_uri: redirectUri, grant_type: 'authorization_code' }) }),
  async fetchAccount(t) {
    const r = await jsonFetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { authorization: `Bearer ${t.access_token}` } });
    const ch = r.items?.[0]; if (!ch) throw new Error('No YouTube channel found for this Google account');
    return { account_id: ch.id, account_name: ch.snippet.customUrl?.replace('@', '') || ch.snippet.title, display_name: ch.snippet.title, avatar_url: ch.snippet.thumbnails?.default?.url || null, meta: { subscribers: ch.statistics?.subscriberCount } };
  },
  async publish(i) {
    if (i.mediaType !== 'video') return fail('YouTube only accepts videos', 'unsupported_media');
    try {
      const at = await token(i.account); const p = i.params; const m = i.media[0]; const buf = await readMedia(m);
      const snippet: any = { title: i.title.slice(0, 100), description: p.youtube_description || i.description || i.title, tags: Array.isArray(p.tags) ? p.tags : p.tags ? String(p.tags).split(',') : hashtagsFrom(i.title), categoryId: String(p.categoryId || '22'), defaultLanguage: p.defaultLanguage || undefined, defaultAudioLanguage: p.defaultAudioLanguage || undefined };
      const status: any = { privacyStatus: p.privacyStatus || 'public', embeddable: p.embeddable !== 'false' && p.embeddable !== false, license: p.license || 'youtube', publicStatsViewable: p.publicStatsViewable !== 'false', selfDeclaredMadeForKids: p.selfDeclaredMadeForKids === 'true' || p.selfDeclaredMadeForKids === true, containsSyntheticMedia: p.containsSyntheticMedia === 'true' || p.is_ai_generated === 'true' || undefined };
      const body: any = { snippet, status };
      if (p.recordingDate) body.recordingDetails = { recordingDate: p.recordingDate };
      if (p.allowedCountries || p.blockedCountries) body.contentDetails = { regionRestriction: p.allowedCountries ? { allowed: String(p.allowedCountries).split(',') } : { blocked: String(p.blockedCountries).split(',') } };
      const init = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,contentDetails,recordingDetails`, { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json', 'x-upload-content-length': String(buf.length), 'x-upload-content-type': m.mime || 'video/*' }, body: JSON.stringify(body) });
      if (!init.ok) return fail(`YouTube init failed: ${(await init.text()).slice(0, 300)}`, 'platform_error');
      const loc = init.headers.get('location')!;
      const up = await fetch(loc, { method: 'PUT', headers: { 'content-type': m.mime || 'video/*', 'content-length': String(buf.length) }, body: buf });
      const vid = await up.json(); if (!up.ok) return fail(`YouTube upload failed: ${JSON.stringify(vid).slice(0, 300)}`, 'platform_error', true);
      if (p.thumbnail && typeof p.thumbnail === 'string' && p.thumbnail.startsWith('/uploads/')) { /* thumbnail set through dashboard media is handled by thumbnail_url */ }
      if (p.thumbnail_url) { try { const tb = await fetch(p.thumbnail_url); await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${vid.id}`, { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': tb.headers.get('content-type') || 'image/jpeg' }, body: await tb.arrayBuffer() }); } catch {} }
      if (i.firstComment) { try { await jsonFetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: JSON.stringify({ snippet: { videoId: vid.id, topLevelComment: { snippet: { textOriginal: i.firstComment } } } }) }); } catch {} }
      return ok({ post_url: `https://www.youtube.com/watch?v=${vid.id}`, platform_post_id: vid.id, message: `Uploaded to YouTube (${status.privacyStatus})` });
    } catch (e: any) { return fail(`YouTube: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) {
    const at = await token(acc);
    const r = await jsonFetch('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true', { headers: { authorization: `Bearer ${at}` } });
    const s = r.items?.[0]?.statistics || {};
    return { followers: Number(s.subscriberCount || 0), views: Number(s.viewCount || 0), posts: Number(s.videoCount || 0) };
  },
  async listMedia(acc, limit, cursor) {
    const at = await token(acc);
    const r = await jsonFetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&order=date&maxResults=${Math.min(50, limit)}${cursor ? `&pageToken=${cursor}` : ''}`, { headers: { authorization: `Bearer ${at}` } });
    return { media: (r.items || []).map((it: any) => ({ id: it.id.videoId, caption: it.snippet.title, media_type: 'VIDEO', media_url: null, permalink: `https://www.youtube.com/watch?v=${it.id.videoId}`, timestamp: it.snippet.publishedAt, thumbnail_url: it.snippet.thumbnails?.high?.url })), next_cursor: r.nextPageToken || null };
  },
  async unpublish(acc, postId) { const at = await token(acc); const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${postId}`, { method: 'DELETE', headers: { authorization: `Bearer ${at}` } }); if (!r.ok) throw new Error(await r.text()); },
};
registerProvider(youtube);
