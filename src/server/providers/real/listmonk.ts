import { registerProvider } from '../registry';
import { fail, ok, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const base = (u: string) => u.trim().replace(/\/$/, '');
const auth = (c: any) => 'token ' + `${c.api_user}:${c.api_token}`;
const listmonk: CredentialsProvider = {
  kind: 'credentials', key: 'listmonk', configured: () => true,
  async verify(c) {
    const l = await jsonFetch(`${base(c.instance_url)}/api/lists/${c.list_id}`, { headers: { authorization: auth(c) } });
    return { account_id: String(l.data.id), account_name: c.api_user, display_name: `${l.data.name} (${l.data.subscriber_count} subscribers)`, avatar_url: null, meta: { list_id: l.data.id } };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any); const inst = base(c.instance_url);
    try {
      const r = await jsonFetch(`${inst}/api/campaigns`, { method: 'POST', headers: { authorization: auth(c), 'content-type': 'application/json' }, body: JSON.stringify({ name: i.title, subject: i.title, lists: [Number(c.list_id)], type: 'regular', content_type: i.params.content_type || 'markdown', body: i.description || i.title, from_email: i.params.from_email || undefined }) });
      const id = r.data.id;
      if (i.params.listmonk_send !== 'false') await jsonFetch(`${inst}/api/campaigns/${id}/status`, { method: 'PUT', headers: { authorization: auth(c), 'content-type': 'application/json' }, body: JSON.stringify({ status: 'running' }) });
      return ok({ post_url: `${inst}/admin/campaigns/${id}`, platform_post_id: String(id), message: 'Campaign created and started' });
    } catch (e: any) { return fail(`Listmonk: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(listmonk);
