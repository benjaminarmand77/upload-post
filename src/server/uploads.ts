import { PLATFORM_MAP, VIDEO_PLATFORMS, PHOTO_PLATFORMS, TEXT_PLATFORMS, type PlatformKey } from '../lib/platforms';
import { get, all, run, newId, now, json, parse, logEvent, type UserRow, type ProfileRow, type SocialAccountRow, type UploadRow } from './db';
import { ApiError } from './api';
import { storeFile, storeUrl, type StoredMedia } from './media';
import { assertUploadQuota, assertPlatformAllowed, bumpUsage, usageInfo } from './plans';
import { interpretInTimezone, nextQueueSlot } from './queue';
import { processUpload } from './publish';

export type MediaType = 'video' | 'photo' | 'text' | 'document';

export function getProfile(userId: string, username: string): ProfileRow | undefined { return get<ProfileRow>('SELECT * FROM profiles WHERE user_id = ? AND username = ?', userId, username); }
export function listProfiles(userId: string): ProfileRow[] { return all<ProfileRow>('SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at', userId); }
export function accountsOf(profileId: string): SocialAccountRow[] { return all<SocialAccountRow>('SELECT * FROM social_accounts WHERE profile_id = ? ORDER BY platform', profileId); }
export function accountFor(profileId: string, platform: string): SocialAccountRow | undefined { return get<SocialAccountRow>('SELECT * FROM social_accounts WHERE profile_id = ? AND platform = ?', profileId, platform); }

/** Public shape of a profile for the API (social_accounts keyed by platform). */
export function profileView(p: ProfileRow) {
  const accounts = accountsOf(p.id);
  const social_accounts: Record<string, any> = {};
  for (const a of accounts) social_accounts[a.platform] = { username: a.account_name, display_name: a.display_name, social_images: a.avatar_url, account_id: a.account_id, status: a.status, connected_at: a.connected_at, sandbox: !!a.sandbox };
  return { username: p.username, created_at: p.created_at, social_accounts };
}

export interface CreateUploadArgs {
  user: UserRow; mediaType: MediaType; profileUsername: string; platforms: string[]; title?: string | null; description?: string | null;
  params: Record<string, any>; files: Record<string, File[]>; urls?: string[]; scheduledDate?: string | null; timezone?: string | null;
  asyncUpload?: boolean; addToQueue?: boolean; dashboard?: boolean; source?: string | null;
}

const ALLOWED: Record<MediaType, readonly string[]> = { video: VIDEO_PLATFORMS, photo: PHOTO_PLATFORMS, text: TEXT_PLATFORMS, document: ['linkedin'] };

/** Validate + persist an upload request, then publish now / later. Returns the API response body + status. */
export async function createUpload(a: CreateUploadArgs): Promise<{ status: number; body: any; upload: UploadRow }> {
  const platforms = [...new Set(a.platforms.map((p) => p.trim().toLowerCase()))].filter(Boolean) as PlatformKey[];
  if (!platforms.length) throw new ApiError(400, 'platform[] is required (e.g. platform[]=tiktok)', 'missing_platform');
  for (const p of platforms) {
    if (!(p in PLATFORM_MAP)) throw new ApiError(400, `Unknown platform: ${p}`, 'invalid_platform');
    if (!ALLOWED[a.mediaType].includes(p)) throw new ApiError(400, `${PLATFORM_MAP[p].name} does not support ${a.mediaType} uploads via this endpoint`, 'unsupported_platform');
    assertPlatformAllowed(a.user, p);
  }
  const profile = getProfile(a.user.id, a.profileUsername);
  if (!profile) throw new ApiError(404, `Profile '${a.profileUsername}' not found. Create it with POST /api/uploadposts/users or in the dashboard.`, 'profile_not_found');
  const missing = platforms.filter((p) => !accountFor(profile.id, p));
  if (missing.length) throw new ApiError(400, `No ${missing.map((m) => PLATFORM_MAP[m].name).join(', ')} account connected to profile '${profile.username}'. Connect it in the dashboard first.`, 'account_not_connected', { missing_platforms: missing });
  if (a.scheduledDate && a.addToQueue) throw new ApiError(400, 'scheduled_date and add_to_queue cannot be used together', 'conflicting_parameters');
  if ((a.mediaType === 'video' || a.mediaType === 'document') && a.params.first_comment_media?.length && (a.scheduledDate || a.addToQueue)) throw new ApiError(400, 'first_comment_media is not available for scheduled or queued posts', 'invalid_parameter');
  if (a.mediaType === 'video' && platforms.includes('youtube') && !a.title) throw new ApiError(400, 'title is required for YouTube uploads', 'missing_title');
  if (platforms.includes('reddit') && !a.title) throw new ApiError(400, 'title is required for Reddit', 'missing_title');
  if (platforms.includes('reddit') && !a.params.subreddit) throw new ApiError(400, 'subreddit is required when platform includes reddit', 'missing_subreddit');
  if (a.mediaType === 'text' && !a.title) throw new ApiError(400, 'title (post text) is required', 'missing_title');
  assertUploadQuota(a.user, 1);

  let scheduledIso: string | null = null;
  if (a.scheduledDate) {
    const d = interpretInTimezone(a.scheduledDate, a.timezone);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid scheduled_date', 'invalid_date');
    if (d.getTime() <= Date.now()) throw new ApiError(400, 'scheduled_date must be in the future', 'invalid_date');
    if (d.getTime() > Date.now() + 366 * 86400000) throw new ApiError(400, 'scheduled_date must be within 365 days', 'invalid_date');
    scheduledIso = d.toISOString();
  }
  let queueSlot: ReturnType<typeof nextQueueSlot> = null;
  if (a.addToQueue) { queueSlot = nextQueueSlot(profile.id); if (!queueSlot) throw new ApiError(409, 'No queue slot available. Configure queue settings for this profile.', 'no_queue_slot'); scheduledIso = queueSlot.datetime_utc; }

  const id = newId('req_', 10);
  // Media
  const media: StoredMedia[] = [];
  if (a.mediaType === 'video') {
    const f = a.files.video?.[0]; const u = typeof a.params.video === 'string' ? a.params.video : null;
    if (!f && !u) throw new ApiError(400, 'video is required (file upload or public URL)', 'missing_video');
    media.push(f ? await storeFile(a.user.id, f, id) : await storeUrl(a.user.id, u!, id));
    if (media[0].kind !== 'video') throw new ApiError(400, `The provided file is not a video (${media[0].mime || 'unknown type'})`, 'invalid_media');
    for (const key of ['thumbnail', 'cover_image']) { const tf = a.files[key]?.[0]; if (tf) { const m = await storeFile(a.user.id, tf, id); a.params[key] = m.url; } }
  } else if (a.mediaType === 'photo') {
    const fs = a.files.photos || [];
    const urls = (a.urls || []).filter((x) => /^https?:\/\//.test(x));
    if (!fs.length && !urls.length) throw new ApiError(400, 'photos[] is required (files or public URLs)', 'missing_photos');
    for (const f of fs) media.push(await storeFile(a.user.id, f, id));
    for (const u of urls) media.push(await storeUrl(a.user.id, u, id));
    const bad = media.find((m) => !['photo', 'video'].includes(m.kind));
    if (bad) throw new ApiError(400, `Unsupported file in photos[]: ${bad.filename}`, 'invalid_media');
    if (media.some((m) => m.kind === 'video') && !platforms.every((p) => ['instagram', 'threads'].includes(p))) throw new ApiError(400, 'Mixed photo + video carousels are only supported on Instagram and Threads', 'invalid_media');
  } else if (a.mediaType === 'document') {
    const f = a.files.document?.[0]; const u = typeof a.params.document === 'string' ? a.params.document : null;
    if (!f && !u) throw new ApiError(400, 'document is required (PDF, PPT, PPTX, DOC, DOCX)', 'missing_document');
    media.push(f ? await storeFile(a.user.id, f, id) : await storeUrl(a.user.id, u!, id));
    if (media[0].kind !== 'document') throw new ApiError(400, 'Unsupported document type. Use PDF, PPT, PPTX, DOC or DOCX.', 'invalid_media');
    if (media[0].size > 100 * 1024 * 1024) throw new ApiError(400, 'Document exceeds 100 MB', 'file_too_large');
  }
  if (a.files.first_comment_media?.length) { const arr: string[] = []; for (const f of a.files.first_comment_media) arr.push((await storeFile(a.user.id, f, id)).url!); a.params.first_comment_media = arr; }

  const cleanParams = { ...a.params }; delete cleanParams.video; delete cleanParams.document; delete cleanParams.photos;
  const isAsync = !!a.asyncUpload || !!scheduledIso;
  const status = scheduledIso ? 'scheduled' : 'pending';
  run('INSERT INTO uploads (id, user_id, profile_id, profile_username, media_type, title, description, params_json, platforms_json, status, is_async, scheduled_date, created_at, dashboard, source, media_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    id, a.user.id, profile.id, profile.username, a.mediaType, a.title ?? null, a.description ?? null, json(cleanParams), json(platforms), status, isAsync ? 1 : 0, scheduledIso, now(), a.dashboard ? 1 : 0, a.source ?? null, json(media.map((m) => ({ id: m.id, kind: m.kind, filename: m.filename, size: m.size, mime: m.mime, width: m.width, height: m.height, url: m.url }))));
  bumpUsage(a.user.id, 'uploads', 1);
  logEvent(a.user.id, 'upload.created', { id, media_type: a.mediaType, platforms, scheduled: scheduledIso });
  const upload = get<UploadRow>('SELECT * FROM uploads WHERE id = ?', id)!;

  if (scheduledIso) {
    const jobId = newId('job_', 10);
    run('INSERT INTO scheduled_jobs (job_id, user_id, profile_id, upload_id, scheduled_date, status, created_at, queue_slot) VALUES (?,?,?,?,?,?,?,?)', jobId, a.user.id, profile.id, id, scheduledIso, 'pending', now(), a.addToQueue ? 1 : 0);
    run('UPDATE uploads SET job_id = ? WHERE id = ?', jobId, id);
    const body = a.addToQueue
      ? { success: true, job_id: jobId, scheduled_date: scheduledIso, queue_slot: queueSlot!.datetime_local, message: `Post added to the queue. It will be published on ${queueSlot!.datetime_local} (${queueSlot!.timezone}).` }
      : { success: true, job_id: jobId, scheduled_date: scheduledIso, message: 'Post scheduled successfully.' };
    return { status: 202, body, upload: { ...upload, job_id: jobId } };
  }
  if (a.asyncUpload) {
    setTimeout(() => processUpload(id).catch((e) => console.error('[publish]', e)), 10);
    return { status: 200, body: { success: true, message: 'Upload initiated successfully in background.', request_id: id, total_platforms: platforms.length }, upload };
  }
  // Synchronous: wait up to 59 s, then switch to async like the original API
  const result = await Promise.race([processUpload(id), new Promise<null>((r) => setTimeout(() => r(null), 59000))]);
  if (!result) { run('UPDATE uploads SET is_async = 1 WHERE id = ?', id); return { status: 200, body: { success: true, message: 'Upload is taking longer than 59s and continues in the background.', request_id: id, total_platforms: platforms.length }, upload }; }
  return { status: 200, body: { success: result.every((r) => r.success), request_id: id, results: Object.fromEntries(result.map((r) => [r.platform, resultView(r)])), usage: usageInfo(a.user) }, upload };
}

export function resultView(r: any) {
  const meta = parse(r.meta_json, {});
  return r.success ? { success: true, url: r.post_url, post_id: r.platform_post_id, publish_id: meta.publish_id, message: r.message, ...(r.changes_json && parse(r.changes_json, []).length ? { changes: parse(r.changes_json, []) } : {}) } : { success: false, error: r.message, error_code: r.error_code };
}
export function uploadStatus(upload: UploadRow) {
  const results = all<any>('SELECT * FROM upload_results WHERE upload_id = ? ORDER BY upload_timestamp', upload.id);
  const platforms = parse<string[]>(upload.platforms_json, []);
  const status = upload.status === 'scheduled' ? 'pending' : results.length === 0 ? (upload.status === 'processing' ? 'in_progress' : 'pending') : results.length < platforms.length ? 'in_progress' : 'completed';
  return { request_id: upload.id, job_id: upload.job_id, status, completed: results.length, total: platforms.length, results: results.map((r) => ({ platform: r.platform, success: !!r.success, message: r.success ? r.message : r.message, url: r.post_url, post_id: r.platform_post_id, error_code: r.error_code, upload_timestamp: r.upload_timestamp })), last_update: results[results.length - 1]?.upload_timestamp ?? upload.created_at, scheduled_date: upload.scheduled_date };
}
