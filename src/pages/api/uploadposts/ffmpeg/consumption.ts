import { route, requireUser, json } from '../../../../server/api';
import { ffmpegConsumption } from '../../../../server/ffmpeg';
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); return json(ffmpegConsumption(user)); });
