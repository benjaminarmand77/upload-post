import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, readMedia, publicUrl } from './_shared';
import type { OAuthProvider } from '../types';
import { run, now } from '../../db';

const UA = 'web:upload-post-clone:1.0 (by /u/upload_post)';
const basic = () => 'Basic ' + Buffer.from(`${env('REDDIT_CLIENT_ID')}:${env('REDDIT_CLIENT_SECRET')}`).toString('base64');
async function token(acc: any) { if (acc.expires_at && new Date(acc.expires_at).getTime() - 60000 < Date.now() && acc.refresh_token) { const r = await jsonFetch('https://www.reddit.com/api/v1/access_token', { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA }, body: form({ grant_type: 'refresh_token', refresh_token: acc.refresh_token }) }); run('UPDATE social_accounts SET access_token = ?, expires_at = ?, updated_at = ? WHERE id = ?', r.access_token, new Date(Date.now() + r.expires_in * 1000).toISOString(), now(), acc.id); return r.access_token; } return acc.access_token; }
const reddit: OAuthProvider = {
  kind: 'oauth', key: 'reddit', configured: () => !!env('REDDIT_CLIENT_ID'),
  authorizeUrl: (state, redirectUri) => `https://www.reddit.com/api/v1/authorize?${form({ client_id: env('REDDIT_CLIENT_ID'), response_type: 'code', state, redirect_uri: redirectUri, duration: 'permanent', scope: 'identity submit read flair history' })}`,
  exchangeCode: (code, redirectUri) => jsonFetch('https://www.reddit.com/api/v1/access_token', { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA }, body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }) }),
  async fetchAccount(t) { const r = await jsonFetch('https://oauth.reddit.com/api/v1/me', { headers: { authorization: `Bearer ${t.access_token}`, 'user-agent': UA } }); return { account_id: r.id, account_name: r.name, display_name: `u/${r.name}`, avatar_url: r.icon_img?.split('?')[0] || null, meta: { karma: r.total_karma } }; },
  async publish(i) {
    try {
      const at = await token(i.account); const h = { authorization: `Bearer ${at}`, 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' }; const p = i.params;
      const sr = String(p.subreddit || '').replace(/^r\//, ''); if (!sr) return fail('subreddit is required', 'missing_subreddit');
      const title = (p.reddit_title || i.title || '').slice(0, 300);
      const body: any = { sr, title, api_type: 'json', flair_id: p.flair_id || undefined, nsfw: p.nsfw === 'true', spoiler: p.spoiler === 'true', sendreplies: true };
      if (i.mediaType === 'text') { if (p.reddit_link_url || p.link_url) { body.kind = 'link'; body.url = p.reddit_link_url || p.link_url; } else { body.kind = 'self'; body.text = i.description || ''; } }
      else if (i.mediaType === 'photo' && i.media.length === 1) { body.kind = 'link'; body.url = publicUrl(`/uploads/${i.media[0].id}`); }
      else if (i.mediaType === 'photo') { body.kind = 'self'; body.text = `${i.description || ''}\n\n${i.media.map((m, k) => `[Image ${k + 1}](${publicUrl(`/uploads/${m.id}`)})`).join('\n\n')}`; }
      else { body.kind = 'link'; body.url = publicUrl(`/uploads/${i.media[0].id}`); }
      const r = await jsonFetch('https://oauth.reddit.com/api/submit', { method: 'POST', headers: h, body: form(body) });
      const errs = r.json?.errors || []; if (errs.length) return fail(`Reddit: ${errs.map((e: any) => e.join(' ')).join('; ')}`, 'platform_error');
      const d = r.json?.data || {};
      if (i.firstComment && d.name) jsonFetch('https://oauth.reddit.com/api/comment', { method: 'POST', headers: h, body: form({ thing_id: d.name, text: i.firstComment, api_type: 'json' }) }).catch(() => {});
      return ok({ post_url: d.url || `https://www.reddit.com/r/${sr}/`, platform_post_id: d.id || d.name, message: 'Submitted to Reddit' });
    } catch (e: any) { return fail(`Reddit: ${e.message}`, 'platform_error', true); }
  },
  async listMedia(acc, limit, cursor) { const at = await token(acc); const r = await jsonFetch(`https://oauth.reddit.com/user/${acc.account_name}/submitted?limit=${Math.min(100, limit)}${cursor ? `&after=${cursor}` : ''}`, { headers: { authorization: `Bearer ${at}`, 'user-agent': UA } }); return { media: (r.data?.children || []).map((c: any) => ({ id: c.data.id, caption: c.data.title, media_type: c.data.is_video ? 'VIDEO' : c.data.post_hint === 'image' ? 'IMAGE' : 'TEXT', media_url: c.data.url, permalink: `https://www.reddit.com${c.data.permalink}`, timestamp: new Date(c.data.created_utc * 1000).toISOString(), thumbnail_url: c.data.thumbnail?.startsWith('http') ? c.data.thumbnail : null, metrics: { likes: c.data.ups, comments: c.data.num_comments } })), next_cursor: r.data?.after || null }; },
};
registerProvider(reddit);
