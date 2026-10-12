import { createHash } from 'node:crypto';
import { registerProvider } from '../registry';
import { fail, ok } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

// bech32 decode for nsec1… keys
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Decode(s: string): Uint8Array {
  const lower = s.toLowerCase(); const pos = lower.lastIndexOf('1');
  const data = [...lower.slice(pos + 1, -6)].map((ch) => CHARSET.indexOf(ch));
  let acc = 0, bits = 0; const out: number[] = [];
  for (const v of data) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); } }
  return Uint8Array.from(out);
}
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
async function loadSecp() { try { const secp = await import('@noble/secp256k1'); const { sha256 } = await import('@noble/hashes/sha256'); const { hmac } = await import('@noble/hashes/hmac'); (secp as any).etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) => hmac(sha256, k, (secp as any).etc.concatBytes(...m)); return secp; } catch { return null; } }

const nostr: CredentialsProvider = {
  kind: 'credentials', key: 'nostr', configured: () => true,
  async verify(c) {
    const secp = await loadSecp(); if (!secp) throw new Error('Nostr signing library not installed on the server');
    const nsec = (c.nsec || '').trim(); if (!nsec.startsWith('nsec1')) throw new Error('Private key must be an nsec1… key');
    const sk = bech32Decode(nsec); const pk = hex((secp as any).schnorr.getPublicKey(sk));
    const relays = (c.relays || 'wss://relay.damus.io, wss://nos.lol').split(',').map((r: string) => r.trim()).filter(Boolean);
    return { account_id: pk, account_name: 'npub…' + pk.slice(-8), display_name: `Nostr (${relays.length} relays)`, avatar_url: null, meta: { pubkey: pk, relays } };
  },
  async publish(i) {
    const secp = await loadSecp(); if (!secp) return fail('Nostr signing library not installed', 'server_misconfigured');
    const c = parse(i.account.credentials_json, {} as any); const meta = parse(i.account.meta_json, {} as any);
    try {
      const sk = bech32Decode(c.nsec); const pubkey = meta.pubkey || hex((secp as any).schnorr.getPublicKey(sk));
      const content = [i.title, i.description].filter(Boolean).join('\n\n');
      const created_at = Math.floor(Date.now() / 1000); const tags = (content.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => ['t', t.slice(1).toLowerCase()]);
      const id = createHash('sha256').update(JSON.stringify([0, pubkey, created_at, 1, tags, content])).digest('hex');
      const sig = hex(await (secp as any).schnorr.sign(id, sk));
      const event = { id, pubkey, created_at, kind: 1, tags, content, sig };
      const relays: string[] = meta.relays || ['wss://relay.damus.io'];
      const results = await Promise.allSettled(relays.map((r) => new Promise<void>((resolve, reject) => { const ws = new WebSocket(r); const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000); ws.onopen = () => ws.send(JSON.stringify(['EVENT', event])); ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d[0] === 'OK' && d[1] === id) { clearTimeout(t); ws.close(); d[2] ? resolve() : reject(new Error(d[3] || 'rejected')); } }; ws.onerror = () => { clearTimeout(t); reject(new Error('connection error')); }; })));
      const okN = results.filter((r) => r.status === 'fulfilled').length;
      if (!okN) return fail('No relay accepted the note', 'platform_error', true);
      return ok({ post_url: `https://njump.me/${id}`, platform_post_id: id, message: `Note broadcast to ${okN}/${relays.length} relays` });
    } catch (e: any) { return fail(`Nostr: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(nostr);
