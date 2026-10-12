import { registerProvider } from '../registry';
import { fail, ok, truncate } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const slack: CredentialsProvider = {
  kind: 'credentials', key: 'slack', configured: () => true,
  async verify(c) {
    const url = (c.webhook_url || '').trim();
    if (!/^https:\/\/hooks\.slack\.com\/services\/T[\w]+\/B[\w]+\/[\w]+$/.test(url)) throw new Error('Enter a valid Slack incoming webhook URL (https://hooks.slack.com/services/…)');
    const [, t, b] = url.match(/services\/(T\w+)\/(B\w+)/)!;
    return { account_id: b, account_name: t.toLowerCase(), display_name: 'Slack incoming webhook', avatar_url: null, meta: { team: t } };
  },
  async publish(i) {
    const url = parse(i.account.credentials_json, {} as any).webhook_url;
    const text = truncate([i.title, i.description].filter(Boolean).join('\n\n'), 4000);
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!res.ok) return fail(`Slack error ${res.status}: ${(await res.text()).slice(0, 200)}`, 'platform_error', res.status >= 500);
    return ok({ post_url: null, platform_post_id: `slack_${Date.now()}`, message: 'Message posted to Slack' });
  },
};
registerProvider(slack);
