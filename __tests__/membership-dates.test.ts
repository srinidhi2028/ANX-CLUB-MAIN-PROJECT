import { calculateMembershipExpiry } from '@/lib/payments/membership-dates';

describe('membership expiry calendar calculation', () => {
  it.each([
    ['2025-01-31T12:00:00.000Z', 'monthly', '2025-02-28T12:00:00.000Z'],
    ['2024-01-31T12:00:00.000Z', 'monthly', '2024-02-29T12:00:00.000Z'],
    ['2024-02-29T12:00:00.000Z', 'annual', '2025-02-28T12:00:00.000Z'],
    ['2025-06-15T12:00:00.000Z', 'annual', '2026-06-15T12:00:00.000Z'],
  ] as const)('adds %s by the %s calendar period', (start, period, expected) => {
    expect(calculateMembershipExpiry(new Date(start), period).toISOString()).toBe(expected);
  });

  it('rejects invalid start dates and plans', () => {
    expect(() => calculateMembershipExpiry(new Date('invalid'), 'monthly')).toThrow('Invalid membership start date');
    expect(() => calculateMembershipExpiry(new Date(), 'quarterly' as never)).toThrow('Unsupported membership billing period');
  });
});
