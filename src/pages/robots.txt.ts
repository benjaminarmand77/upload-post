import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ url }) => new Response(`User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /api/\nDisallow: /connect\nDisallow: /uploads/\n\nSitemap: ${(process.env.SITE_URL || url.origin).replace(/\/$/, '')}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
