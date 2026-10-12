import { pagesEndpoint, sandboxPages } from '../../../../server/pages';
export const GET = pagesEndpoint('facebook', 'pages', (acc, p) => sandboxPages(acc, p, 'Page'));
