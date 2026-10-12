import { route } from '../../server/api';
import { uploadEndpoint } from '../../server/api-upload';
export const POST = route(uploadEndpoint('text'));
export const OPTIONS = POST;
