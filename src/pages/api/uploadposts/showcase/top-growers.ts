import { route, json } from '../../../../server/api';
import { topGrowers } from '../../../../server/analytics';
export const GET = route(async () => json(topGrowers(), 200, { 'cache-control': 'public, max-age=600' }));
