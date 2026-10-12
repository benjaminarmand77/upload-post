import type { APIRoute } from 'astro';
export const GET: APIRoute = () => new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
