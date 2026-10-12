import { pagesEndpoint } from '../../../../server/pages';
export const GET = pagesEndpoint('linkedin', 'pages', (acc, p) => [{ id: `urn:li:organization:${acc.account_id.slice(-8)}`, name: `${acc.display_name} Company`, picture: null, account_id: acc.account_id, vanityName: (acc.account_name || 'company').toLowerCase(), profile: p }]);
