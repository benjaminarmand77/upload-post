/**
 * Billing (demo mode). Plan changes apply instantly and nothing is charged.
 * To bill for real, create a Stripe Checkout session here and update the user in the webhook handler.
 */
import { run, get, newId, now, logEvent, type UserRow } from './db';
import { PLAN_KEYS, PLAN_LIMITS, type PlanKey } from '../lib/pricing';
import { ApiError } from './api';

export function changePlan(user: UserRow, plan: string, cycle: 'monthly' | 'yearly', currency: 'usd' | 'eur') {
  if (!PLAN_KEYS.includes(plan as PlanKey)) throw new ApiError(400, 'Unknown plan', 'invalid_plan');
  const renews = plan === 'free' ? null : new Date(Date.now() + (cycle === 'yearly' ? 365 : 30) * 86400000).toISOString();
  run('UPDATE users SET plan = ?, billing_cycle = ?, currency = ?, plan_renews_at = ?, extra_profiles = CASE WHEN ? = \'free\' THEN 0 ELSE extra_profiles END, x_links_addon = CASE WHEN ? = \'free\' THEN 0 ELSE x_links_addon END WHERE id = ?', plan, cycle, currency, renews, plan, plan, user.id);
  logEvent(user.id, 'plan.changed', { from: user.plan, to: plan, cycle, currency });
}
export function setAddons(user: UserRow, a: { extra_profiles?: number; x_links_addon?: boolean }) {
  if (user.plan === 'free') throw new ApiError(403, 'Add-ons require a paid plan', 'plan_upgrade_required');
  if (a.extra_profiles !== undefined) run('UPDATE users SET extra_profiles = ? WHERE id = ?', Math.max(0, Math.min(500, a.extra_profiles | 0)), user.id);
  if (a.x_links_addon !== undefined) run('UPDATE users SET x_links_addon = ? WHERE id = ?', a.x_links_addon ? 1 : 0, user.id);
  logEvent(user.id, 'addons.changed', a);
}
export const planOrder = (p: string) => PLAN_LIMITS[(p in PLAN_LIMITS ? p : 'free') as PlanKey].order;
