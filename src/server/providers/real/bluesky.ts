import { registerProvider } from '../registry';
import { fail, ok, readMedia, splitThread, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const PDS = 'https://bsky.social';
async function session(c: any) { return jsonFetch(`${PDS}/xrpc/com.atproto.server.createSession`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: c.handle, password: c.app_password }) }); }
function facets(text: string) {
  const enc = new TextEncoder(); const out: any[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) { const s = enc.encode(text.slice(0, m.index)).length; out.push({ index: { byteStart: s, byteEnd: s + enc.encode(m[0]).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] }); }
  for (const m of text.matchAll(/(^|\s)(#[\p{L}\p{N}_]+)/gu)) { const idx = (m.index || 0) + m[1].length; const s = enc.encode(text.slice(0, idx)).length; out.push({ index: { byteStart: s, byteEnd: s + enc.encode(m[2]).length }, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[2].slice(1) }] }); }
  return out;
}
const bluesky: CredentialsProvider = {
  kind: 'credentials', key: 'bluesky', configured: () => true,
  async verify(c) {
    if (!c.handle || !c.app_password) throw new Error('handle and app_password are required');
    const s = await session({ handle: c.handle.replace(/^@/, ''), app_password: c.app_password });
    const prof = await jsonFetch(`${PDS}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`, { headers: { authorization: `Bearer ${s.accessJwt}` } }).catch(() => ({}));
    return { account_id: s.did, account_name: s.handle, display_name: prof.displayName || s.handle, avatar_url: prof.avatar || null };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any);
    try {
      const s = await session(c); const h = { authorization: `Bearer ${s.accessJwt}`, 'content-type': 'application/json' };
      const text = [i.title, i.description].filter(Boolean).join('\n\n');
      const parts = splitThread(text, 300);
      let embed: any = undefined;
      if (i.mediaType === 'photo' && i.media.length) {
        const images: any[] = [];
        for (const m of i.media.slice(0, 4)) { const up = await jsonFetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, { method: 'POST', headers: { authorization: `Bearer ${s.accessJwt}`, 'content-type': m.mime || 'image/jpeg' }, body: await readMedia(m) }); images.push({ alt: i.params.alt_text || '', image: up.blob, aspectRatio: m.width && m.height ? { width: m.width, height: m.height } : undefined }); }
        embed = { $type: 'app.bsky.embed.images', images };
      } else if (i.mediaType === 'video' && i.media.length) {
        const up = await jsonFetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, { method: 'POST', headers: { authorization: `Bearer ${s.accessJwt}`, 'content-type': i.media[0].mime || 'video/mp4' }, body: await readMedia(i.media[0]) });
        embed = { $type: 'app.bsky.embed.video', video: up.blob };
      } else if (i.params.bluesky_link_url || i.params.link_url) {
        embed = { $type: 'app.bsky.embed.external', external: { uri: i.params.bluesky_link_url || i.params.link_url, title: i.title.slice(0, 100), description: '' } };
      }
      let root: any = null, parent: any = null, firstUri = '';
      if (i.params.reply_to_id) { const m = String(i.params.reply_to_id).match(/at:\/\/[^\s]+/); if (m) { root = parent = { uri: m[0], cid: '' }; } }
      for (const [idx, p] of parts.entries()) {
        const record: any = { $type: 'app.bsky.feed.post', text: p, createdAt: new Date().toISOString(), facets: facets(p), langs: i.params.lang ? [i.params.lang] : undefined };
        if (idx === 0 && embed) record.embed = embed;
        if (parent) record.reply = { root, parent };
        const r = await jsonFetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, { method: 'POST', headers: h, body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record }) });
        if (!root) root = { uri: r.uri, cid: r.cid }; parent = { uri: r.uri, cid: r.cid };
        if (!firstUri) firstUri = r.uri;
      }
      const rkey = firstUri.split('/').pop();
      return ok({ post_url: `https://bsky.app/profile/${s.handle}/post/${rkey}`, platform_post_id: firstUri, message: parts.length > 1 ? `Posted as a thread of ${parts.length}` : 'Posted to Bluesky' });
    } catch (e: any) { return fail(`Bluesky: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(bluesky);
