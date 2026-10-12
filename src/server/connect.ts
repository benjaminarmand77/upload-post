/** Social account connection: OAuth flows, credential connections, whitelabel connect links. */
import { randomBytes } from 'node:crypto';
import { PLATFORM_MAP, type PlatformKey } from '../lib/platforms';
import { get, run, all, newId, now, json, parse, logEvent, type ProfileRow, type UserRow, type SocialAccountRow } from './db';
import { oauthProvider, verifyCredentials, isConfigured } from './providers';
import { pkce } from './providers/real/_shared';
import { emitEvent } from './webhooks';
import { signJwt, verifyJwt } from './jwt';
import { deleteMedia } from './media';
import { ApiError } from './api';

export const siteUrl = () => (process.env.SITE_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
export const redirectUriFor = (platform: string) => `${siteUrl()}/app/oauth/callback/${platform}`;

export interface ConnectConfig { redirect_url?: string; logo_image?: string; redirect_button_text?: string; connect_title?: string; connect_description?: string; platforms?: string[]; show_calendar?: boolean; language?: string; ui_labels?: Record<string, string> }

/** Whitelabel: single-use 48h connect link (JWT + DB record). */
export function createConnectLink(user: UserRow, profile: ProfileRow, cfg: ConnectConfig) {
  const token = randomBytes(18).toString('base64url');
  const expires = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const config: ConnectConfig = { ...cfg, platforms: cfg.platforms?.filter((p) => p in PLATFORM_MAP) };
  run('INSERT INTO connect_tokens (token, user_id, profile_id, created_at, expires_at, config_json) VALUES (?,?,?,?,?,?)', token, user.id, profile.id, now(), expires, json(config));
  const jwt = signJwt({ t: token, p: profile.username, u: user.id }, 48 * 3600);
  return { url: `${siteUrl()}/connect?token=${jwt}`, expires_at: expires, token };
}
export function validateConnectToken(jwt: string): { profile: ProfileRow; user: UserRow; config: ConnectConfig; expires_at: string; token: string } | null {
  const p = verifyJwt<{ t: string }>(jwt); if (!p) return null;
  const row = get<any>('SELECT * FROM connect_tokens WHERE token = ?', p.t); if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  const profile = get<ProfileRow>('SELECT * FROM profiles WHERE id = ?', row.profile_id); const user = get<UserRow>('SELECT * FROM users WHERE id = ?', row.user_id);
  if (!profile || !user) return null;
  return { profile, user, config: parse(row.config_json, {}), expires_at: row.expires_at, token: row.token };
}

/** Begin an OAuth flow (real provider when configured, sandbox simulation otherwise). */
export function beginOAuth(platform: PlatformKey, profile: ProfileRow, userId: string | null, redirect: string, connectToken?: string | null): { url: string; sandbox: boolean } {
  const prov = oauthProvider(platform);
  const state = randomBytes(16).toString('base64url');
  const { verifier, challenge } = pkce();
  run('INSERT INTO oauth_states (state, user_id, profile_id, platform, created_at, redirect, code_verifier, connect_token) VALUES (?,?,?,?,?,?,?,?)', state, userId, profile.id, platform, now(), redirect, verifier, connectToken ?? null);
  if (prov && prov.configured()) return { url: prov.authorizeUrl(state, redirectUriFor(platform), { code_challenge: challenge }), sandbox: false };
  return { url: `${siteUrl()}/app/oauth/sandbox/${platform}?state=${state}`, sandbox: true };
}
/** Complete an OAuth flow. `code` is null for sandbox approvals. */
export async function completeOAuth(platform: PlatformKey, state: string, code: string | null, sandboxName?: string | null): Promise<{ account: SocialAccountRow; redirect: string }> {
  const st = get<any>('SELECT * FROM oauth_states WHERE state = ? AND platform = ?', state, platform);
  if (!st) throw new ApiError(400, 'Invalid or expired OAuth state', 'invalid_state');
  if (Date.now() - new Date(st.created_at).getTime() > 30 * 60000) { run('DELETE FROM oauth_states WHERE state = ?', state); throw new ApiError(400, 'OAuth state expired, please retry', 'invalid_state'); }
  run('DELETE FROM oauth_states WHERE state = ?', state);
  const profile = get<ProfileRow>('SELECT * FROM profiles WHERE id = ?', st.profile_id)!;
  const prov = oauthProvider(platform);
  let tokens: any = null; let info; let sandbox = false;
  if (code && prov && prov.configured()) {
    tokens = await prov.exchangeCode(code, redirectUriFor(platform), { code_verifier: st.code_verifier });
    info = await prov.fetchAccount(tokens);
  } else { sandbox = true; const { sandboxAccount } = await import('./providers/sandbox'); info = sandboxAccount(platform, profile.username, sandboxName ? { handle: sandboxName } : {}); }
  const account = upsertAccount(profile, platform, info, { access_token: tokens?.access_token ?? null, refresh_token: tokens?.refresh_token ?? null, expires_in: tokens?.expires_in ?? null, scopes: tokens?.scope ?? null, sandbox });
  return { account, redirect: st.redirect || '/app/manage-users' };
}
/** Credential platforms (Discord, Telegram, WordPress…): verify and store. */
export async function connectWithCredentials(platform: PlatformKey, profile: ProfileRow, creds: Record<string, string>, opts: { sandbox?: boolean } = {}) {
  const p = PLATFORM_MAP[platform]; if (p.auth !== 'credentials') throw new ApiError(400, `${p.name} connects through OAuth`, 'invalid_platform');
  for (const f of p.credentialFields || []) if (!creds[f.key] && !(f.key === 'relays')) throw new ApiError(400, `Missing field: ${f.key}`, 'missing_parameter');
  const info = await verifyCredentials(platform, profile.username, creds, opts).catch((e) => { throw new ApiError(400, e.message, 'invalid_credentials'); });
  return upsertAccount(profile, platform, info, { credentials: creds, sandbox: info.sandbox });
}
function upsertAccount(profile: ProfileRow, platform: PlatformKey, info: any, o: { access_token?: string | null; refresh_token?: string | null; expires_in?: number | null; scopes?: string | null; credentials?: Record<string, string>; sandbox: boolean }): SocialAccountRow {
  const existing = get<SocialAccountRow>('SELECT * FROM social_accounts WHERE profile_id = ? AND platform = ?', profile.id, platform);
  const id = existing?.id || newId('acc_');
  const expires = o.expires_in ? new Date(Date.now() + o.expires_in * 1000).toISOString() : null;
  const meta = { ...(existing ? parse(existing.meta_json, {}) : {}), ...(info.meta || {}) };
  if (existing) run('UPDATE social_accounts SET account_id = ?, account_name = ?, display_name = ?, avatar_url = ?, access_token = ?, refresh_token = ?, expires_at = ?, scopes = ?, credentials_json = ?, status = ?, sandbox = ?, updated_at = ?, meta_json = ? WHERE id = ?', info.account_id, info.account_name, info.display_name ?? info.account_name, info.avatar_url ?? null, o.access_token ?? null, o.refresh_token ?? existing.refresh_token, expires, o.scopes ?? null, json(o.credentials ?? parse(existing.credentials_json, {})), 'connected', o.sandbox ? 1 : 0, now(), json(meta), id);
  else run('INSERT INTO social_accounts (id, profile_id, platform, account_id, account_name, display_name, avatar_url, access_token, refresh_token, expires_at, scopes, credentials_json, status, sandbox, connected_at, updated_at, meta_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, profile.id, platform, info.account_id, info.account_name, info.display_name ?? info.account_name, info.avatar_url ?? null, o.access_token ?? null, o.refresh_token ?? null, expires, o.scopes ?? null, json(o.credentials ?? {}), 'connected', o.sandbox ? 1 : 0, now(), now(), json(meta));
  const acc = get<SocialAccountRow>('SELECT * FROM social_accounts WHERE id = ?', id)!;
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', profile.user_id);
  logEvent(profile.user_id, 'account.connected', { platform, profile: profile.username, sandbox: o.sandbox });
  emitEvent(profile.user_id, 'social_account.connected', { user_email: user?.email, platform, account_name: acc.account_name, status: 'connected', profile_username: profile.username, reason: existing ? 'reconnected' : 'connected' }).catch(() => {});
  // seed analytics for the new account
  import('./analytics').then((m) => m.snapshotAnalytics()).catch(() => {});
  return acc;
}
export function disconnectAccount(profile: ProfileRow, platform: string) {
  const acc = get<SocialAccountRow>('SELECT * FROM social_accounts WHERE profile_id = ? AND platform = ?', profile.id, platform);
  if (!acc) return false;
  run('DELETE FROM social_accounts WHERE id = ?', acc.id); run('DELETE FROM analytics_snapshots WHERE account_id = ?', acc.id);
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', profile.user_id);
  logEvent(profile.user_id, 'account.disconnected', { platform, profile: profile.username });
  emitEvent(profile.user_id, 'social_account.disconnected', { user_email: user?.email, platform, account_name: acc.account_name, status: 'disconnected', profile_username: profile.username, reason: 'manual_disconnect' }).catch(() => {});
  return true;
}
export async function deleteProfile(profileId: string) {
  const p = get<ProfileRow>('SELECT * FROM profiles WHERE id = ?', profileId); if (!p) return;
  for (const a of all<SocialAccountRow>('SELECT * FROM social_accounts WHERE profile_id = ?', profileId)) { run('DELETE FROM analytics_snapshots WHERE account_id = ?', a.id); }
  run('DELETE FROM social_accounts WHERE profile_id = ?', profileId);
  for (const j of all<any>("SELECT upload_id FROM scheduled_jobs WHERE profile_id = ? AND status = 'pending'", profileId)) { for (const m of all<any>('SELECT id FROM media_files WHERE upload_id = ?', j.upload_id)) await deleteMedia(m.id); }
  run("UPDATE scheduled_jobs SET status = 'cancelled' WHERE profile_id = ? AND status = 'pending'", profileId);
  run('DELETE FROM queue_settings WHERE profile_id = ?', profileId); run('DELETE FROM connect_tokens WHERE profile_id = ?', profileId);
  run('DELETE FROM profiles WHERE id = ?', profileId);
}
export const platformIsSandbox = (platform: PlatformKey) => !isConfigured(platform);
