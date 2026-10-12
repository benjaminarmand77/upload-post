import type { APIRoute } from 'astro';
import { llmTxt } from '../lib/content/api-registry';
export const GET: APIRoute = ({ url }) => new Response(llmTxt((process.env.SITE_URL || url.origin).replace(/\/$/, '')), { headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' } });
