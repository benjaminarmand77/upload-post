import type { PlatformKey } from '../../lib/platforms';
import type { SocialAccountRow, UploadRow } from '../db';
import type { StoredMedia } from '../media';

export interface PublishInput {
  account: SocialAccountRow;
  upload: UploadRow;
  mediaType: 'video' | 'photo' | 'text' | 'document';
  title: string;
  description: string | null;
  params: Record<string, any>;   // raw, platform-specific params as received
  media: StoredMedia[];           // video: [file]; photo: [files]; document: [file]
  firstComment?: string | null;
}
export interface PublishResult { success: true; post_url: string | null; platform_post_id: string | null; message?: string; meta?: Record<string, any>; changes?: string[] }
export interface PublishFailure { success: false; error: string; error_code?: string; retryable?: boolean }

export interface AccountInfo { account_id: string; account_name: string; display_name?: string; avatar_url?: string | null; meta?: Record<string, any> }

export interface OAuthProvider {
  kind: 'oauth';
  key: PlatformKey;
  configured(): boolean;
  authorizeUrl(state: string, redirectUri: string, extra?: Record<string, string>): string;
  exchangeCode(code: string, redirectUri: string, extra?: Record<string, string>): Promise<{ access_token: string; refresh_token?: string | null; expires_in?: number | null; scope?: string; raw?: any }>;
  fetchAccount(tokens: { access_token: string }): Promise<AccountInfo>;
  refresh?(account: SocialAccountRow): Promise<{ access_token: string; refresh_token?: string | null; expires_in?: number | null } | null>;
  publish(input: PublishInput): Promise<PublishResult | PublishFailure>;
  analytics?(account: SocialAccountRow): Promise<Record<string, any>>;
  listMedia?(account: SocialAccountRow, limit: number, cursor?: string | null): Promise<{ media: any[]; next_cursor: string | null }>;
  listPages?(account: SocialAccountRow): Promise<any[]>;
  unpublish?(account: SocialAccountRow, postId: string): Promise<void>;
}
export interface CredentialsProvider {
  kind: 'credentials';
  key: PlatformKey;
  configured(): boolean; // always true for credential providers
  verify(creds: Record<string, string>): Promise<AccountInfo>;
  publish(input: PublishInput): Promise<PublishResult | PublishFailure>;
}
export type Provider = OAuthProvider | CredentialsProvider;

export const fail = (error: string, error_code?: string, retryable = false): PublishFailure => ({ success: false, error, error_code, retryable });
export const ok = (r: Omit<PublishResult, 'success'>): PublishResult => ({ success: true, ...r });
export const env = (k: string) => process.env[k] || '';
export async function jsonFetch(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(60000) });
  const text = await res.text();
  let data: any = text; try { data = JSON.parse(text); } catch {}
  if (!res.ok) { const msg = typeof data === 'object' && data ? (data.error?.message || data.error_description || data.message || data.error || JSON.stringify(data)) : text; throw new Error(`HTTP ${res.status}: ${String(msg).slice(0, 300)}`); }
  return data;
}
export function form(obj: Record<string, any>) { const p = new URLSearchParams(); for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) p.set(k, String(v)); return p; }
