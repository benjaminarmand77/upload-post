/** Comments, DMs and AutoDM monitors. Real providers are used when configured; sandbox state lives in the DB. */
import { createHash } from 'node:crypto';
import { get, all, run, newId, now, json, parse, type SocialAccountRow } from './db';
import { ApiError } from './api';

const NAMES = ['maya.k', 'tomas_r', 'lena.codes', 'jorge88', 'aiko.v', 'sam_builds', 'nina.ds', 'leo.mtz', 'claire_b', 'yusuf.o', 'emma.travels', 'kai_dev'];
const TEXTS = ['Love this! 🔥', 'Where can I get this?', 'Tutorial please 🙏', 'This is so helpful, thanks', 'Amazing quality', 'First!', 'Can you do one on scheduling?', 'Followed for more', 'Does it work with n8n?', 'Saved this for later', 'Price?', 'Incredible 😍'];
const h = (s: string) => parseInt(createHash('md5').update(s).digest('hex').slice(0, 8), 16);

export function resolvePost(acc: SocialAccountRow, userId: string, postId?: string | null, postUrl?: string | null) {
  if (postId) return postId;
  if (postUrl) { const r = get<any>('SELECT platform_post_id FROM upload_results WHERE user_id = ? AND platform = ? AND post_url = ?', userId, acc.platform, postUrl); if (r) return r.platform_post_id; const m = postUrl.match(/(\d{8,}|[A-Za-z0-9_-]{8,})\/?$/); if (m) return m[1]; }
  throw new ApiError(400, 'post_id or post_url is required', 'missing_parameter');
}
/** Make sure a sandbox post has a few comments to show. */
function seedComments(acc: SocialAccountRow, postId: string) {
  if (get('SELECT 1 FROM comments_cache WHERE account_id = ? AND post_id = ? LIMIT 1', acc.id, postId)) return;
  const n = 3 + (h(postId) % 6);
  for (let i = 0; i < n; i++) { const k = h(postId + i); run('INSERT OR IGNORE INTO comments_cache (id, account_id, post_id, comment_id, parent_id, text, username, user_id, timestamp) VALUES (?,?,?,?,?,?,?,?,?)', newId('cm_'), acc.id, postId, `${postId.slice(-6)}${1000 + i}`, null, TEXTS[k % TEXTS.length], NAMES[k % NAMES.length], String(100000 + (k % 900000)), new Date(Date.now() - (i + 1) * 3600000 * (1 + (k % 20))).toISOString()); }
}
export function listComments(acc: SocialAccountRow, postId: string, parentId: string | null, limit: number, after: string | null) {
  seedComments(acc, postId);
  const rows = all<any>(`SELECT * FROM comments_cache WHERE account_id = ? AND post_id = ? AND ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'} ORDER BY timestamp DESC`, ...(parentId ? [acc.id, postId, parentId] : [acc.id, postId]));
  const start = after ? Math.max(0, parseInt(Buffer.from(after, 'base64url').toString(), 10) || 0) : 0;
  const page = rows.slice(start, start + limit);
  return { comments: page.map((c) => ({ id: c.comment_id, text: c.text, timestamp: c.timestamp, hidden: !!c.hidden, liked: !!c.liked, pinned: !!c.pinned, user: { id: c.user_id, username: c.username }, replies_count: get<any>('SELECT COUNT(*) AS c FROM comments_cache WHERE parent_id = ?', c.comment_id)?.c || 0 })), pagination: { next_cursor: start + limit < rows.length ? Buffer.from(String(start + limit)).toString('base64url') : null, has_next: start + limit < rows.length } };
}
export function createComment(acc: SocialAccountRow, opts: { postId?: string | null; commentId?: string | null; message: string }) {
  let postId = opts.postId;
  if (opts.commentId) { const parent = get<any>('SELECT * FROM comments_cache WHERE account_id = ? AND comment_id = ?', acc.id, opts.commentId); if (!parent) throw new ApiError(404, 'Comment not found', 'not_found'); postId = parent.post_id; }
  if (!postId) throw new ApiError(400, 'Provide exactly one of comment_id, post_id or post_url', 'missing_parameter');
  const id = `${postId.slice(-6)}${Date.now() % 1000000}`;
  run('INSERT INTO comments_cache (id, account_id, post_id, comment_id, parent_id, text, username, user_id, timestamp) VALUES (?,?,?,?,?,?,?,?,?)', newId('cm_'), acc.id, postId, id, opts.commentId ?? null, opts.message, acc.account_name, acc.account_id, now());
  return id;
}
export function deleteComment(acc: SocialAccountRow, commentId: string) { const r = run('DELETE FROM comments_cache WHERE account_id = ? AND comment_id = ?', acc.id, commentId); if (!r.changes) throw new ApiError(404, 'Comment not found', 'not_found'); }
export function commentAction(acc: SocialAccountRow, commentId: string, action: string) {
  const c = get<any>('SELECT * FROM comments_cache WHERE account_id = ? AND comment_id = ?', acc.id, commentId); if (!c) throw new ApiError(404, 'Comment not found', 'not_found');
  const map: Record<string, [string, number]> = { hide: ['hidden', 1], unhide: ['hidden', 0], like: ['liked', 1], unlike: ['liked', 0], pin: ['pinned', 1], unpin: ['pinned', 0] };
  const [col, v] = map[action]; run(`UPDATE comments_cache SET ${col} = ? WHERE id = ?`, v, c.id);
}
export function conversations(acc: SocialAccountRow) {
  const rows = all<any>('SELECT * FROM dm_conversations WHERE account_id = ? ORDER BY updated_at DESC', acc.id);
  if (!rows.length) { for (let i = 0; i < 4; i++) { const k = h(acc.id + i); const name = NAMES[k % NAMES.length]; run('INSERT INTO dm_conversations (id, account_id, participant_id, participant_name, messages_json, updated_at) VALUES (?,?,?,?,?,?)', `t_${h(acc.id + 'c' + i)}`, acc.id, String(200000 + (k % 700000)), name, json([{ id: `m_${k}`, from: name, message: TEXTS[(k + 3) % TEXTS.length], created_time: new Date(Date.now() - i * 7200000).toISOString() }]), new Date(Date.now() - i * 7200000).toISOString()); } return conversations(acc); }
  return rows.map((r) => ({ id: r.id, participants: { data: [{ id: r.participant_id, username: r.participant_name }, { id: acc.account_id, username: acc.account_name }] }, messages: { data: parse(r.messages_json, []) }, updated_time: r.updated_at }));
}
export function sendDm(acc: SocialAccountRow, recipientId: string, message: string, buttons?: { title: string; url: string }[]) {
  conversations(acc);
  let conv = get<any>('SELECT * FROM dm_conversations WHERE account_id = ? AND participant_id = ?', acc.id, recipientId);
  if (!conv) throw new ApiError(400, 'Recipient has not messaged this account in the last 24h (Meta messaging window policy)', 'outside_messaging_window');
  const msgs = parse<any[]>(conv.messages_json, []); const id = `m_${Date.now()}`;
  msgs.push({ id, from: acc.account_name, message, buttons, created_time: now() });
  run('UPDATE dm_conversations SET messages_json = ?, updated_at = ? WHERE id = ?', json(msgs), now(), conv.id);
  return { recipient_id: recipientId, message_id: id };
}
export function privateReply(acc: SocialAccountRow, commentId: string, message: string, buttons?: { title: string; url: string }[]) {
  const c = get<any>('SELECT * FROM comments_cache WHERE account_id = ? AND comment_id = ?', acc.id, commentId); if (!c) throw new ApiError(404, 'Comment not found', 'not_found');
  if (Date.now() - new Date(c.timestamp).getTime() > 7 * 86400000) throw new ApiError(400, 'Comment is older than 7 days', 'comment_too_old');
  conversations(acc);
  let conv = get<any>('SELECT * FROM dm_conversations WHERE account_id = ? AND participant_id = ?', acc.id, c.user_id);
  if (!conv) { run('INSERT INTO dm_conversations (id, account_id, participant_id, participant_name, messages_json, updated_at) VALUES (?,?,?,?,?,?)', `t_${h(acc.id + c.user_id)}`, acc.id, c.user_id, c.username, '[]', now()); conv = get<any>('SELECT * FROM dm_conversations WHERE account_id = ? AND participant_id = ?', acc.id, c.user_id); }
  const msgs = parse<any[]>(conv.messages_json, []); const id = `m_${Date.now()}`; msgs.push({ id, from: acc.account_name, message, buttons, private_reply_to: commentId, created_time: now() });
  run('UPDATE dm_conversations SET messages_json = ?, updated_at = ? WHERE id = ?', json(msgs), now(), conv.id);
  return { recipient_id: c.user_id, message_id: id };
}
