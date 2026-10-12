import { registerProvider } from '../registry';
import { fail, ok, blob, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const base = (u: string) => u.trim().replace(/\/$/, '');
async function login(c: any) { const r = await jsonFetch(`${base(c.instance_url)}/api/v3/user/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username_or_email: c.username, password: c.password }) }); return r.jwt as string; }
const lemmy: CredentialsProvider = {
  kind: 'credentials', key: 'lemmy', configured: () => true,
  async verify(c) {
    if (!/^https:\/\//.test(c.instance_url || '')) throw new Error('Instance URL must start with https://');
    const jwt = await login(c);
    const comm = await jsonFetch(`${base(c.instance_url)}/api/v3/community?name=${encodeURIComponent(c.community)}`, { headers: { authorization: `Bearer ${jwt}` } });
    return { account_id: String(comm.community_view.community.id), account_name: c.username, display_name: `!${comm.community_view.community.name}@${new URL(c.instance_url).host}`, avatar_url: comm.community_view.community.icon || null, meta: { community_id: comm.community_view.community.id } };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any); const inst = base(c.instance_url);
    try {
      const jwt = await login(c); const meta = parse(i.account.meta_json, {} as any);
      let url: string | undefined;
      if (i.media[0]) { const fd = new FormData(); fd.append('images[]', await blob(i.media[0]), i.media[0].filename); const up = await jsonFetch(`${inst}/pictrs/image`, { method: 'POST', headers: { cookie: `jwt=${jwt}`, authorization: `Bearer ${jwt}` }, body: fd }); url = `${inst}/pictrs/image/${up.files[0].file}`; }
      const r = await jsonFetch(`${inst}/api/v3/post`, { method: 'POST', headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: i.title, body: i.description || undefined, url: url || i.params.link_url || undefined, community_id: meta.community_id, nsfw: !!i.params.nsfw }) });
      return ok({ post_url: `${inst}/post/${r.post_view.post.id}`, platform_post_id: String(r.post_view.post.id), message: 'Posted to Lemmy' });
    } catch (e: any) { return fail(`Lemmy: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(lemmy);
