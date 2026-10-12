import { route, requireUser, json, err, readBody, str } from '../../../../server/api';
import { get, run, newId, now, logEvent } from '../../../../server/db';
import { listProfiles, profileView, getProfile } from '../../../../server/uploads';
import { assertProfileQuota, limitsOf } from '../../../../server/plans';
import { deleteProfile } from '../../../../server/connect';
export const GET = route(async (ctx) => { const { user } = requireUser(ctx); const l = limitsOf(user); return json({ success: true, limit: l.profiles, plan: user.plan, profiles: listProfiles(user.id).map(profileView) }); });
export const POST = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const username = (str(fields.username) || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._@+-]{0,63}$/.test(username)) return err(400, 'username must be 1-64 characters: letters, digits, . _ @ + -', 'invalid_username');
  if (getProfile(user.id, username)) return err(409, `A profile named '${username}' already exists`, 'profile_exists');
  assertProfileQuota(user, listProfiles(user.id).length);
  const id = newId('prf_'); run('INSERT INTO profiles (id, user_id, username, created_at) VALUES (?,?,?,?)', id, user.id, username, now());
  logEvent(user.id, 'profile.created', { username });
  return json({ success: true, profile: profileView(getProfile(user.id, username)!) }, 201);
});
export const DELETE = route(async (ctx) => {
  const { user } = requireUser(ctx); const { fields } = await readBody(ctx.request);
  const username = str(fields.username) || ctx.url.searchParams.get('username') || '';
  const p = getProfile(user.id, username); if (!p) return err(404, 'Profile not found', 'profile_not_found');
  await deleteProfile(p.id); logEvent(user.id, 'profile.deleted', { username });
  return json({ success: true, message: `Profile '${username}' deleted` });
});
