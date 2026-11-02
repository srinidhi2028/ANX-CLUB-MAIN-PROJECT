jest.mock('@/lib/payments/auth', () => ({ authenticatePaymentRequest: jest.fn() }));
jest.mock('@/lib/payments/razorpay', () => ({
  verifyRazorpaySignature: jest.fn(() => true),
  fetchRazorpayOrder: jest.fn(),
  fetchRazorpayPayment: jest.fn(),
}));
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

import { POST } from '@/app/api/v1/payments/verify/route';
import { authenticatePaymentRequest } from '@/lib/payments/auth';
import { fetchRazorpayOrder, fetchRazorpayPayment } from '@/lib/payments/razorpay';
import { adminDb } from '@/lib/firebase/admin';

function postVerification() {
  return new Request('https://example.test/api/v1/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: 'order_test_dummy',
      razorpay_payment_id: 'pay_test_dummy',
      razorpay_signature: 'test-signature',
    }),
  });
}

describe('idempotent membership payment fulfillment', () => {
  const paymentData = {
    userId: 'firebase-test-user',
    amount: 149,
    currency: 'INR',
    paymentType: 'membership',
    billingPeriod: 'monthly',
    status: 'pending',
  };
  const paymentRef = { get: jest.fn() };
  const membershipRef = { collection: jest.fn() };
  const userRef = {};
  const historyRef = {};
  const legacyQuery = {};
  let paymentSnapshot: any;
  let historySnapshot: any;
  let membershipSnapshot: any;
  let userSnapshot: any;
  let legacySnapshot: any;
  let transaction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2025-01-31T12:00:00.000Z'));
    Object.assign(paymentData, { amount: 149, billingPeriod: 'monthly' });
    (authenticatePaymentRequest as jest.Mock).mockResolvedValue('firebase-test-user');
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({ id: 'order_test_dummy', amount: 14900, currency: 'INR' });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: 'pay_test_dummy', order_id: 'order_test_dummy', amount: 14900, currency: 'INR', status: 'captured', captured: true,
    });

    paymentSnapshot = { exists: true, data: () => paymentData, ref: paymentRef };
    historySnapshot = { exists: false };
    membershipSnapshot = { exists: false, data: () => undefined };
    userSnapshot = { exists: true, data: () => ({}) };
    legacySnapshot = { empty: true, docs: [] };
    transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === paymentRef) return paymentSnapshot;
        if (ref === historyRef) return historySnapshot;
        if (ref === membershipRef) return membershipSnapshot;
        if (ref === userRef) return userSnapshot;
        if (ref === legacyQuery) return legacySnapshot;
        throw new Error('Unexpected transaction read');
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    (adminDb.runTransaction as jest.Mock).mockImplementation((callback) => callback(transaction));
    (membershipRef.collection as jest.Mock).mockReturnValue({ doc: jest.fn(() => historyRef) });
    (adminDb.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === 'payments') return { doc: jest.fn(() => paymentRef) };
      if (name === 'users') return { doc: jest.fn(() => userRef) };
      return {
        doc: jest.fn(() => membershipRef),
        where: jest.fn(() => ({ limit: jest.fn(() => legacyQuery) })),
      };
    });
    paymentRef.get.mockResolvedValue(paymentSnapshot);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('atomically writes the active projection, history term, profile and payment state', async () => {
    const response = await POST(postVerification() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, idempotent: false });
    const historyWrite = transaction.set.mock.calls.find(([ref]: [unknown]) => ref === historyRef)?.[1];
    const projectionWrite = transaction.set.mock.calls.find(([ref]: [unknown]) => ref === membershipRef)?.[1];
    const profileWrite = transaction.set.mock.calls.find(([ref]: [unknown]) => ref === userRef)?.[1];
    const paymentWrite = transaction.update.mock.calls.find(([ref]: [unknown]) => ref === paymentRef)?.[1];

    expect(historyWrite).toMatchObject({
      userId: 'firebase-test-user', tier: 'Premium', plan: 'monthly_149',
      status: 'active', startDate: '2025-01-31T12:00:00.000Z',
      endDate: '2025-02-28T12:00:00.000Z', expiresAt: '2025-02-28T12:00:00.000Z',
      amount: 149, currency: 'INR', orderId: 'order_test_dummy', razorpayPaymentId: 'pay_test_dummy',
    });
    expect(projectionWrite).toMatchObject({ tier: 'Premium', status: 'active', expiresAt: '2025-02-28T12:00:00.000Z' });
    expect(profileWrite).toMatchObject({ membershipType: 'premium', membershipExpiry: '2025-02-28T12:00:00.000Z', role: 'Premium Member' });
    expect(paymentWrite).toMatchObject({ status: 'paid', providerStatus: 'captured', fulfillmentStatus: 'completed', paymentId: 'pay_test_dummy' });
  });

  it('creates an annual term for ₹999 that expires one calendar year later', async () => {
    paymentData.amount = 999;
    paymentData.billingPeriod = 'annual';
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({ id: 'order_test_dummy', amount: 99900, currency: 'INR' });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: 'pay_test_dummy', order_id: 'order_test_dummy', amount: 99900, currency: 'INR', status: 'captured', captured: true,
    });

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(200);
    const historyWrite = transaction.set.mock.calls.find(([ref]: [unknown]) => ref === historyRef)?.[1];
    expect(historyWrite).toMatchObject({
      plan: 'annual_999', billingPeriod: 'annual', amount: 999,
      startDate: '2025-01-31T12:00:00.000Z', endDate: '2026-01-31T12:00:00.000Z',
    });
  });

  it('does not write or extend membership when the same order is verified again', async () => {
    historySnapshot = { exists: true, data: () => ({ orderId: 'order_test_dummy' }) };

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, idempotent: true });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('does not fulfill another captured order over an active membership', async () => {
    membershipSnapshot = {
      exists: true,
      data: () => ({ status: 'active', expiresAt: '2025-03-01T00:00:00.000Z' }),
    };

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, message: expect.stringContaining('already active') });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).toHaveBeenCalledWith(paymentRef, expect.objectContaining({
      status: 'paid', providerStatus: 'captured', fulfillmentStatus: 'retry_required',
    }));
  });
});
