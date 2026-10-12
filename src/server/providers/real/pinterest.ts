import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, readMedia, publicUrl } from './_shared';
import type { OAuthProvider } from '../types';
import { run, now } from '../../db';

const P = 'https://api.pinterest.com/v5';
const basic = () => 'Basic ' + Buffer.from(`${env('PINTEREST_APP_ID')}:${env('PINTEREST_APP_SECRET')}`).toString('base64');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function token(acc: any) { if (acc.expires_at && new Date(acc.expires_at).getTime() - 60000 < Date.now() && acc.refresh_token) { const r = await jsonFetch(`${P}/oauth/token`, { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' }, body: form({ grant_type: 'refresh_token', refresh_token: acc.refresh_token }) }); run('UPDATE social_accounts SET access_token = ?, expires_at = ?, updated_at = ? WHERE id = ?', r.access_token, new Date(Date.now() + r.expires_in * 1000).toISOString(), now(), acc.id); return r.access_token; } return acc.access_token; }
const pinterest: OAuthProvider = {
  kind: 'oauth', key: 'pinterest', configured: () => !!env('PINTEREST_APP_ID'),
  authorizeUrl: (state, redirectUri) => `https://www.pinterest.com/oauth/?${form({ client_id: env('PINTEREST_APP_ID'), redirect_uri: redirectUri, response_type: 'code', scope: 'boards:read,boards:write,pins:read,pins:write,user_accounts:read', state })}`,
  exchangeCode: (code, redirectUri) => jsonFetch(`${P}/oauth/token`, { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' }, body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }) }),
  async fetchAccount(t) { const r = await jsonFetch(`${P}/user_account`, { headers: { authorization: `Bearer ${t.access_token}` } }); return { account_id: r.id || r.username, account_name: r.username, display_name: r.business_name || r.username, avatar_url: r.profile_image || null, meta: { followers: r.follower_count } }; },
  async listPages(acc) { const at = await token(acc); const r = await jsonFetch(`${P}/boards?page_size=100&privacy=ALL`, { headers: { authorization: `Bearer ${at}` } }); return (r.items || []).map((b: any) => ({ id: b.id, name: b.name })); },
  async publish(i) {
    try {
      const at = await token(i.account); const h = { authorization: `Bearer ${at}`, 'content-type': 'application/json' }; const p = i.params;
      const board = p.pinterest_board_id; if (!board) return fail('pinterest_board_id is required', 'missing_board');
      const base: any = { board_id: board, title: (p.pinterest_title || i.title || '').slice(0, 100), description: (p.pinterest_description || i.description || i.title || '').slice(0, 800), link: p.pinterest_link || undefined, alt_text: p.pinterest_alt_text || undefined };
      if (i.mediaType === 'video') {
        const reg = await jsonFetch(`${P}/media`, { method: 'POST', headers: h, body: JSON.stringify({ media_type: 'video' }) });
        const fd = new FormData(); for (const [k, v] of Object.entries(reg.upload_parameters)) fd.append(k, String(v)); fd.append('file', new Blob([await readMedia(i.media[0])]), i.media[0].filename);
        const up = await fetch(reg.upload_url, { method: 'POST', body: fd }); if (!up.ok) return fail(`Pinterest video upload failed (${up.status})`, 'platform_error', true);
        for (let k = 0; k < 40; k++) { const s = await jsonFetch(`${P}/media/${reg.media_id}`, { headers: h }); if (s.status === 'succeeded') break; if (s.status === 'failed') return fail('Pinterest video processing failed', 'platform_error'); await sleep(3000); }
        base.media_source = { source_type: 'video_id', media_id: reg.media_id, cover_image_url: p.pinterest_cover_image_url || undefined, cover_image_key_frame_time: p.pinterest_cover_image_key_frame_time ? Number(p.pinterest_cover_image_key_frame_time) : undefined, cover_image_content_type: p.pinterest_cover_image_content_type || undefined, cover_image_data: p.pinterest_cover_image_data || undefined };
      } else if (i.media.length > 1) base.media_source = { source_type: 'multiple_image_urls', items: i.media.slice(0, 5).map((m) => ({ url: publicUrl(`/uploads/${m.id}`) })) };
      else base.media_source = { source_type: 'image_url', url: publicUrl(`/uploads/${i.media[0].id}`) };
      const pin = await jsonFetch(`${P}/pins`, { method: 'POST', headers: h, body: JSON.stringify(base) });
      return ok({ post_url: `https://www.pinterest.com/pin/${pin.id}/`, platform_post_id: pin.id, message: 'Pin created' });
    } catch (e: any) { return fail(`Pinterest: ${e.message}`, 'platform_error', true); }
  },
  async analytics(acc) { const at = await token(acc); const r = await jsonFetch(`${P}/user_account`, { headers: { authorization: `Bearer ${at}` } }); return { followers: r.follower_count, following: r.following_count, posts: r.pin_count }; },
  async listMedia(acc, limit, cursor) { const at = await token(acc); const r = await jsonFetch(`${P}/pins?page_size=${Math.min(100, limit)}${cursor ? `&bookmark=${cursor}` : ''}`, { headers: { authorization: `Bearer ${at}` } }); return { media: (r.items || []).map((x: any) => ({ id: x.id, caption: x.title || x.description, media_type: x.media?.media_type === 'video' ? 'VIDEO' : 'IMAGE', media_url: x.media?.images?.originals?.url || null, permalink: `https://www.pinterest.com/pin/${x.id}/`, timestamp: x.created_at, thumbnail_url: x.media?.images?.['400x300']?.url || null })), next_cursor: r.bookmark || null }; },
};
registerProvider(pinterest);
