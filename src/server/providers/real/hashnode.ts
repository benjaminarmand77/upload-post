import { registerProvider } from '../registry';
import { fail, ok, jsonFetch } from './_shared';
import type { CredentialsProvider } from '../types';
import { parse } from '../../db';

const gql = (token: string, query: string, variables: any) => jsonFetch('https://gql.hashnode.com', { method: 'POST', headers: { authorization: token, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) }).then((r) => { if (r.errors?.length) throw new Error(r.errors[0].message); return r.data; });
const hashnode: CredentialsProvider = {
  kind: 'credentials', key: 'hashnode', configured: () => true,
  async verify(c) {
    const d = await gql(c.access_token, `query($id: ObjectId!){ me { id username name profilePicture } publication(id:$id){ id title url } }`, { id: c.publication_id });
    if (!d.publication) throw new Error('Publication not found');
    return { account_id: d.me.id, account_name: d.me.username, display_name: d.publication.title, avatar_url: d.me.profilePicture || null, meta: { publication_url: d.publication.url } };
  },
  async publish(i) {
    const c = parse(i.account.credentials_json, {} as any);
    try {
      const d = await gql(c.access_token, `mutation($input: PublishPostInput!){ publishPost(input:$input){ post { id url slug } } }`, { input: { title: i.title, contentMarkdown: i.description || i.title, publicationId: c.publication_id, subtitle: i.params.subtitle || undefined, coverImageOptions: i.params.cover_url ? { coverImageURL: i.params.cover_url } : undefined, tags: i.params.tags ? String(i.params.tags).split(',').map((t) => ({ slug: t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: t.trim() })) : [] } });
      return ok({ post_url: d.publishPost.post.url, platform_post_id: d.publishPost.post.id, message: 'Published on Hashnode' });
    } catch (e: any) { return fail(`Hashnode: ${e.message}`, 'platform_error', true); }
  },
};
registerProvider(hashnode);
