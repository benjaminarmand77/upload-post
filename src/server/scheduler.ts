import { all, run, now, get } from './db';
import { processUpload } from './publish';
import { runPendingFfmpegJobs } from './ffmpeg';
import { snapshotAnalytics } from './analytics';

let started = false;
/** In-process scheduler: publishes due scheduled posts, runs FFmpeg jobs and refreshes analytics snapshots. */
export function startScheduler() {
  if (started) return; started = true;
  const tick = async () => {
    try {
      const due = all<any>("SELECT job_id, upload_id FROM scheduled_jobs WHERE status = 'pending' AND scheduled_date <= ? ORDER BY scheduled_date LIMIT 20", now());
      for (const j of due) {
        run("UPDATE scheduled_jobs SET status = 'running', attempts = attempts + 1 WHERE job_id = ?", j.job_id);
        run("UPDATE uploads SET status = 'pending' WHERE id = ? AND status = 'scheduled'", j.upload_id);
        processUpload(j.upload_id).catch((e) => { console.error('[scheduler]', e); run("UPDATE scheduled_jobs SET status = 'failed', error = ? WHERE job_id = ?", String(e?.message || e), j.job_id); });
      }
      await runPendingFfmpegJobs();
    } catch (e) { console.error('[scheduler tick]', e); }
  };
  setInterval(tick, 15000); setTimeout(tick, 2000);
  // Daily analytics snapshot (also once at boot if missing for today)
  const snap = () => { try { snapshotAnalytics(); } catch (e) { console.error('[analytics snapshot]', e); } };
  setTimeout(snap, 5000); setInterval(snap, 6 * 3600 * 1000);
  console.log('[scheduler] started');
}
