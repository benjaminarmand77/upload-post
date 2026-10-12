import { registerProvider } from '../registry';
import { fail, ok, readMedia, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const site = (u: string) => u.trim().replace(/\/$/, '');
const auth = (c: any) => 'Basic ' + Buffer.from(`${c.username}:${c.app_password}`).toString('base64');
const wordpress: CredentialsProvider = {
  kind: 'credentials', key: 'wordpress', configured: () => true,
  async verify(c) {
    const s = site(c.site_url || ''); if (!/^https?:\/\//.test(s)) throw new Error('Site URL must start with http(s)://');
    const me = await jsonFetch(`${s}/wp-json/wp/v2/users/me?context=edit`, { headers: { authorization: auth(c) } });
    return { account_id: String(me.id), account_name: new URL(s).host, display_name: me.name, avatar_url: me.avatar_urls?.['96'] || null, meta: { site: s } };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any); const s = site(c.site_url); const h = { authorization: auth(c) };
    try {
      const mediaIds: number[] = []; let html = i.description ? `<p>${escapeHtml(i.description).replace(/\n/g, '<br>')}</p>` : '';
      for (const m of i.media) {
        const r = await jsonFetch(`${s}/wp-json/wp/v2/media`, { method: 'POST', headers: { ...h, 'content-type': m.mime || 'application/octet-stream', 'content-disposition': `attachment; filename="${m.filename}"` }, body: await readMedia(m) });
        mediaIds.push(r.id);
        html += m.kind === 'video' ? `<!-- wp:video --><figure class="wp-block-video"><video controls src="${r.source_url}"></video></figure><!-- /wp:video -->` : `<!-- wp:image {"id":${r.id}} --><figure class="wp-block-image"><img src="${r.source_url}" alt=""/></figure><!-- /wp:image -->`;
      }
      const body: any = { title: i.title, content: html || `<p>${escapeHtml(i.title)}</p>`, status: i.params.wordpress_status || 'publish', excerpt: i.params.excerpt || undefined, categories: i.params.categories ? String(i.params.categories).split(',').map(Number).filter(Boolean) : undefined, tags: i.params.tags_ids ? String(i.params.tags_ids).split(',').map(Number).filter(Boolean) : undefined };
      if (mediaIds.length && i.media[0].kind === 'photo') body.featured_media = mediaIds[0];
      const p = await jsonFetch(`${s}/wp-json/wp/v2/posts`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return ok({ post_url: p.link, platform_post_id: String(p.id), message: `WordPress post ${body.status === 'draft' ? 'saved as draft' : 'published'}` });
    } catch (e: any) { return fail(`WordPress: ${e.message}`, 'platform_error', true); }
  },
};
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
registerProvider(wordpress);
