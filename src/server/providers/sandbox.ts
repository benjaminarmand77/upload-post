/**
 * Sandbox publishing: used when a platform has no OAuth app configured in .env
 * (or when an account was connected in sandbox mode). It behaves like the real
 * thing from the API's point of view — realistic post ids and URLs, latency,
 * validation of platform rules — without touching any social network.
 */
import { createHash } from 'node:crypto';
import { PLATFORM_MAP, type PlatformKey } from '../../lib/platforms';
import type { PublishInput, PublishResult, PublishFailure, AccountInfo } from './types';
import { ok, fail } from './types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const idFor = (seed: string, len = 18, digitsOnly = true) => { const h = createHash('sha256').update(seed).digest('hex'); return digitsOnly ? String(BigInt('0x' + h.slice(0, 16))).padStart(len, '1').slice(0, len) : h.slice(0, len); };

export function sandboxAccount(platform: PlatformKey, username: string, creds: Record<string, string> = {}): AccountInfo {
  const handle = (creds.handle || creds.username || creds.account_name || `${username}_${platform}`).replace(/^@/, '').replace(/[^a-z0-9_.-]/gi, '').toLowerCase() || `${platform}_user`;
  const names: Record<string, string> = { tiktok: 'TikTok Creator', instagram: 'Instagram Account', youtube: 'YouTube Channel', linkedin: 'LinkedIn Member', facebook: 'Facebook Page', x: 'X Account', threads: 'Threads Profile', pinterest: 'Pinterest Account', reddit: 'Reddit User', bluesky: 'Bluesky Account', google_business: 'Business Profile', discord: creds.webhook_url ? 'Discord channel' : 'Discord', telegram: creds.chat_id || 'Telegram channel', slack: 'Slack channel', mastodon: creds.instance_url ? new URL(creds.instance_url).host : 'Mastodon', nostr: 'Nostr', lemmy: creds.community ? `!${creds.community}` : 'Lemmy', devto: 'DEV Community', hashnode: 'Hashnode', wordpress: creds.site_url ? new URL(creds.site_url).host : 'WordPress', whop: 'Whop forum', listmonk: `Listmonk list ${creds.list_id || '1'}` };
  return { account_id: idFor(platform + handle, 16), account_name: handle, display_name: names[platform] || PLATFORM_MAP[platform].name, avatar_url: null, meta: { sandbox: true } };
}

export function sandboxPostUrl(platform: PlatformKey, handle: string, postId: string, title: string): string {
  const slug = (title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'post';
  switch (platform) {
    case 'tiktok': return `https://www.tiktok.com/@${handle}/video/${postId}`;
    case 'instagram': return `https://www.instagram.com/p/${idFor(postId, 11, false)}/`;
    case 'youtube': return `https://www.youtube.com/watch?v=${idFor(postId, 11, false)}`;
    case 'linkedin': return `https://www.linkedin.com/feed/update/urn:li:share:${postId}/`;
    case 'facebook': return `https://www.facebook.com/${handle}/posts/${postId}`;
    case 'x': return `https://x.com/${handle}/status/${postId}`;
    case 'threads': return `https://www.threads.net/@${handle}/post/${idFor(postId, 11, false)}`;
    case 'pinterest': return `https://www.pinterest.com/pin/${postId}/`;
    case 'reddit': return `https://www.reddit.com/r/${handle}/comments/${idFor(postId, 7, false)}/${slug}/`;
    case 'bluesky': return `https://bsky.app/profile/${handle}/post/${idFor(postId, 13, false)}`;
    case 'google_business': return `https://business.google.com/posts/l/${postId}`;
    case 'discord': return `https://discord.com/channels/${idFor(handle, 18)}/${postId}`;
    case 'telegram': return `https://t.me/${handle.replace(/^-?100/, 'c/')}/${postId.slice(0, 5)}`;
    case 'slack': return `https://slack.com/archives/C${idFor(handle, 10, false).toUpperCase()}/p${postId}`;
    case 'mastodon': return `https://mastodon.social/@${handle}/${postId}`;
    case 'nostr': return `https://njump.me/note1${idFor(postId, 58, false)}`;
    case 'lemmy': return `https://lemmy.world/post/${postId.slice(0, 7)}`;
    case 'devto': return `https://dev.to/${handle}/${slug}-${idFor(postId, 4, false)}`;
    case 'hashnode': return `https://${handle}.hashnode.dev/${slug}`;
    case 'wordpress': return `https://${handle}/${slug}/`;
    case 'whop': return `https://whop.com/${handle}/forum/${idFor(postId, 8, false)}`;
    case 'listmonk': return `https://listmonk.example.com/admin/campaigns/${postId.slice(0, 4)}`;
  }
}

export async function sandboxPublish(input: PublishInput): Promise<PublishResult | PublishFailure> {
  const platform = input.account.platform as PlatformKey;
  const p = PLATFORM_MAP[platform];
  const title = input.title || '';
  // Deterministic test hooks so integrations can exercise failures
  if (/\[fail\]/i.test(title)) return fail(`Simulated ${p.name} failure requested with [fail] in the title`, 'sandbox_failure', true);
  if (/\[slow\]/i.test(title)) await sleep(4000);
  // Platform rules (same ones the real providers enforce)
  if (input.mediaType === 'video' && !p.supports.video) return fail(`${p.name} does not support video uploads`, 'unsupported_media');
  if (input.mediaType === 'photo' && !p.supports.photos) return fail(`${p.name} does not support photo uploads`, 'unsupported_media');
  if (input.mediaType === 'text' && !p.supports.text) return fail(`${p.name} does not support text posts`, 'unsupported_media');
  if (input.mediaType === 'document' && !p.supports.document) return fail(`${p.name} does not support document uploads`, 'unsupported_media');
  if (input.mediaType === 'photo' && p.maxPhotos && input.media.length > p.maxPhotos) return fail(`${p.name} accepts at most ${p.maxPhotos} photos per post (received ${input.media.length})`, 'too_many_photos');
  if (platform === 'youtube' && !title) return fail('YouTube requires a title', 'missing_title');
  if (platform === 'reddit' && !title) return fail('Reddit requires a title', 'missing_title');
  if (platform === 'reddit' && !input.params.subreddit) return fail('Reddit requires the subreddit parameter (without r/)', 'missing_subreddit');
  if (platform === 'pinterest' && !input.params.pinterest_board_id && !input.account.meta_json.includes('default_board')) return fail('Pinterest requires pinterest_board_id. List boards with GET /api/uploadposts/pinterest/boards', 'missing_board');
  if (platform === 'x' && input.mediaType === 'text' && /https?:\/\//.test(title) && !input.params.__x_links_allowed) return fail('Posting links on X requires the "Post links on X / Twitter" add-on', 'x_links_addon_required');
  await sleep(250 + Math.random() * 600);
  const handle = input.account.account_name || 'user';
  const postId = idFor(`${input.upload.id}:${platform}:${Date.now()}`);
  const changes: string[] = [];
  if (input.mediaType === 'video' && ['tiktok', 'instagram', 'facebook', 'youtube', 'x'].includes(platform)) changes.push('transcoded_h264_aac');
  if (input.mediaType === 'video' && (input.media[0]?.size || 0) > 50 * 1024 * 1024 && platform !== 'youtube') changes.push('bitrate_reduced');
  let message = `Published to ${p.name}`;
  if (platform === 'x' && title.length > 280 && !input.params.x_long_text_as_post) message += ` as a thread of ${Math.ceil(title.length / 270)} posts`;
  if (platform === 'threads' && title.length > 500 && !input.params.threads_long_text_as_post) message += ` as a thread`;
  if (platform === 'bluesky' && title.length > 300) message += ` as a thread`;
  if (platform === 'tiktok' && input.params.post_mode === 'MEDIA_UPLOAD') message = 'Sent to TikTok drafts (MEDIA_UPLOAD)';
  return ok({ post_url: sandboxPostUrl(platform, handle, postId, title), platform_post_id: postId, message, changes, meta: { sandbox: true, publish_id: 'v_pub_' + postId.slice(0, 10) } });
}
