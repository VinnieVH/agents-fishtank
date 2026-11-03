import type { Quota } from '../shared/types';

export type { Quota } from '../shared/types';

export interface Credits {
  usedPct: number;    // 0..100, like VS Code's "80% used"
  left: number;       // credits left this period
  total: number;
  overage: number;
  unlimited: boolean;
  low: boolean;       // under 10% left
  gold: number;       // 0..1 in 5% steps: how full the treasure chest is
  gems: number;       // 0..5 precious stones in the chest: one per started 20% left
  reset: Date | null;
}

const parseDate = (text: string) => {
  const date = text ? new Date(text) : null;
  return date && !isNaN(+date) ? date : null;
};

export const credits = (quota: Quota | null | undefined): Credits | null => {
  if (!quota) return null;
  if (quota.unlimited) return { usedPct: 0, left: Infinity, total: Infinity, overage: 0, unlimited: true, low: false, gold: 1, gems: 5, reset: parseDate(quota.resetDate) };
  const remaining = Math.max(0, Math.min(100, quota.remainingPct));
  return {
    usedPct: 100 - remaining,
    left: Math.max(0, quota.entitlement - quota.used),
    total: quota.entitlement,
    overage: quota.overage || 0,
    unlimited: false,
    low: remaining < 10,
    gold: Math.ceil(remaining / 5) / 20, // any credits left still shows a few coins; only 0% is an empty chest
    gems: Math.ceil(remaining / 20),     // 81% used (19% left) -> 1 stone left
    reset: parseDate(quota.resetDate),
  };
};
