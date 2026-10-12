import { route, requireUser, json, err, readBody, str } from '../../../server/api';
import { rewriteCaptions } from '../../../server/ai';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const captions = typeof fields.captions === 'string' ? JSON.parse(fields.captions) : fields.captions; const language = str(fields.language);
  if (!captions || !language) return err(400, 'captions and language are required', 'missing_parameter');
  return json({ success: true, captions: await rewriteCaptions(user, captions, language) });
});
