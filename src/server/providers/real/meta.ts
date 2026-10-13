/** Facebook Pages, Instagram (Graph API) and Threads. */
import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, publicUrl, splitThread, truncate } from './_shared';
import type { OAuthProvider, PublishInput } from '../types';
import { parse } from '../../db';

const G = 'https://graph.facebook.com/v21.0';
const FB_SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement,pages_read_user_content,publish_video,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,instagram_manage_messages,business_management';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mediaUrl = (m: any) => publicUrl(`/uploads/${m.id}`);

async function longLived(t: string) { const r = await jsonFetch(`${G}/oauth/access_token?${form({ grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), fb_exchange_token: t })}`); return r.access_token as string; }
async function pages(userToken: string) { const r = await jsonFetch(`${G}/me/accounts?fields=id,name,access_token,picture,instagram_business_account{id,username,profile_picture_url}&limit=100&access_token=${userToken}`); return r.data as any[]; }

/** Wait until an IG container is FINISHED. */
async function waitContainer(id: string, token: string) {
  for (let k = 0; k < 60; k++) { const s = await jsonFetch(`${G}/${id}?fields=status_code,status&access_token=${token}`); if (s.status_code === 'FINISHED') return; if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram container ${s.status_code}: ${s.status || ''}`); await sleep(3000); }
  throw new Error('Instagram container processing timed out');
}

const facebook: OAuthProvider = {
  kind: 'oauth', key: 'facebook', configured: () => !!env('META_APP_ID'),
  authorizeUrl: (state, redirectUri) => `https://www.facebook.com/v21.0/dialog/oauth?${form({ client_id: env('META_APP_ID'), redirect_uri: redirectUri, state, scope: FB_SCOPES, response_type: 'code' })}`,
  async exchangeCode(code, redirectUri) { const r = await jsonFetch(`${G}/oauth/access_token?${form({ client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: redirectUri, code })}`); return { access_token: await longLived(r.access_token), expires_in: 60 * 86400, raw: r }; },
  async fetchAccount(t) {
    const ps = await pages(t.access_token); if (!ps.length) throw new Error('No Facebook Page found. Create a Page or grant page permissions.');
    const p = ps[0];
    return { account_id: p.id, account_name: p.name, display_name: p.name, avatar_url: p.picture?.data?.url || null, meta: { pages: ps.map((x) => ({ id: x.id, name: x.name, access_token: x.access_token, picture: x.picture?.data?.url, instagram: x.instagram_business_account || null })) } };
  },
  async listPages(acc) { return parse(acc.meta_json, {} as any).pages?.map((p: any) => ({ id: p.id, name: p.name, picture: p.picture, account_id: acc.account_id })) || []; },
  async publish(i) {
    const meta = parse(i.account.meta_json, {} as any); const ps: any[] = meta.pages || [];
    const page = ps.find((p) => p.id === i.params.facebook_page_id) || (ps.length === 1 ? ps[0] : ps.find((p) => p.id === meta.pinned_page_id)) || ps[0];
    if (!page) return fail('No Facebook Page available. Pass facebook_page_id.', 'missing_page');
    const pt = page.access_token; const text = i.params.facebook_description || i.description || i.title;
    try {
      if (i.mediaType === 'video') {
        const type = (i.params.facebook_media_type || 'REELS').toUpperCase(); const m = i.media[0];
        if (type === 'STORIES') { const s = await jsonFetch(`${G}/${page.id}/video_stories?${form({ upload_phase: 'start', access_token: pt })}`, { method: 'POST' }); await fetch(s.upload_url, { method: 'POST', headers: { authorization: `OAuth ${pt}`, file_url: mediaUrl(m) } }); const f = await jsonFetch(`${G}/${page.id}/video_stories?${form({ upload_phase: 'finish', video_id: s.video_id, access_token: pt })}`, { method: 'POST' }); return ok({ post_url: `https://www.facebook.com/${page.id}/stories`, platform_post_id: f.post_id || s.video_id, message: 'Facebook Story published' }); }
        if (type === 'REELS') { const s = await jsonFetch(`${G}/${page.id}/video_reels?${form({ upload_phase: 'start', access_token: pt })}`, { method: 'POST' }); const up = await fetch(s.upload_url, { method: 'POST', headers: { authorization: `OAuth ${pt}`, file_url: mediaUrl(m) } }); if (!up.ok) return fail(`Reel upload failed: ${await up.text()}`, 'platform_error', true); await jsonFetch(`${G}/${page.id}/video_reels?${form({ upload_phase: 'finish', video_id: s.video_id, video_state: i.params.video_state || 'PUBLISHED', description: text, title: i.title, access_token: pt })}`, { method: 'POST' }); if (i.firstComment) jsonFetch(`${G}/${s.video_id}/comments?${form({ message: i.firstComment, access_token: pt })}`, { method: 'POST' }).catch(() => {}); return ok({ post_url: `https://www.facebook.com/reel/${s.video_id}`, platform_post_id: s.video_id, message: 'Facebook Reel published' }); }
        const v = await jsonFetch(`${G}/${page.id}/videos?${form({ file_url: mediaUrl(m), description: text, title: i.title, published: i.params.video_state !== 'DRAFT', access_token: pt })}`, { method: 'POST' });
        return ok({ post_url: `https://www.facebook.com/${page.id}/videos/${v.id}`, platform_post_id: v.id, message: 'Facebook video published' });
      }
      if (i.mediaType === 'photo') {
        if ((i.params.facebook_media_type || '').toUpperCase() === 'STORIES') { const ph = await jsonFetch(`${G}/${page.id}/photos?${form({ url: mediaUrl(i.media[0]), published: false, access_token: pt })}`, { method: 'POST' }); const s = await jsonFetch(`${G}/${page.id}/photo_stories?${form({ photo_id: ph.id, access_token: pt })}`, { method: 'POST' }); return ok({ post_url: `https://www.facebook.com/${page.id}/stories`, platform_post_id: s.post_id, message: 'Facebook photo Story published' }); }
        const ids: string[] = []; for (const m of i.media) { const ph = await jsonFetch(`${G}/${page.id}/photos?${form({ url: mediaUrl(m), published: false, access_token: pt })}`, { method: 'POST' }); ids.push(ph.id); }
        const body: any = { message: text, access_token: pt }; ids.forEach((id, k) => (body[`attached_media[${k}]`] = JSON.stringify({ media_fbid: id })));
        const post = await jsonFetch(`${G}/${page.id}/feed?${form(body)}`, { method: 'POST' });
        if (i.firstComment) jsonFetch(`${G}/${post.id}/comments?${form({ message: i.firstComment, access_token: pt })}`, { method: 'POST' }).catch(() => {});
        return ok({ post_url: `https://www.facebook.com/${post.id}`, platform_post_id: post.id, message: 'Facebook photo post published' });
      }
      const post = await jsonFetch(`${G}/${page.id}/feed?${form({ message: i.params.facebook_title || i.title, link: i.params.facebook_link_url || i.params.link_url || undefined, access_token: pt })}`, { method: 'POST' });
      if (i.firstComment) jsonFetch(`${G}/${post.id}/comments?${form({ message: i.firstComment, access_token: pt })}`, { method: 'POST' }).catch(() => {});
      return ok({ post_url: `https://www.facebook.com/${post.id}`, platform_post_id: post.id, message: 'Facebook post published' });
    } catch (e: any) { return fail(`Facebook: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) { const meta = parse(acc.meta_json, {} as any); const p = meta.pages?.[0]; if (!p) return {}; const r = await jsonFetch(`${G}/${p.id}?fields=fan_count,followers_count&access_token=${p.access_token}`); return { followers: r.followers_count || r.fan_count || 0 }; },
  async unpublish(acc, postId) { const meta = parse(acc.meta_json, {} as any); const p = meta.pages?.[0]; await jsonFetch(`${G}/${postId}?access_token=${p.access_token}`, { method: 'DELETE' }); },
};

const instagram: OAuthProvider = {
  kind: 'oauth', key: 'instagram', configured: () => !!env('META_APP_ID'),
  // Instagram-only scopes: the Page publishing ones are not offered in Meta's Instagram use case and trigger "Invalid Scopes"
  authorizeUrl: (state, redirectUri) => `https://www.facebook.com/v21.0/dialog/oauth?${form({ client_id: env('META_APP_ID'), redirect_uri: redirectUri, state, scope: 'pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,instagram_manage_messages', response_type: 'code' })}`,
  exchangeCode: facebook.exchangeCode,
  async fetchAccount(t) {
    const ps = await pages(t.access_token); const p = ps.find((x) => x.instagram_business_account);
    if (!p) throw new Error('No Instagram professional account linked to your Facebook Pages.');
    const ig = p.instagram_business_account;
    return { account_id: ig.id, account_name: ig.username, display_name: ig.username, avatar_url: ig.profile_picture_url || null, meta: { page_id: p.id, page_token: p.access_token } };
  },
  async publish(i) {
    const meta = parse(i.account.meta_json, {} as any); const tok = meta.page_token || i.account.access_token; const ig = i.account.account_id; const caption = i.params.instagram_title || i.title || '';
    try {
      let creation: string;
      const common: any = { caption, access_token: tok, collaborators: i.params.collaborators ? JSON.stringify(String(i.params.collaborators).split(',').map((s) => s.trim())) : undefined, location_id: i.params.location_id || undefined, user_tags: i.params.user_tags ? JSON.stringify(String(i.params.user_tags).split(',').map((u) => ({ username: u.trim() }))) : undefined };
      if (i.mediaType === 'video') {
        const type = (i.params.media_type || 'REELS').toUpperCase();
        const c = await jsonFetch(`${G}/${ig}/media?${form({ ...common, media_type: type, video_url: mediaUrl(i.media[0]), share_to_feed: type === 'REELS' ? i.params.share_to_feed !== 'false' : undefined, cover_url: i.params.cover_url || (typeof i.params.cover_image === 'string' ? publicUrl(i.params.cover_image) : undefined), thumb_offset: i.params.thumb_offset || undefined, audio_name: i.params.audio_name || undefined })}`, { method: 'POST' });
        creation = c.id;
      } else if (i.media.length === 1) {
        const m = i.media[0]; const type = (i.params.media_type || 'IMAGE').toUpperCase();
        const c = await jsonFetch(`${G}/${ig}/media?${form({ ...common, media_type: type === 'STORIES' ? 'STORIES' : undefined, image_url: m.kind === 'photo' ? mediaUrl(m) : undefined, video_url: m.kind === 'video' ? mediaUrl(m) : undefined })}`, { method: 'POST' });
        creation = c.id;
      } else {
        const children: string[] = [];
        for (const m of i.media.slice(0, 10)) { const c = await jsonFetch(`${G}/${ig}/media?${form({ is_carousel_item: true, image_url: m.kind === 'photo' ? mediaUrl(m) : undefined, video_url: m.kind === 'video' ? mediaUrl(m) : undefined, media_type: m.kind === 'video' ? 'VIDEO' : undefined, access_token: tok })}`, { method: 'POST' }); if (m.kind === 'video') await waitContainer(c.id, tok); children.push(c.id); }
        const c = await jsonFetch(`${G}/${ig}/media?${form({ ...common, media_type: 'CAROUSEL', children: children.join(',') })}`, { method: 'POST' }); creation = c.id;
      }
      await waitContainer(creation, tok); // photos and carousels also need FINISHED, else media_publish says "Media ID is not available"
      const pub = await jsonFetch(`${G}/${ig}/media_publish?${form({ creation_id: creation, access_token: tok })}`, { method: 'POST' });
      const info = await jsonFetch(`${G}/${pub.id}?fields=permalink&access_token=${tok}`).catch(() => ({}));
      if (i.firstComment) jsonFetch(`${G}/${pub.id}/comments?${form({ message: i.firstComment, access_token: tok })}`, { method: 'POST' }).catch(() => {});
      return ok({ post_url: info.permalink || `https://www.instagram.com/${i.account.account_name}/`, platform_post_id: pub.id, message: 'Published on Instagram' });
    } catch (e: any) { return fail(`Instagram: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) { const meta = parse(acc.meta_json, {} as any); const r = await jsonFetch(`${G}/${acc.account_id}?fields=followers_count,follows_count,media_count&access_token=${meta.page_token || acc.access_token}`); return { followers: r.followers_count, following: r.follows_count, posts: r.media_count }; },
  async listMedia(acc, limit, cursor) { const meta = parse(acc.meta_json, {} as any); const r = await jsonFetch(`${G}/${acc.account_id}/media?fields=id,caption,media_type,media_url,permalink,timestamp,thumbnail_url&limit=${Math.min(100, limit)}${cursor ? `&after=${cursor}` : ''}&access_token=${meta.page_token || acc.access_token}`); return { media: r.data || [], next_cursor: r.paging?.cursors?.after && r.paging?.next ? r.paging.cursors.after : null }; },
};

const threads: OAuthProvider = {
  kind: 'oauth', key: 'threads', configured: () => !!env('THREADS_APP_ID'),
  authorizeUrl: (state, redirectUri) => `https://threads.net/oauth/authorize?${form({ client_id: env('THREADS_APP_ID'), redirect_uri: redirectUri, scope: 'threads_basic,threads_content_publish,threads_manage_replies,threads_manage_insights', response_type: 'code', state })}`,
  async exchangeCode(code, redirectUri) { const r = await jsonFetch('https://graph.threads.net/oauth/access_token', { method: 'POST', body: form({ client_id: env('THREADS_APP_ID'), client_secret: env('THREADS_APP_SECRET'), grant_type: 'authorization_code', redirect_uri: redirectUri, code }) }); const ll = await jsonFetch(`https://graph.threads.net/access_token?${form({ grant_type: 'th_exchange_token', client_secret: env('THREADS_APP_SECRET'), access_token: r.access_token })}`); return { access_token: ll.access_token, expires_in: ll.expires_in, raw: r }; },
  async fetchAccount(t) { const r = await jsonFetch(`https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${t.access_token}`); return { account_id: r.id, account_name: r.username, display_name: r.name || r.username, avatar_url: r.threads_profile_picture_url || null }; },
  async publish(i) {
    const tok = i.account.access_token!; const T = 'https://graph.threads.net/v1.0'; const text = i.params.threads_title || i.title || '';
    try {
      const create = async (body: any) => { const c = await jsonFetch(`${T}/me/threads?${form({ ...body, access_token: tok })}`, { method: 'POST' }); for (let k = 0; k < 40; k++) { const s = await jsonFetch(`${T}/${c.id}?fields=status,error_message&access_token=${tok}`); if (s.status === 'FINISHED') break; if (s.status === 'ERROR') throw new Error(s.error_message || 'container error'); await sleep(2500); } return c.id; };
      const publish = async (creation_id: string, reply_to_id?: string) => jsonFetch(`${T}/me/threads_publish?${form({ creation_id, access_token: tok })}`, { method: 'POST' });
      const parts = i.params.threads_long_text_as_post ? [text] : splitThread(text, 500);
      let first: string | null = null, prev: string | null = null;
      for (const [idx, part] of parts.entries()) {
        let cid: string;
        const base: any = { text: part, topic_tag: idx === 0 ? i.params.threads_topic_tag || undefined : undefined, reply_to_id: prev || undefined };
        if (idx === 0 && i.mediaType === 'video') cid = await create({ ...base, media_type: 'VIDEO', video_url: mediaUrl(i.media[0]) });
        else if (idx === 0 && i.mediaType === 'photo' && i.media.length === 1) cid = await create({ ...base, media_type: i.media[0].kind === 'video' ? 'VIDEO' : 'IMAGE', image_url: i.media[0].kind === 'photo' ? mediaUrl(i.media[0]) : undefined, video_url: i.media[0].kind === 'video' ? mediaUrl(i.media[0]) : undefined });
        else if (idx === 0 && i.mediaType === 'photo') { const kids: string[] = []; for (const m of i.media.slice(0, 20)) kids.push(await create({ is_carousel_item: true, media_type: m.kind === 'video' ? 'VIDEO' : 'IMAGE', image_url: m.kind === 'photo' ? mediaUrl(m) : undefined, video_url: m.kind === 'video' ? mediaUrl(m) : undefined })); cid = await create({ ...base, media_type: 'CAROUSEL', children: kids.join(',') }); }
        else cid = await create({ ...base, media_type: 'TEXT' });
        const pub = await publish(cid); prev = pub.id; if (!first) first = pub.id;
      }
      if (i.firstComment && prev) { const c = await create({ text: i.firstComment, media_type: 'TEXT', reply_to_id: prev }); await publish(c); }
      const info = await jsonFetch(`${T}/${first}?fields=permalink&access_token=${tok}`).catch(() => ({}));
      return ok({ post_url: info.permalink || `https://www.threads.net/@${i.account.account_name}`, platform_post_id: first!, message: parts.length > 1 ? `Published as a thread of ${parts.length}` : 'Published on Threads' });
    } catch (e: any) { return fail(`Threads: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) { const r = await jsonFetch(`https://graph.threads.net/v1.0/me/threads_insights?metric=views,likes,replies,reposts,followers_count&access_token=${acc.access_token}`).catch(() => ({ data: [] })); const out: any = {}; for (const d of r.data || []) out[d.name === 'followers_count' ? 'followers' : d.name] = d.total_value?.value ?? d.values?.[0]?.value; return out; },
  async unpublish(acc, postId) { await jsonFetch(`https://graph.threads.net/v1.0/${postId}?access_token=${acc.access_token}`, { method: 'DELETE' }); },
};
registerProvider(facebook); registerProvider(instagram); registerProvider(threads);
