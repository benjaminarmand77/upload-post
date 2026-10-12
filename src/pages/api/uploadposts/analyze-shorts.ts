import { route, requireUser, json, readBody, str } from '../../../server/api';
import { analyzeShorts } from '../../../server/ai';
import { limitsOf, usageOf } from '../../../server/plans';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields, files } = await readBody(ctx.request);
  const f = files.video?.[0];
  const r = await analyzeShorts(user, { filename: f?.name || str(fields.filename), title: str(fields.title), description: str(fields.description), transcript: str(fields.transcript), language: str(fields.language), duration: Number(fields.duration) || undefined });
  const l = limitsOf(user); const u = usageOf(user.id);
  return json({ success: true, analysis: r, quota: { used: u.ai_shorts, limit: l.aiShorts } });
});
