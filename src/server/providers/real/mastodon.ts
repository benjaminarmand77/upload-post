import { registerProvider } from '../registry';
import { fail, ok, blob, truncate, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const base = (u: string) => u.replace(/\/$/, '');
const mastodon: CredentialsProvider = {
  kind: 'credentials', key: 'mastodon', configured: () => true,
  async verify(c) {
    const inst = base((c.instance_url || '').trim()); if (!/^https:\/\//.test(inst)) throw new Error('Instance URL must start with https://');
    const me = await jsonFetch(`${inst}/api/v1/accounts/verify_credentials`, { headers: { authorization: `Bearer ${c.access_token}` } });
    return { account_id: me.id, account_name: me.username, display_name: me.display_name, avatar_url: me.avatar, meta: { instance: inst, url: me.url } };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any); const inst = base(c.instance_url); const h = { authorization: `Bearer ${c.access_token}` };
    try {
      const mediaIds: string[] = [];
      for (const m of i.media.slice(0, 4)) {
        const fd = new FormData(); fd.append('file', await blob(m), m.filename); if (i.params.alt_text) fd.append('description', i.params.alt_text);
        const r = await fetch(`${inst}/api/v2/media`, { method: 'POST', headers: h, body: fd }); const d = await r.json();
        if (!r.ok) return fail(`Mastodon media error: ${JSON.stringify(d).slice(0, 200)}`, 'platform_error');
        mediaIds.push(d.id);
        if (r.status === 202) for (let k = 0; k < 30; k++) { await new Promise((res) => setTimeout(res, 2000)); const s = await fetch(`${inst}/api/v1/media/${d.id}`, { headers: h }); if (s.status === 200) break; }
      }
      const status = truncate([i.title, i.description].filter(Boolean).join('\n\n'), 500);
      const r = await jsonFetch(`${inst}/api/v1/statuses`, { method: 'POST', headers: { ...h, 'content-type': 'application/json', 'idempotency-key': i.upload.id + i.account.platform }, body: JSON.stringify({ status, media_ids: mediaIds, visibility: i.params.mastodon_visibility || 'public', sensitive: !!i.params.sensitive }) });
      return ok({ post_url: r.url, platform_post_id: r.id, message: 'Posted to Mastodon' });
    } catch (e: any) { return fail(`Mastodon: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(mastodon);
