import { route, requireUser, json, err, readBody, str, list, bool } from '../../../../../server/api';
import { createFfmpegJob } from '../../../../../server/ffmpeg';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields, files } = await readBody(ctx.request);
  const fs = [files.file?.[0], files.file1?.[0], files.file2?.[0], ...(files.files || [])].filter(Boolean) as File[];
  const urls = list(fields.files); const cmd = str(fields.full_command); const ext = str(fields.output_extension);
  if (!cmd || !ext) return err(400, 'full_command and output_extension are required', 'missing_parameter');
  return json(await createFfmpegJob(user, { files: fs, urls, full_command: cmd, output_extension: ext, publish: bool(fields.publish) }), 202);
});
