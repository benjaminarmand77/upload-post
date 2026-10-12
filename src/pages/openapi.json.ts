import type { APIRoute } from 'astro';
import { openApi } from '../lib/content/api-registry';
export const GET: APIRoute = ({ url }) => new Response(JSON.stringify(openApi((process.env.SITE_URL || url.origin).replace(/\/$/, '')), null, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' } });
