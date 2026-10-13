import { get, all, run, newId, now, json, parse, logEvent, type UploadRow, type UploadResultRow } from './db';
import { mediaForUpload } from './media';
import { publishTo } from './providers';
import { emitEvent } from './webhooks';
import { sendMail } from './mailer';
import { bumpUsage } from './plans';
import { accountFor } from './uploads';
import type { PlatformKey } from '../lib/platforms';

const running = new Set<string>();

/** Publish an upload to every platform it targets (skipping platforms that already succeeded). */
export async function processUpload(uploadId: string, onlyPlatforms?: string[]): Promise<UploadResultRow[]> {
  if (running.has(uploadId)) { await waitFor(uploadId); return all<UploadResultRow>('SELECT * FROM upload_results WHERE upload_id = ?', uploadId); }
  running.add(uploadId);
  try {
    const upload = get<UploadRow>('SELECT * FROM uploads WHERE id = ?', uploadId);
    if (!upload) throw new Error('upload not found');
    run("UPDATE uploads SET status = 'processing', started_at = COALESCE(started_at, ?) WHERE id = ?", now(), uploadId);
    const params = parse<Record<string, any>>(upload.params_json, {});
    const platforms = parse<PlatformKey[]>(upload.platforms_json, []);
    const media = mediaForUpload(uploadId).map((m) => ({ id: m.id, kind: m.kind, filename: m.filename, path: m.path, size: m.size, mime: m.mime, width: m.width, height: m.height, duration: m.duration, url: `/uploads/${m.id}` }));
    const done = new Set(all<any>('SELECT platform FROM upload_results WHERE upload_id = ? AND success = 1', uploadId).map((r) => r.platform));
    const targets = platforms.filter((p) => !done.has(p) && (!onlyPlatforms || onlyPlatforms.includes(p)));
    const user = get<any>('SELECT * FROM users WHERE id = ?', upload.user_id);
    await Promise.all(targets.map(async (platform) => {
      run('DELETE FROM upload_results WHERE upload_id = ? AND platform = ? AND success = 0', uploadId, platform);
      const account = accountFor(upload.profile_id, platform);
      const title = params[`${platform}_title`] || upload.title || '';
      const description = params[`${platform}_description`] || params.description || upload.description || null;
      const firstComment = params[`${platform}_first_comment`] || params.first_comment || null;
      let res;
      if (!account) res = { success: false as const, error: `No ${platform} account connected to profile ${upload.profile_username}`, error_code: 'account_not_connected' };
      else if (account.status !== 'connected') res = { success: false as const, error: `${platform} account needs to be reconnected (${account.status})`, error_code: 'reauth_required' };
      else res = await publishTo({ account, upload, mediaType: upload.media_type, title, description, params: { ...params, __x_links_allowed: !!user?.x_links_addon }, media, firstComment });
      const rid = newId('res_');
      const ts = now();
      if (res.success) {
        run('INSERT INTO upload_results (id, upload_id, user_id, profile_username, platform, success, message, post_url, platform_post_id, upload_timestamp, media_type, media_size_bytes, video_was_transcoded, changes_json, meta_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          rid, uploadId, upload.user_id, upload.profile_username, platform, 1, res.message || 'Published', res.post_url, res.platform_post_id, ts, upload.media_type, media.reduce((s, m) => s + (m.size || 0), 0), res.changes?.includes('transcoded_h264_aac') ? 1 : 0, json(res.changes || []), json(res.meta || {}));
        if (platform === 'x' && /https?:\/\//.test(title)) bumpUsage(upload.user_id, 'x_link_posts', 1);
      } else {
        run('INSERT INTO upload_results (id, upload_id, user_id, profile_username, platform, success, message, upload_timestamp, error_code, media_type, media_size_bytes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          rid, uploadId, upload.user_id, upload.profile_username, platform, 0, res.error, ts, res.error_code || 'publish_failed', upload.media_type, media.reduce((s, m) => s + (m.size || 0), 0));
      }
      // TikTok drafts drop the caption: send it by email and/or Telegram so it can be pasted in the TikTok app
      if (platform === 'tiktok' && res.success && /inbox|draft/i.test(res.message || '')) {
        const caption = [title, description].filter(Boolean).join('\n\n');
        if (process.env.NOTIFY_EMAIL) sendMail({ to: process.env.NOTIFY_EMAIL, subject: `Légende TikTok à coller : ${(title || 'vidéo').slice(0, 60)}`, text: [caption, firstComment && `Premier commentaire : ${firstComment}`].filter(Boolean).join('\n\n') || '(aucun texte)' }).catch((e) => console.error('[mail]', e?.message || e));
        const tg = process.env.TELEGRAM_NOTIFY_BOT_TOKEN, chat = process.env.TELEGRAM_NOTIFY_CHAT_ID;
        if (tg && chat) {
          const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          // <code> blocks are copied with one tap in Telegram
          const text = `🎬 Brouillon TikTok prêt\n\nLégende (touche pour copier) :\n<code>${esc(caption || '(aucun texte)')}</code>${firstComment ? `\n\nPremier commentaire :\n<code>${esc(firstComment)}</code>` : ''}`;
          fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }) })
            .then(async (r) => { if (!r.ok) console.error('[telegram]', r.status, (await r.text()).slice(0, 200)); }).catch((e) => console.error('[telegram]', e?.message || e));
        }
      }
      emitEvent(upload.user_id, 'upload_completed', { user_email: user?.email, profile_username: upload.profile_username, platform, media_type: upload.media_type, title, caption: description, request_id: uploadId, job_id: upload.job_id, result: res.success ? { success: true, url: res.post_url, publish_id: res.meta?.publish_id, post_id: res.platform_post_id } : { success: false, error: res.error, error_code: res.error_code } }).catch(() => {});
    }));
    const results = all<UploadResultRow>('SELECT * FROM upload_results WHERE upload_id = ? ORDER BY upload_timestamp', uploadId);
    const okCount = results.filter((r) => r.success).length;
    const status = okCount === platforms.length ? 'completed' : okCount === 0 ? 'failed' : 'partial';
    run('UPDATE uploads SET status = ?, completed_at = ? WHERE id = ?', status, now(), uploadId);
    if (upload.job_id) run("UPDATE scheduled_jobs SET status = ?, run_at = ? WHERE job_id = ?", status === 'failed' ? 'failed' : 'done', now(), upload.job_id);
    logEvent(upload.user_id, 'upload.completed', { id: uploadId, status, platforms: results.map((r) => ({ p: r.platform, ok: !!r.success })) });
    return results;
  } finally { running.delete(uploadId); }
}
function waitFor(id: string) { return new Promise<void>((resolve) => { const t = setInterval(() => { if (!running.has(id)) { clearInterval(t); resolve(); } }, 200); }); }
export function isRunning(id: string) { return running.has(id); }
