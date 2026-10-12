import type { APIContext } from 'astro';
import { authenticateApiRequest, workspaceOwner } from './auth';
import type { UserRow } from './db';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra: Record<string, any> = {}) { super(message); }
}

export const json = (data: any, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...headers } });

export const err = (status: number, message: string, code?: string, extra: Record<string, any> = {}) =>
  json({ success: false, message, error: message, ...(code ? { error_code: code } : {}), ...extra }, status);

export function handleError(e: unknown): Response {
  if (e instanceof ApiError) return err(e.status, e.message, e.code, e.extra);
  console.error('[api]', e);
  return err(500, (e as Error)?.message || 'Internal server error', 'internal_error');
}

/** Wrap an endpoint so thrown ApiErrors become proper JSON responses. */
export const route = (fn: (ctx: APIContext) => Promise<Response> | Response) => async (ctx: APIContext) => {
  if (ctx.request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' } });
  try { return await fn(ctx); } catch (e) { return handleError(e); }
};

/** Authenticate via API key header, or via the dashboard session cookie. Returns the workspace owner. */
export function requireUser(ctx: APIContext): { user: UserRow; actor: UserRow; via: 'apikey' | 'bearer' | 'session' } {
  const api = authenticateApiRequest(ctx.request);
  if (api) return { user: workspaceOwner(api.user), actor: api.user, via: api.scheme };
  if (ctx.locals.user) return { user: workspaceOwner(ctx.locals.user), actor: ctx.locals.user, via: 'session' };
  throw new ApiError(401, 'Unauthorized: provide a valid API key in the Authorization header (Apikey YOUR_API_KEY)', 'unauthorized');
}

/** Parse JSON, form-urlencoded or multipart bodies into one flat object. Arrays keep repeated keys and "key[]" suffixes. */
export async function readBody(request: Request): Promise<{ fields: Record<string, any>; files: Record<string, File[]> }> {
  const ct = request.headers.get('content-type') || '';
  const fields: Record<string, any> = {}; const files: Record<string, File[]> = {};
  if (ct.includes('application/json')) {
    const data = await request.json().catch(() => ({}));
    if (data && typeof data === 'object') Object.assign(fields, data);
    return { fields, files };
  }
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const fd = await request.formData();
    for (const [rawKey, value] of fd.entries()) {
      const isArr = rawKey.endsWith('[]');
      const key = isArr ? rawKey.slice(0, -2) : rawKey;
      if (typeof value !== 'string') {
        if (value.size === 0 && !value.name) continue;
        (files[key] ||= []).push(value);
        continue;
      }
      if (isArr || key in fields) {
        const prev = fields[key];
        fields[key] = prev === undefined ? [value] : Array.isArray(prev) ? [...prev, value] : [prev, value];
      } else fields[key] = value;
    }
    return { fields, files };
  }
  // Fallback: query string for GET-style bodies
  return { fields, files };
}

export const str = (v: any): string | undefined => (v === undefined || v === null ? undefined : Array.isArray(v) ? String(v[0]) : String(v));
export const bool = (v: any, def = false): boolean => { const s = str(v); if (s === undefined || s === '') return def; return ['true', '1', 'yes', 'on'].includes(s.toLowerCase()); };
export const int = (v: any, def?: number): number | undefined => { const s = str(v); if (s === undefined || s === '') return def; const n = parseInt(s, 10); return Number.isFinite(n) ? n : def; };
export const list = (v: any): string[] => v === undefined || v === null ? [] : Array.isArray(v) ? v.flatMap((x) => String(x).split(',')).map((s) => s.trim()).filter(Boolean) : String(v).split(',').map((s) => s.trim()).filter(Boolean);
export function oneOf<T extends string>(v: any, allowed: readonly T[], field: string, def?: T): T | undefined {
  const s = str(v); if (s === undefined || s === '') return def;
  if (!(allowed as readonly string[]).includes(s)) throw new ApiError(400, `Invalid value for ${field}: '${s}'. Allowed: ${allowed.join(', ')}`, 'invalid_parameter');
  return s as T;
}
export function required(v: any, field: string): string { const s = str(v); if (s === undefined || s === '') throw new ApiError(400, `Missing required parameter: ${field}`, 'missing_parameter'); return s; }

export function isoDate(v: any, field: string): string | undefined {
  const s = str(v); if (!s) return undefined;
  const d = new Date(s); if (Number.isNaN(d.getTime())) throw new ApiError(400, `Invalid ISO-8601 date for ${field}: ${s}`, 'invalid_date');
  return d.toISOString();
}

export function clientIp(ctx: APIContext) { return ctx.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || ctx.clientAddress || null; }
export const paginate = (page?: number, limit?: number) => { const p = Math.max(1, page || 1); const l = Math.min(200, Math.max(1, limit || 10)); return { page: p, limit: l, offset: (p - 1) * l }; };
