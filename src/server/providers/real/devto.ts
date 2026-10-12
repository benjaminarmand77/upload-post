import { registerProvider } from '../registry';
import { fail, ok, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const devto: CredentialsProvider = {
  kind: 'credentials', key: 'devto', configured: () => true,
  async verify(c) {
    const me = await jsonFetch('https://dev.to/api/users/me', { headers: { 'api-key': c.api_key } });
    return { account_id: String(me.id), account_name: me.username, display_name: me.name, avatar_url: me.profile_image || null };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any);
    try {
      const tags = (i.params.tags ? String(i.params.tags).split(',') : []).map((t) => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 4);
      const r = await jsonFetch('https://dev.to/api/articles', { method: 'POST', headers: { 'api-key': c.api_key, 'content-type': 'application/json' }, body: JSON.stringify({ article: { title: i.title, body_markdown: i.description || i.title, published: i.params.devto_published !== 'false' && i.params.devto_published !== false, tags, canonical_url: i.params.canonical_url || undefined, main_image: i.params.cover_url || undefined, series: i.params.series || undefined } }) });
      return ok({ post_url: r.url, platform_post_id: String(r.id), message: r.published ? 'Article published on DEV' : 'Article saved as draft on DEV' });
    } catch (e: any) { return fail(`Dev.to: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(devto);
