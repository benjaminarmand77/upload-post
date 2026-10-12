import { registerProvider } from '../registry';
import { fail, ok, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const whop: CredentialsProvider = {
  kind: 'credentials', key: 'whop', configured: () => true,
  async verify(c) {
    if (!c.api_key || !c.experience_id) throw new Error('api_key and experience_id are required');
    const exp = await jsonFetch(`https://api.whop.com/api/v5/app/experiences/${c.experience_id}`, { headers: { authorization: `Bearer ${c.api_key}` } }).catch(() => ({ id: c.experience_id, name: 'Forum' }));
    return { account_id: String(exp.id || c.experience_id), account_name: String(exp.company_id || 'whop'), display_name: exp.name || 'Whop forum', avatar_url: null };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any);
    try {
      const r = await jsonFetch('https://api.whop.com/api/v5/app/forum_posts', { method: 'POST', headers: { authorization: `Bearer ${c.api_key}`, 'content-type': 'application/json' }, body: JSON.stringify({ experience_id: c.experience_id, title: i.title, content: i.description || i.title }) });
      return ok({ post_url: r.url || null, platform_post_id: String(r.id || Date.now()), message: 'Posted to Whop forum' });
    } catch (e: any) { return fail(`Whop: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(whop);
