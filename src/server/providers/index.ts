import { PLATFORMS, PLATFORM_MAP, type PlatformKey } from '../../lib/platforms';
import type { Provider, OAuthProvider, CredentialsProvider, PublishInput, PublishResult, PublishFailure, AccountInfo } from './types';
import { sandboxAccount, sandboxPublish } from './sandbox';
import type { SocialAccountRow } from '../db';
import { parse } from '../db';

import { registerProvider, getProvider } from './registry';
export { registerProvider, getProvider };

/** True when the platform can run against the real network (env configured). */
export function isConfigured(platform: PlatformKey): boolean {
  const p = PLATFORM_MAP[platform];
  if (p.auth === 'credentials') return true;
  const prov = getProvider(platform);
  return !!prov && prov.configured();
}

/** Credential platforms: verify the pasted credentials (real call when the provider implements it, sandbox otherwise). */
export async function verifyCredentials(platform: PlatformKey, username: string, creds: Record<string, string>, opts: { sandbox?: boolean } = {}): Promise<AccountInfo & { sandbox: boolean }> {
  const prov = getProvider(platform);
  if (prov && prov.kind === 'credentials' && !opts.sandbox) {
    try { const info = await prov.verify(creds); return { ...info, sandbox: false }; }
    catch (e: any) { throw new Error(`Could not verify ${PLATFORM_MAP[platform].name} credentials: ${e.message}`); }
  }
  return { ...sandboxAccount(platform, username, creds), sandbox: true };
}

export async function publishTo(input: PublishInput): Promise<PublishResult | PublishFailure> {
  const platform = input.account.platform as PlatformKey;
  const prov = getProvider(platform);
  if (input.account.sandbox || !prov || (prov.kind === 'oauth' && !prov.configured())) return sandboxPublish(input);
  try { return await prov.publish(input); }
  catch (e: any) { return { success: false, error: String(e?.message || e), error_code: 'platform_error', retryable: true }; }
}

export function oauthProvider(platform: PlatformKey): OAuthProvider | null { const p = getProvider(platform); return p && p.kind === 'oauth' ? p : null; }
export function credentialsOf(account: SocialAccountRow): Record<string, string> { return parse(account.credentials_json, {}); }

// Real providers register themselves on import. Each one is optional and
// falls back to sandbox when its environment variables are missing.
import './real/discord';
import './real/telegram';
import './real/slack';
import './real/mastodon';
import './real/bluesky';
import './real/wordpress';
import './real/devto';
import './real/hashnode';
import './real/lemmy';
import './real/listmonk';
import './real/whop';
import './real/nostr';
import './real/youtube';
import './real/meta';
import './real/tiktok';
import './real/linkedin';
import './real/x';
import './real/pinterest';
import './real/reddit';
import './real/google_business';

export const providerSummary = () => PLATFORMS.map((p) => ({ key: p.key, name: p.name, auth: p.auth, configured: isConfigured(p.key), sandbox: !isConfigured(p.key) }));
