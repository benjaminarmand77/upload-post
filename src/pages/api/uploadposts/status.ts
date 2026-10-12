import { route, requireUser, json, err } from '../../../server/api';
import { get, type UploadRow } from '../../../server/db';
import { uploadStatus } from '../../../server/uploads';
export const GET = route(async (ctx) => {
  const { user } = requireUser(ctx);
  const rid = ctx.url.searchParams.get('request_id'); const jid = ctx.url.searchParams.get('job_id');
  if (!rid && !jid) return err(400, 'Provide request_id or job_id', 'missing_parameter');
  const up = rid ? get<UploadRow>('SELECT * FROM uploads WHERE id = ? AND user_id = ?', rid, user.id) : get<UploadRow>('SELECT * FROM uploads WHERE job_id = ? AND user_id = ?', jid, user.id);
  if (!up) return err(404, 'No upload found for the given identifier', 'not_found');
  return json(uploadStatus(up));
});
