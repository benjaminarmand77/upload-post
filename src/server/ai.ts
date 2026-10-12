/** AI Shorts Uploader: caption generation per platform (Claude API when configured, heuristic otherwise). */
import { limitsOf, usageOf, bumpUsage } from './plans';
import { ApiError } from './api';
import { run, newId, now, json, type UserRow } from './db';
import { hashtagsFrom } from './providers/real/_shared';

export interface ShortsAnalysis { summary: string; topics: string[]; language: string; platforms: Record<'youtube' | 'instagram' | 'tiktok', { title: string; description: string; hashtags: string[] }> }
const PLATFORM_HINTS = { youtube: 'YouTube Shorts: title ≤ 70 chars, searchable, description 1-2 sentences + 3-5 hashtags', instagram: 'Instagram Reels: hooky first line, friendly caption, 5-10 hashtags', tiktok: 'TikTok: short punchy caption ≤ 150 chars with 3-5 trending hashtags' };

export async function analyzeShorts(user: UserRow, input: { filename?: string; title?: string; description?: string; transcript?: string; language?: string; duration?: number }): Promise<ShortsAnalysis> {
  const l = limitsOf(user); const u = usageOf(user.id);
  if (u.ai_shorts >= l.aiShorts) throw new ApiError(429, `AI Shorts quota exhausted (${l.aiShorts} analyses/month on the ${user.plan} plan)`, 'ai_quota_exceeded');
  const lang = input.language || 'en';
  let result: ShortsAnalysis | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const prompt = `You write social media captions. Context about a short vertical video:\nFilename: ${input.filename || ''}\nTitle: ${input.title || ''}\nDescription: ${input.description || ''}\nTranscript: ${(input.transcript || '').slice(0, 4000)}\nDuration: ${input.duration || '?'}s\nLanguage for output: ${lang}\n\nReturn ONLY JSON: {"summary": string, "topics": string[], "language": string, "platforms": {"youtube": {"title","description","hashtags": string[]}, "instagram": {...}, "tiktok": {...}}}.\nRules: ${Object.values(PLATFORM_HINTS).join('; ')}.`;
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }) });
      const d = await r.json(); const text = d.content?.[0]?.text || ''; const m = text.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]);
    } catch (e) { console.error('[ai] claude failed, falling back', e); }
  }
  if (!result) result = heuristic(input, lang);
  bumpUsage(user.id, 'ai_shorts', 1);
  run('INSERT INTO ai_jobs (id, user_id, kind, input_json, output_json, created_at) VALUES (?,?,?,?,?,?)', newId('ai_'), user.id, 'analyze-shorts', json(input), json(result), now());
  return result;
}
export async function rewriteCaptions(user: UserRow, captions: ShortsAnalysis['platforms'], language: string) {
  const l = limitsOf(user); const u = usageOf(user.id);
  if (u.ai_shorts >= l.aiShorts) throw new ApiError(429, 'AI Shorts quota exhausted', 'ai_quota_exceeded');
  let out: ShortsAnalysis['platforms'] | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 1200, messages: [{ role: 'user', content: `Translate and adapt these social captions into language "${language}" keeping hashtags relevant. Return ONLY the same JSON structure.\n${JSON.stringify(captions)}` }] }) });
      const d = await r.json(); const m = (d.content?.[0]?.text || '').match(/\{[\s\S]*\}/); if (m) out = JSON.parse(m[0]);
    } catch {}
  }
  if (!out) out = captions;
  bumpUsage(user.id, 'ai_shorts', 1);
  run('INSERT INTO ai_jobs (id, user_id, kind, input_json, output_json, created_at) VALUES (?,?,?,?,?,?)', newId('ai_'), user.id, 'rewrite-captions', json({ captions, language }), json(out), now());
  return out;
}
function heuristic(input: { filename?: string; title?: string; description?: string; transcript?: string }, lang: string): ShortsAnalysis {
  const base = (input.title || input.filename?.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ') || 'My video').trim();
  const text = [input.description, input.transcript].filter(Boolean).join(' ');
  const words = (text + ' ' + base).toLowerCase().match(/[\p{L}]{5,}/gu) || [];
  const freq: Record<string, number> = {}; for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const topics = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  const tags = [...new Set([...hashtagsFrom(text), ...topics.map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')), 'shorts', 'viral', 'fyp'])].slice(0, 8);
  const cap = base.charAt(0).toUpperCase() + base.slice(1);
  const fr = lang.startsWith('fr');
  return { summary: fr ? `Vidéo courte : ${cap}.` : `Short video about ${cap}.`, topics, language: lang, platforms: {
    youtube: { title: cap.slice(0, 70), description: (input.description || (fr ? `Dans cette vidéo : ${cap}.` : `In this video: ${cap}.`)) + '\n\n' + tags.slice(0, 5).map((t) => '#' + t).join(' '), hashtags: tags.slice(0, 5) },
    instagram: { title: cap.slice(0, 120), description: `${fr ? '✨ ' : '✨ '}${cap}\n\n${input.description || (fr ? 'Dites-moi ce que vous en pensez en commentaire 👇' : 'Tell me what you think in the comments 👇')}\n\n${tags.map((t) => '#' + t).join(' ')}`, hashtags: tags },
    tiktok: { title: `${cap.slice(0, 100)} ${tags.slice(0, 4).map((t) => '#' + t).join(' ')}`.slice(0, 150), description: cap, hashtags: tags.slice(0, 4) },
  } };
}
