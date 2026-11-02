export type MembershipBillingPeriod = 'monthly' | 'annual';

/** Adds one calendar month or year in UTC, clamping dates at the target month's end. */
export function calculateMembershipExpiry(startAt: Date, billingPeriod: MembershipBillingPeriod): Date {
  if (!Number.isFinite(startAt.getTime())) {
    throw new Error('Invalid membership start date');
  }
  if (billingPeriod !== 'monthly' && billingPeriod !== 'annual') {
    throw new Error('Unsupported membership billing period');
  }

  const monthsToAdd = billingPeriod === 'monthly' ? 1 : 12;
  const expiry = new Date(startAt);
  const dayOfMonth = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + monthsToAdd);

  const finalDayOfTargetMonth = new Date(Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  expiry.setUTCDate(Math.min(dayOfMonth, finalDayOfTargetMonth));
  return expiry;
}
