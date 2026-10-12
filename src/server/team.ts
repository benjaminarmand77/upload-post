import { randomBytes } from 'node:crypto';
import { all, get, run, newId, now, logEvent, type UserRow } from './db';
import { limitsOf } from './plans';
import { ApiError } from './api';
import { findUserByEmail, createUser } from './auth';

export function listMembers(ownerId: string) { return all<any>('SELECT m.*, u.name, u.last_login_at FROM team_members m LEFT JOIN users u ON u.id = m.member_user_id WHERE m.owner_user_id = ? ORDER BY m.invited_at', ownerId); }
export function inviteMember(owner: UserRow, email: string, role: 'member' | 'admin' = 'member') {
  const e = email.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ApiError(400, 'Invalid email', 'invalid_email');
  if (e === owner.email) throw new ApiError(400, 'You are already the owner', 'invalid_email');
  const seats = limitsOf(owner).seats; const used = 1 + listMembers(owner.id).length;
  if (used >= seats) throw new ApiError(403, `Seat limit reached (${seats} seats on the ${owner.plan} plan)`, 'seat_limit_reached');
  if (get('SELECT 1 FROM team_members WHERE owner_user_id = ? AND email = ?', owner.id, e)) throw new ApiError(409, 'Already invited', 'already_invited');
  const token = randomBytes(16).toString('base64url');
  run('INSERT INTO team_members (id, owner_user_id, email, role, invited_at, token) VALUES (?,?,?,?,?,?)', newId('tm_'), owner.id, e, role, now(), token);
  logEvent(owner.id, 'team.invited', { email: e, role });
  return token;
}
export function acceptInvite(token: string, user: UserRow) {
  const m = get<any>('SELECT * FROM team_members WHERE token = ? AND accepted_at IS NULL', token); if (!m) return false;
  if (m.email !== user.email) throw new ApiError(403, `This invitation was sent to ${m.email}`, 'wrong_account');
  run('UPDATE team_members SET member_user_id = ?, accepted_at = ?, token = NULL WHERE id = ?', user.id, now(), m.id);
  run('UPDATE users SET owner_user_id = ?, role = ? WHERE id = ?', m.owner_user_id, m.role, user.id);
  logEvent(m.owner_user_id, 'team.joined', { email: user.email });
  return true;
}
export function removeMember(ownerId: string, id: string) {
  const m = get<any>('SELECT * FROM team_members WHERE id = ? AND owner_user_id = ?', id, ownerId); if (!m) return;
  if (m.member_user_id) run('UPDATE users SET owner_user_id = NULL, role = \'owner\' WHERE id = ?', m.member_user_id);
  run('DELETE FROM team_members WHERE id = ?', id); logEvent(ownerId, 'team.removed', { email: m.email });
}
