import { registerProvider } from '../registry';
import { fail, ok, blob, truncate } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const discord: CredentialsProvider = {
  kind: 'credentials', key: 'discord', configured: () => true,
  async verify(c) {
    const url = (c.webhook_url || '').trim();
    if (!/^https:\/\/(discord(app)?\.com)\/api\/webhooks\/\d+\/[\w-]+/.test(url)) throw new Error('Enter a valid Discord incoming webhook URL');
    const info = await fetch(url).then((r) => r.ok ? r.json() : Promise.reject(new Error(`Webhook not reachable (HTTP ${r.status})`)));
    return { account_id: info.id, account_name: info.name || 'webhook', display_name: `#${info.channel_id}`, avatar_url: info.avatar ? `https://cdn.discordapp.com/avatars/${info.id}/${info.avatar}.png` : null, meta: { channel_id: info.channel_id, guild_id: info.guild_id } };
  },
  async publish(i) {
    const url = parse(i.account.credentials_json, {} as any).webhook_url;
    if (!url) return fail('Discord webhook missing', 'account_not_connected');
    const fd = new FormData();
    const content = [i.title, i.description].filter(Boolean).join('\n\n');
    fd.append('payload_json', JSON.stringify({ content: truncate(content, 2000), username: i.params.discord_username || undefined }));
    i.media.slice(0, 10).forEach(async () => {});
    for (const [idx, m] of i.media.slice(0, 10).entries()) fd.append(`files[${idx}]`, await blob(m), m.filename);
    const res = await fetch(url + '?wait=true', { method: 'POST', body: fd });
    if (!res.ok) return fail(`Discord error ${res.status}: ${(await res.text()).slice(0, 200)}`, 'platform_error', res.status >= 500);
    const msg = await res.json();
    const meta = parse(i.account.meta_json, {} as any);
    return ok({ post_url: meta.guild_id ? `https://discord.com/channels/${meta.guild_id}/${msg.channel_id}/${msg.id}` : null, platform_post_id: msg.id, message: 'Message sent to Discord' });
  },
};
registerProvider(discord);
