import { registerProvider } from '../registry';
import { env, fail, ok, jsonFetch, form, publicUrl } from './_shared';
import type { OAuthProvider } from '../types';
import { parse, run, now } from '../../db';

const SCOPE = 'https://www.googleapis.com/auth/business.manage';
const cid = () => env('GOOGLE_BUSINESS_CLIENT_ID') || env('GOOGLE_CLIENT_ID'); const sec = () => env('GOOGLE_BUSINESS_CLIENT_SECRET') || env('GOOGLE_CLIENT_SECRET');
async function token(acc: any) { if (acc.expires_at && new Date(acc.expires_at).getTime() - 60000 < Date.now() && acc.refresh_token) { const r = await jsonFetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ client_id: cid(), client_secret: sec(), refresh_token: acc.refresh_token, grant_type: 'refresh_token' }) }); run('UPDATE social_accounts SET access_token = ?, expires_at = ?, updated_at = ? WHERE id = ?', r.access_token, new Date(Date.now() + r.expires_in * 1000).toISOString(), now(), acc.id); return r.access_token; } return acc.access_token; }
const gbp: OAuthProvider = {
  kind: 'oauth', key: 'google_business', configured: () => !!cid(),
  authorizeUrl: (state, redirectUri) => `https://accounts.google.com/o/oauth2/v2/auth?${form({ client_id: cid(), redirect_uri: redirectUri, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state })}`,
  exchangeCode: (code, redirectUri) => jsonFetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ code, client_id: cid(), client_secret: sec(), redirect_uri: redirectUri, grant_type: 'authorization_code' }) }),
  async fetchAccount(t) {
    const h = { authorization: `Bearer ${t.access_token}` };
    const accs = await jsonFetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers: h }); const a = accs.accounts?.[0]; if (!a) throw new Error('No Google Business account found');
    const locs = await jsonFetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title`, { headers: h }); const l = locs.locations?.[0]; if (!l) throw new Error('No business location found');
    return { account_id: l.name, account_name: l.title, display_name: l.title, avatar_url: null, meta: { account: a.name, locations: locs.locations.map((x: any) => ({ name: x.name, title: x.title })) } };
  },
  async publish(i) {
    try {
      const at = await token(i.account); const meta = parse(i.account.meta_json, {} as any); const loc = i.params.location_name || i.account.account_id;
      const body: any = { languageCode: i.params.language || 'en', summary: i.params.google_business_title || i.title, topicType: (i.params.topic_type || 'STANDARD').toUpperCase() };
      if (i.params.cta_type) body.callToAction = { actionType: String(i.params.cta_type).toUpperCase(), url: i.params.cta_url };
      if (body.topicType === 'EVENT' || body.topicType === 'OFFER') body.event = { title: i.params.event_title || i.title, schedule: { startDate: dateObj(i.params.event_start), endDate: dateObj(i.params.event_end) } };
      if (body.topicType === 'OFFER') body.offer = { couponCode: i.params.coupon_code, redeemOnlineUrl: i.params.redeem_url, termsConditions: i.params.terms };
      if (i.media[0]) body.media = [{ mediaFormat: 'PHOTO', sourceUrl: publicUrl(`/uploads/${i.media[0].id}`) }];
      const r = await jsonFetch(`https://mybusiness.googleapis.com/v4/${meta.account}/${loc}/localPosts`, { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return ok({ post_url: r.searchUrl || null, platform_post_id: r.name, message: 'Google Business post published' });
    } catch (e: any) { return fail(`Google Business: ${e.message}`, 'platform_error', true); }
  },
};
const dateObj = (s?: string) => { if (!s) return undefined; const d = new Date(s); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; };
registerProvider(gbp);
