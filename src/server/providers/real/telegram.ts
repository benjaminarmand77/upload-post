import { registerProvider } from '../registry';
import { fail, ok, blob, truncate, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;
const telegram: CredentialsProvider = {
  kind: 'credentials', key: 'telegram', configured: () => true,
  async verify(c) {
    const token = (c.bot_token || '').trim(); const chat = (c.chat_id || '').trim();
    if (!/^\d+:[\w-]{30,}$/.test(token)) throw new Error('Invalid bot token');
    if (!chat) throw new Error('chat_id is required');
    const me = await jsonFetch(api(token, 'getMe'));
    const ch = await jsonFetch(api(token, 'getChat') + `?chat_id=${encodeURIComponent(chat)}`).catch(() => null);
    return { account_id: String(ch?.result?.id || chat), account_name: ch?.result?.username || chat, display_name: ch?.result?.title || me.result?.username, avatar_url: null, meta: { bot: me.result?.username } };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any);
    const text = truncate([i.title, i.description].filter(Boolean).join('\n\n'), 4096);
    try {
      let r: any;
      if (i.mediaType === 'text' || !i.media.length) r = await jsonFetch(api(c.bot_token, 'sendMessage'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: c.chat_id, text, parse_mode: i.params.telegram_parse_mode || undefined, disable_web_page_preview: false }) });
      else if (i.mediaType === 'video') { const fd = new FormData(); fd.append('chat_id', c.chat_id); fd.append('caption', truncate(text, 1024)); fd.append('video', await blob(i.media[0]), i.media[0].filename); r = await jsonFetch(api(c.bot_token, 'sendVideo'), { method: 'POST', body: fd }); }
      else if (i.media.length === 1) { const fd = new FormData(); fd.append('chat_id', c.chat_id); fd.append('caption', truncate(text, 1024)); fd.append('photo', await blob(i.media[0]), i.media[0].filename); r = await jsonFetch(api(c.bot_token, 'sendPhoto'), { method: 'POST', body: fd }); }
      else { const fd = new FormData(); fd.append('chat_id', c.chat_id); const media = i.media.slice(0, 10).map((m, idx) => ({ type: m.kind === 'video' ? 'video' : 'photo', media: `attach://file${idx}`, caption: idx === 0 ? truncate(text, 1024) : undefined })); fd.append('media', JSON.stringify(media)); for (const [idx, m] of i.media.slice(0, 10).entries()) fd.append(`file${idx}`, await blob(m), m.filename); r = await jsonFetch(api(c.bot_token, 'sendMediaGroup'), { method: 'POST', body: fd }); }
      const msg = Array.isArray(r.result) ? r.result[0] : r.result;
      const chatUser = msg?.chat?.username; const id = String(msg?.message_id || '');
      return ok({ post_url: chatUser ? `https://t.me/${chatUser}/${id}` : null, platform_post_id: id, message: 'Sent to Telegram' });
    } catch (e: any) { return fail(`Telegram: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(telegram);
