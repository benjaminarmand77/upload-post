import { route, requireUser, json } from '../../../../../server/api';
import { emitEvent } from '../../../../../server/webhooks';
export const POST = route(async (ctx) => { const { user } = requireUser(ctx); await emitEvent(user.id, 'upload_completed', { user_email: user.email, profile_username: 'default', platform: 'test', media_type: 'text', title: 'Webhook test', caption: null, request_id: 'req_test', job_id: null, result: { success: true, url: 'https://example.com/post/1', publish_id: 'test', post_id: '1' } }); return json({ success: true, message: 'Test event sent' }); });
