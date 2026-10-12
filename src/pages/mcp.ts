/**
 * Remote MCP server (Streamable HTTP, JSON-RPC 2.0). Tools map 1:1 to the REST API,
 * so any MCP client (Claude Desktop/Code, Cursor, ChatGPT…) can publish with an API key.
 */
import type { APIRoute } from 'astro';
import { ENDPOINTS } from '../lib/content/api-registry';
import { authenticateApiRequest } from '../server/auth';

const toolName = (m: string, p: string) => { const map: Record<string, string> = { 'POST /upload': 'upload_video', 'POST /upload_photos': 'upload_photos', 'POST /upload_text': 'upload_text', 'POST /upload_document': 'upload_document', 'GET /uploadposts/status': 'get_upload_status', 'GET /uploadposts/history': 'get_upload_history', 'GET /uploadposts/schedule': 'list_scheduled_posts', 'PATCH /uploadposts/schedule/{job_id}': 'edit_scheduled_post', 'DELETE /uploadposts/schedule/{job_id}': 'cancel_scheduled_post', 'POST /uploadposts/posts/retry': 'retry_upload', 'POST /uploadposts/posts/unpublish': 'unpublish_post', 'GET /uploadposts/queue/settings': 'get_queue_settings', 'POST /uploadposts/queue/settings': 'update_queue_settings', 'GET /uploadposts/queue/preview': 'preview_queue', 'GET /uploadposts/queue/next-slot': 'next_queue_slot', 'GET /analytics/{profile_username}': 'get_analytics', 'GET /uploadposts/post-analytics/cached': 'get_post_analytics', 'GET /uploadposts/media': 'list_media', 'GET /uploadposts/facebook/pages': 'get_facebook_pages', 'GET /uploadposts/linkedin/pages': 'get_linkedin_pages', 'GET /uploadposts/pinterest/boards': 'get_pinterest_boards', 'GET /uploadposts/tiktok/music/trending': 'tiktok_trending_music', 'GET /uploadposts/tiktok/music/search': 'search_tiktok_music', 'GET /uploadposts/tiktok/locations': 'search_tiktok_locations', 'GET /uploadposts/tiktok/settings': 'get_tiktok_settings', 'GET /uploadposts/audience': 'get_audience_insights', 'GET /uploadposts/suggestions': 'get_suggestions', 'GET /uploadposts/me': 'get_me', 'GET /uploadposts/users': 'list_profiles', 'POST /uploadposts/users': 'create_profile', 'DELETE /uploadposts/users': 'delete_profile', 'GET /uploadposts/users/{username}': 'get_profile', 'POST /uploadposts/users/generate-jwt': 'generate_connect_link', 'GET /uploadposts/users/validate-jwt': 'validate_connect_token', 'POST /uploadposts/users/notifications': 'configure_notifications', 'POST /uploadposts/ffmpeg/jobs/upload': 'create_ffmpeg_job', 'GET /uploadposts/ffmpeg/jobs/{job_id}': 'get_ffmpeg_job', 'GET /uploadposts/ffmpeg/jobs/{job_id}/download': 'download_ffmpeg_result', 'GET /uploadposts/ffmpeg/consumption': 'get_ffmpeg_consumption', 'GET /uploadposts/comments': 'list_comments', 'POST /uploadposts/comments/create': 'create_comment', 'DELETE /uploadposts/comments/delete': 'delete_comment', 'POST /uploadposts/comments/action': 'comment_action', 'POST /uploadposts/comments/reply': 'private_reply', 'GET /uploadposts/dms/conversations': 'list_dm_conversations', 'POST /uploadposts/dms/send': 'send_dm', 'POST /uploadposts/autodm': 'autodm_monitors', 'POST /uploadposts/analyze-shorts': 'analyze_shorts', 'POST /uploadposts/rewrite-captions': 'rewrite_captions', 'GET /uploadposts/preferences': 'get_preferences' }; return map[`${m} ${p}`] || (m.toLowerCase() + p.replace(/[^a-z0-9]+/gi, '_')); };

const TOOLS = ENDPOINTS.filter((e) => e.tag !== 'Public').map((e) => { const props: Record<string, any> = {}; const required: string[] = []; for (const p of e.params) { const name = p.name.replace(/\[\]$/, ''); props[name] = { type: p.type === 'integer' ? 'integer' : p.type === 'boolean' ? 'boolean' : p.type === 'array' || p.name.endsWith('[]') ? 'array' : p.type === 'object' ? 'object' : 'string', description: (p.in === 'file' ? '(public URL or local file path) ' : '') + p.desc, ...(p.enum ? { enum: p.enum } : {}), ...(p.type === 'array' || p.name.endsWith('[]') ? { items: { type: 'string' } } : {}) }; if (p.required) required.push(name); } return { name: toolName(e.method, e.path), description: `${e.summary}. ${e.desc}`, inputSchema: { type: 'object', properties: props, required }, _e: e }; });

async function callTool(name: string, args: Record<string, any>, auth: string, base: string) {
  const t = TOOLS.find((x) => x.name === name); if (!t) throw new Error(`Unknown tool ${name}`);
  const e = t._e; let path = e.path; const a = { ...args };
  for (const p of e.params.filter((x) => x.in === 'path')) { path = path.replace(`{${p.name}}`, encodeURIComponent(String(a[p.name] ?? ''))); delete a[p.name]; }
  const url = new URL(`${base}/api${path}`);
  if (e.method === 'GET') { for (const [k, v] of Object.entries(a)) if (v !== undefined && v !== null) url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v)); const r = await fetch(url, { headers: { authorization: auth } }); return r.json(); }
  const multipart = e.tag === 'Content Upload' || path.includes('ffmpeg/jobs/upload') || path.includes('analyze-shorts');
  if (multipart) { const fd = new FormData(); for (const [k, v] of Object.entries(a)) { if (v === undefined || v === null) continue; if (Array.isArray(v)) v.forEach((x) => fd.append(k === 'platform' || k === 'photos' || k === 'tags' ? `${k}[]` : k, String(x))); else fd.append(k, String(v)); } const r = await fetch(url, { method: e.method, headers: { authorization: auth }, body: fd }); return r.json(); }
  const r = await fetch(url, { method: e.method, headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(a) }); return r.json();
}

const rpc = (id: any, result?: any, error?: { code: number; message: string }) => ({ jsonrpc: '2.0', id, ...(error ? { error } : { result }) });
export const POST: APIRoute = async ({ request, url }) => {
  const base = (process.env.SITE_URL || url.origin).replace(/\/$/, '');
  const authHeader = request.headers.get('authorization') || '';
  let body: any; try { body = await request.json(); } catch { return new Response(JSON.stringify(rpc(null, undefined, { code: -32700, message: 'Parse error' })), { status: 400, headers: { 'content-type': 'application/json' } }); }
  const handle = async (msg: any) => {
    const { id, method, params } = msg;
    if (method === 'initialize') return rpc(id, { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'upload-post', version: '1.0.0' }, instructions: 'Upload-Post social media publishing. Every publishing tool needs a `user` (profile) and `platform` list. Media accepts public URLs. Use list_profiles first to discover connected platforms.' });
    if (method === 'notifications/initialized' || method === 'ping') return id === undefined ? null : rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS.map(({ _e, ...t }) => t) });
    if (method === 'tools/call') {
      if (!authenticateApiRequest(request)) return rpc(id, { content: [{ type: 'text', text: 'Unauthorized: send Authorization: Apikey YOUR_API_KEY' }], isError: true });
      try { const out = await callTool(params?.name, params?.arguments || {}, authHeader, base); return rpc(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: out && out.success === false }); }
      catch (e: any) { return rpc(id, { content: [{ type: 'text', text: e.message }], isError: true }); }
    }
    if (method === 'resources/list') return rpc(id, { resources: [{ uri: `${base}/llm.txt`, name: 'Upload-Post API documentation', mimeType: 'text/plain' }] });
    if (method === 'prompts/list') return rpc(id, { prompts: [] });
    return rpc(id, undefined, { code: -32601, message: `Method not found: ${method}` });
  };
  const result = Array.isArray(body) ? (await Promise.all(body.map(handle))).filter(Boolean) : await handle(body);
  if (result === null) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, mcp-session-id', 'mcp-session-id': 'stateless' } });
};
export const GET: APIRoute = ({ url }) => new Response(JSON.stringify({ name: 'upload-post', transport: 'streamable-http', endpoint: `${(process.env.SITE_URL || url.origin).replace(/\/$/, '')}/mcp`, tools: TOOLS.length, docs: '/docs/guides/mcp' }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, mcp-session-id', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
export const DELETE: APIRoute = () => new Response(null, { status: 204 });
