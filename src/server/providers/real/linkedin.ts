import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, readMedia } from './_shared';
import type { OAuthProvider } from '../types';
import { parse } from '../../db';

const SCOPES = 'openid profile email w_member_social r_organization_social w_organization_social rw_organization_admin';
const H = (t: string) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json', 'x-restli-protocol-version': '2.0.0', 'linkedin-version': '202411' });
const esc = (s: string) => s.replace(/[\\*_{}\[\]()#+\-.!<>~@|]/g, (c) => '\\' + c);
const linkedin: OAuthProvider = {
  kind: 'oauth', key: 'linkedin', configured: () => !!env('LINKEDIN_CLIENT_ID'),
  authorizeUrl: (state, redirectUri) => `https://www.linkedin.com/oauth/v2/authorization?${form({ response_type: 'code', client_id: env('LINKEDIN_CLIENT_ID'), redirect_uri: redirectUri, state, scope: SCOPES })}`,
  exchangeCode: (code, redirectUri) => jsonFetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: env('LINKEDIN_CLIENT_ID'), client_secret: env('LINKEDIN_CLIENT_SECRET') }) }),
  async fetchAccount(t) {
    const me = await jsonFetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${t.access_token}` } });
    let orgs: any[] = [];
    try { const r = await jsonFetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName,vanityName)))', { headers: H(t.access_token) }); orgs = (r.elements || []).map((e: any) => ({ id: e['organization~']?.id ? `urn:li:organization:${e['organization~'].id}` : e.organization, name: e['organization~']?.localizedName, vanityName: e['organization~']?.vanityName })); } catch {}
    return { account_id: `urn:li:person:${me.sub}`, account_name: (me.name || me.email || 'linkedin').replace(/\s+/g, '').toLowerCase(), display_name: me.name, avatar_url: me.picture || null, meta: { pages: orgs } };
  },
  async listPages(acc) { return parse(acc.meta_json, {} as any).pages?.map((p: any) => ({ id: p.id, name: p.name, vanityName: p.vanityName, account_id: acc.account_id })) || []; },
  async publish(i) {
    const t = i.account.access_token!; const author = i.params.target_linkedin_page_id ? (String(i.params.target_linkedin_page_id).startsWith('urn:') ? i.params.target_linkedin_page_id : `urn:li:organization:${i.params.target_linkedin_page_id}`) : i.account.account_id;
    const commentary = esc(i.params.linkedin_description || i.params.linkedin_title || i.description || i.title || '');
    try {
      const post: any = { author, commentary, visibility: i.params.visibility || 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false };
      const initUpload = async (kind: 'images' | 'videos' | 'documents', m: any) => {
        const buf = await readMedia(m);
        if (kind === 'videos') {
          const r = await jsonFetch('https://api.linkedin.com/rest/videos?action=initializeUpload', { method: 'POST', headers: H(t), body: JSON.stringify({ initializeUploadRequest: { owner: author, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false } }) });
          const v = r.value; const parts: string[] = []; let off = 0;
          for (const ins of v.uploadInstructions) { const part = buf.subarray(ins.firstByte, ins.lastByte + 1); const up = await fetch(ins.uploadUrl, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: part }); parts.push(up.headers.get('etag') || ''); off += part.length; }
          await jsonFetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', { method: 'POST', headers: H(t), body: JSON.stringify({ finalizeUploadRequest: { video: v.video, uploadToken: v.uploadToken || '', uploadedPartIds: parts } }) });
          return v.video as string;
        }
        const r = await jsonFetch(`https://api.linkedin.com/rest/${kind}?action=initializeUpload`, { method: 'POST', headers: H(t), body: JSON.stringify({ initializeUploadRequest: { owner: author } }) });
        const up = await fetch(r.value.uploadUrl, { method: 'PUT', headers: { authorization: `Bearer ${t}`, 'content-type': m.mime || 'application/octet-stream' }, body: buf }); if (!up.ok) throw new Error(`upload failed ${up.status}`);
        return (r.value.image || r.value.document) as string;
      };
      if (i.mediaType === 'video') post.content = { media: { id: await initUpload('videos', i.media[0]), title: i.title } };
      else if (i.mediaType === 'photo' && i.media.length === 1) post.content = { media: { id: await initUpload('images', i.media[0]), altText: i.params.alt_text || undefined } };
      else if (i.mediaType === 'photo') { const ids: string[] = []; for (const m of i.media.slice(0, 20)) ids.push(await initUpload('images', m)); post.content = { multiImage: { images: ids.map((id) => ({ id })) } }; }
      else if (i.mediaType === 'document') post.content = { media: { id: await initUpload('documents', i.media[0]), title: i.title } };
      else if (i.params.linkedin_link_url || i.params.link_url) post.content = { article: { source: i.params.linkedin_link_url || i.params.link_url, title: i.title.slice(0, 200) } };
      const res = await fetch('https://api.linkedin.com/rest/posts', { method: 'POST', headers: H(t), body: JSON.stringify(post) });
      if (!res.ok) return fail(`LinkedIn: ${(await res.text()).slice(0, 300)}`, 'platform_error', res.status >= 500);
      const id = res.headers.get('x-restli-id') || '';
      if (i.firstComment) fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(id)}/comments`, { method: 'POST', headers: H(t), body: JSON.stringify({ actor: author, message: { text: i.firstComment } }) }).catch(() => {});
      return ok({ post_url: `https://www.linkedin.com/feed/update/${id}/`, platform_post_id: id, message: 'Published on LinkedIn' });
    } catch (e: any) { return fail(`LinkedIn: ${e.message}`, 'platform_error', true); }
  },
  async unpublish(acc, postId) { const r = await fetch(`https://api.linkedin.com/rest/posts/${encodeURIComponent(postId)}`, { method: 'DELETE', headers: H(acc.access_token!) }); if (!r.ok) throw new Error(await r.text()); },
};
registerProvider(linkedin);
