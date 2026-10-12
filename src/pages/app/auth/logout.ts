import type { APIRoute } from 'astro';
import { destroySession } from '../../../server/auth';
const out: APIRoute = (ctx) => { const sid = ctx.cookies.get('up_session')?.value; if (sid) destroySession(sid); ctx.cookies.delete('up_session', { path: '/' }); return ctx.redirect('/app/login?logged_out=1', 303); };
export const POST = out; export const GET = out;
