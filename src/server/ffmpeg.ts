import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { get, all, run, newId, now, json, parse, DATA_DIR, monthKey, type UserRow } from './db';
import { ApiError } from './api';
import { limitsOf, usageOf, bumpFfmpeg } from './plans';
import { storeFile, storeUrl, type StoredMedia } from './media';

const OUT_DIR = path.join(DATA_DIR, 'ffmpeg');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let ffmpegPath: string | null | undefined;
export function ffmpegAvailable(): string | null {
  if (ffmpegPath !== undefined) return ffmpegPath;
  const candidates = [process.env.FFMPEG_PATH, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].filter(Boolean) as string[];
  ffmpegPath = candidates.find((c) => existsSync(c)) || null;
  return ffmpegPath;
}
export function ffprobeDuration(file: string): Promise<number | null> {
  const ff = ffmpegAvailable(); if (!ff) return Promise.resolve(null);
  const probe = ff.replace(/ffmpeg$/, 'ffprobe');
  if (!existsSync(probe)) return Promise.resolve(null);
  return new Promise((resolve) => execFile(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], (e, out) => resolve(e ? null : parseFloat(out) || null)));
}

const FORBIDDEN = /(-i\s+\/|\$\(|`|;|&&|\|\||>|<|\bsh\b|\bbash\b|\bcurl\b|\bwget\b|\brm\b|file:|concat:)/i;

export async function createFfmpegJob(user: UserRow, args: { files: File[]; urls: string[]; full_command: string; output_extension: string; publish?: boolean }) {
  const cmd = args.full_command.trim();
  if (!/^ffmpeg\s/.test(cmd)) throw new ApiError(400, 'full_command must start with "ffmpeg"', 'invalid_command');
  if (!/\{output\}/.test(cmd)) throw new ApiError(400, 'full_command must contain the {output} placeholder', 'invalid_command');
  if (!/\{input\d*\}/.test(cmd)) throw new ApiError(400, 'full_command must reference {input} or {input0}', 'invalid_command');
  if (FORBIDDEN.test(cmd.replace(/\{input\d*\}|\{output\}/g, ''))) throw new ApiError(400, 'full_command contains disallowed tokens', 'invalid_command');
  const ext = args.output_extension.replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]{2,5}$/.test(ext)) throw new ApiError(400, 'Invalid output_extension', 'invalid_parameter');
  if (!args.files.length && !args.urls.length) throw new ApiError(400, 'Provide at least one input file (file, file1, file2) or files[] URLs', 'missing_input');
  const l = limitsOf(user); const u = usageOf(user.id);
  if (u.ffmpeg_minutes >= l.ffmpegMinutes) throw new ApiError(429, `FFmpeg quota exhausted (${l.ffmpegMinutes} min/month on the ${user.plan} plan)`, 'ffmpeg_quota_exceeded');
  const inputs: StoredMedia[] = [];
  for (const f of args.files) inputs.push(await storeFile(user.id, f));
  for (const url of args.urls) inputs.push(await storeUrl(user.id, url));
  const id = newId('ffj_', 10);
  run('INSERT INTO ffmpeg_jobs (job_id, user_id, status, full_command, output_extension, inputs_json, created_at, publish) VALUES (?,?,?,?,?,?,?,?)', id, user.id, 'PENDING', cmd, ext, json(inputs.map((i) => ({ id: i.id, path: i.path, filename: i.filename, size: i.size }))), now(), args.publish ? 1 : 0);
  setTimeout(() => runPendingFfmpegJobs().catch(() => {}), 50);
  return { success: true, job_id: id, status: 'PENDING' };
}

let busy = false;
export async function runPendingFfmpegJobs() {
  if (busy) return; busy = true;
  try {
    const jobs = all<any>("SELECT * FROM ffmpeg_jobs WHERE status = 'PENDING' ORDER BY created_at LIMIT 2");
    for (const j of jobs) await runJob(j);
  } finally { busy = false; }
}
async function runJob(j: any) {
  const ff = ffmpegAvailable();
  const inputs = parse<any[]>(j.inputs_json, []);
  const out = path.join(OUT_DIR, `${j.job_id}.${j.output_extension}`);
  run("UPDATE ffmpeg_jobs SET status = 'PROCESSING', started_at = ? WHERE job_id = ?", now(), j.job_id);
  if (!ff) { run("UPDATE ffmpeg_jobs SET status = 'ERROR', finished_at = ?, error = ? WHERE job_id = ?", now(), 'FFmpeg binary is not installed on this server. Install ffmpeg (brew install ffmpeg) or set FFMPEG_PATH.', j.job_id); return; }
  const duration = (await ffprobeDuration(inputs[0]?.path)) || 0;
  // Tokenize the template, substituting placeholders with real paths (never shell-interpreted)
  const tokens = tokenize(j.full_command).slice(1).map((t) => t.replace(/\{input\}/g, inputs[0]?.path || '').replace(/\{input(\d+)\}/g, (_, n) => inputs[Number(n)]?.path || '').replace(/\{output\}/g, out));
  const started = Date.now();
  const code: number = await new Promise((resolve) => {
    const p = spawn(ff, ['-hide_banner', '-nostdin', ...tokens], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errBuf = ''; p.stderr.on('data', (d) => { errBuf += d.toString(); if (errBuf.length > 20000) errBuf = errBuf.slice(-20000); });
    const timer = setTimeout(() => p.kill('SIGKILL'), 20 * 60 * 1000);
    p.on('close', (c) => { clearTimeout(timer); (p as any).errBuf = errBuf; resolve(c ?? 1); });
    (p as any).errBufRef = () => errBuf;
    p.on('error', () => resolve(1));
  });
  const minutes = Math.max(0.1, (duration || (Date.now() - started) / 1000) / 60);
  bumpFfmpeg(j.user_id, minutes);
  if (code === 0 && existsSync(out)) run("UPDATE ffmpeg_jobs SET status = 'FINISHED', finished_at = ?, output_path = ?, duration_seconds = ? WHERE job_id = ?", now(), out, duration || null, j.job_id);
  else run("UPDATE ffmpeg_jobs SET status = 'ERROR', finished_at = ?, error = ?, duration_seconds = ? WHERE job_id = ?", now(), `ffmpeg exited with code ${code}`, duration || null, j.job_id);
}
function tokenize(cmd: string): string[] {
  const out: string[] = []; let cur = ''; let q: string | null = null;
  for (const ch of cmd) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
export function getFfmpegJob(userId: string, jobId: string) { return get<any>('SELECT * FROM ffmpeg_jobs WHERE job_id = ? AND user_id = ?', jobId, userId); }
export function ffmpegConsumption(user: UserRow) {
  const l = limitsOf(user); const u = usageOf(user.id);
  const hist = all<any>("SELECT duration_seconds, created_at FROM ffmpeg_jobs WHERE user_id = ? AND status IN ('FINISHED','ERROR') ORDER BY created_at DESC LIMIT 100", user.id);
  const used = Math.round(u.ffmpeg_minutes * 100) / 100;
  const next = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString();
  return { success: true, consumption: { used_minutes: used, remaining_minutes: Math.max(0, l.ffmpegMinutes - used), quota_minutes: l.ffmpegMinutes, usage_percentage: Math.round((used / l.ffmpegMinutes) * 1000) / 10, total_requests: hist.length, current_month: monthKey(), plan: user.plan }, history: hist.map((h) => ({ duration_seconds: h.duration_seconds || 0, duration_minutes: Math.round(((h.duration_seconds || 0) / 60) * 100) / 100, timestamp: h.created_at, month: h.created_at.slice(0, 7), type: 'ffmpeg' })), quota_info: { plan: user.plan, quota_minutes: l.ffmpegMinutes, reset_day: 1, next_reset: next } };
}
export async function outputSize(p: string) { try { return (await stat(p)).size; } catch { return 0; } }
