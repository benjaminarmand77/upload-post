import { route, json } from '../../../server/api';
import { landingStats } from '../../../server/analytics';
export const GET = route(async () => json(landingStats(), 200, { 'cache-control': 'public, max-age=300' }));
