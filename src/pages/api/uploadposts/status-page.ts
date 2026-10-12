import { route, json } from '../../../server/api';
import { PLATFORMS } from '../../../lib/platforms';
import { all, get } from '../../../server/db';
import { providerSummary } from '../../../server/providers';
export const GET = route(async () => {
  const incidents = all<any>('SELECT * FROM status_incidents WHERE resolved_at IS NULL');
  const summary = providerSummary();
  const platforms = PLATFORMS.map((p) => { const inc = incidents.find((i) => i.platform === p.key); const s = summary.find((x) => x.key === p.key)!; return { key: p.key, name: p.name, status: inc ? inc.status : 'operational', incident: inc ? { title: inc.title, body: inc.body, since: inc.created_at } : null, mode: s.sandbox ? 'sandbox' : 'live' }; });
  const recent = all<any>("SELECT * FROM status_incidents ORDER BY created_at DESC LIMIT 20");
  const okRate = get<any>("SELECT SUM(success) AS ok, COUNT(*) AS n FROM upload_results WHERE upload_timestamp >= datetime('now','-1 day')");
  return json({ success: true, overall: incidents.length ? (incidents.some((i) => i.status === 'outage') ? 'outage' : 'degraded') : 'operational', platforms, incidents: recent, api: { status: 'operational', success_rate_24h: okRate?.n ? Math.round((okRate.ok / okRate.n) * 1000) / 10 : 100, checked_at: new Date().toISOString() } }, 200, { 'cache-control': 'public, max-age=60' });
});
