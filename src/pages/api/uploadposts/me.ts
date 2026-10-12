import { route, requireUser, json } from '../../../server/api';
import { limitsOf, usageOf } from '../../../server/plans';
export const GET = route(async (ctx) => {
  const { user, via } = requireUser(ctx); const l = limitsOf(user); const u = usageOf(user.id);
  return json({ success: true, message: 'API key is valid', email: user.email, plan: user.plan, name: user.name, auth: via, limits: { uploads: l.uploads, profiles: l.profiles, ffmpeg_minutes: l.ffmpegMinutes, ai_shorts: l.aiShorts, seats: l.seats, whitelabel: l.whitelabel }, usage: { uploads: u.uploads, ffmpeg_minutes: u.ffmpeg_minutes, ai_shorts: u.ai_shorts, month: u.month } });
});
