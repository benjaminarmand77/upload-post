import { route } from '../../server/api';
import { uploadEndpoint } from '../../server/api-upload';
export const POST = route(uploadEndpoint('video'));
export const OPTIONS = POST;
