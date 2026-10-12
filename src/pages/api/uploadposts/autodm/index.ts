import { route, requireUser, json, err, readBody, str, list, oneOf } from '../../../../server/api';
import { getProfile, accountFor } from '../../../../server/uploads';
import { all, get, run, newId, now, json as J, parse } from '../../../../server/db';
const view = (m: any) => ({ monitor_id: m.id, platform: m.platform, profile_username: m.profile_username, post_id: m.post_id, keywords: parse(m.keywords_json, []), message: m.message, status: m.status, created_at: m.created_at, expires_at: m.expires_at, sent_count: m.sent_count });
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); const includeAll = ctx.url.searchParams.get('all') === 'true'; const rows = all<any>(`SELECT * FROM autodm_monitors WHERE user_id = ? ${includeAll ? '' : "AND status = 'active'"} ORDER BY created_at DESC`, user.id); return json({ success: true, monitors: rows.map(view) }); });
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const action = str(fields.action);
  if (action && ['pause', 'resume', 'stop', 'delete'].includes(action)) {
    const id = str(fields.monitor_id); const m = get<any>('SELECT * FROM autodm_monitors WHERE id = ? AND user_id = ?', id, user.id); if (!m) return err(404, 'Monitor not found', 'not_found');
    if (action === 'delete') run('DELETE FROM autodm_monitors WHERE id = ?', m.id); else run('UPDATE autodm_monitors SET status = ? WHERE id = ?', action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'stopped', m.id);
    return json({ success: true, monitor_id: m.id, status: action === 'delete' ? 'deleted' : action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'stopped' });
  }
  if (action === 'logs') { const id = str(fields.monitor_id); const m = get<any>('SELECT * FROM autodm_monitors WHERE id = ? AND user_id = ?', id, user.id); if (!m) return err(404, 'Monitor not found', 'not_found'); return json({ success: true, monitor_id: m.id, logs: parse(m.logs_json, []) }); }
  const platform = oneOf(fields.platform, ['instagram'] as const, 'platform', 'instagram')!; const u = str(fields.user); const postId = str(fields.post_id); const keywords = list(fields.keywords); const message = str(fields.message);
  if (!u || !postId || !keywords.length || !message) return err(400, 'user, post_id, keywords and message are required', 'missing_parameter');
  const p = getProfile(user.id, u); if (!p) return err(404, 'Profile not found', 'profile_not_found'); if (!accountFor(p.id, platform)) return err(400, 'No Instagram account connected', 'account_not_connected');
  const active = get<any>("SELECT COUNT(*) AS c FROM autodm_monitors WHERE user_id = ? AND status = 'active'", user.id)?.c || 0; if (active >= 10) return err(429, 'Maximum of 10 active monitors', 'limit_reached');
  const id = newId('mon_'); run('INSERT INTO autodm_monitors (id, user_id, profile_username, platform, post_id, keywords_json, message, status, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, user.id, p.username, platform, postId, J(keywords), message, 'active', now(), new Date(Date.now() + 30 * 86400000).toISOString());
  return json({ success: true, monitor: view(get('SELECT * FROM autodm_monitors WHERE id = ?', id)) }, 201);
});
