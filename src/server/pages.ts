import { route, requireUser, json, err } from './api';
import { listProfiles, accountFor, getProfile } from './uploads';
import { oauthProvider } from './providers';
import { parse } from './db';
import type { PlatformKey } from '../lib/platforms';
import type { APIContext } from 'astro';

/** Shared handler for "pages/boards" style listings. */
export function pagesEndpoint(platform: PlatformKey, key: 'pages' | 'boards', mk: (acc: any, p: string) => any[]) {
  return route(async (ctx: APIContext) => {
    const { user } = requireUser(ctx); const pu = ctx.url.searchParams.get('profile') || ctx.url.searchParams.get('user');
    const profiles = pu ? [getProfile(user.id, pu)].filter(Boolean) : listProfiles(user.id);
    if (pu && !profiles.length) return err(404, 'Profile not found', 'profile_not_found');
    const out: any[] = []; let used: string | null = null;
    for (const p of profiles as any[]) {
      const acc = accountFor(p.id, platform); if (!acc) continue; used = acc.account_name;
      const prov = oauthProvider(platform);
      if (!acc.sandbox && prov?.listPages) { try { out.push(...(await prov.listPages(acc)).map((x: any) => ({ ...x, profile: p.username }))); continue; } catch {} }
      out.push(...mk(acc, p.username));
    }
    if (pu && !out.length && !accountFor((profiles[0] as any).id, platform)) return err(404, `No ${platform} account connected to this profile`, 'account_not_connected');
    return json(key === 'pages' ? { success: true, pages: out } : { success: true, boards: out, pinterest_account_used: used });
  });
}
export const sandboxPages = (acc: any, profile: string, kind: string) => [{ id: `${acc.account_id}`, name: `${acc.display_name || acc.account_name} ${kind}`, picture: acc.avatar_url, account_id: acc.account_id, profile }, { id: `${acc.account_id}2`, name: `${acc.display_name || acc.account_name} — Secondary ${kind}`, picture: null, account_id: acc.account_id, profile }];
export const sandboxBoards = (acc: any, profile: string) => ['Inspiration', 'Products', 'Behind the scenes', 'Tutorials'].map((n, i) => ({ id: `${parse(acc.meta_json, {} as any).board_base || acc.account_id}${i}`, name: n, privacy: i === 3 ? 'SECRET' : 'PUBLIC', profile }));
