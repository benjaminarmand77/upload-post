import { route, requireUser, json, err, readBody, str } from '../../../../server/api';
import { get, all, type UploadRow } from '../../../../server/db';
import { processUpload } from '../../../../server/publish';
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const rid = str(fields.request_id); const jid = str(fields.job_id);
  if (!rid && !jid) return err(400, 'Provide request_id or job_id', 'missing_parameter');
  const up = rid ? get<UploadRow>('SELECT * FROM uploads WHERE id = ? AND user_id = ?', rid, user.id) : get<UploadRow>('SELECT * FROM uploads WHERE job_id = ? AND user_id = ?', jid, user.id);
  if (!up) return err(404, 'No upload found for the given identifier', 'not_found');
  const failed = all<any>('SELECT platform FROM upload_results WHERE upload_id = ? AND success = 0', up.id).map((r) => r.platform);
  if (!failed.length) return err(409, 'Nothing to retry (no failed platforms)', 'nothing_to_retry');
  setTimeout(() => processUpload(up.id, failed).catch(() => {}), 10);
  return json({ success: true, request_id: up.id, message: `Retrying ${failed.length} failed platform(s): ${failed.join(', ')}`, platforms: failed });
});
