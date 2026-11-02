jest.mock('@/lib/payments/auth', () => ({
  authenticatePaymentRequest: jest.fn(),
}));
jest.mock('@/lib/payments/razorpay', () => ({
  verifyRazorpaySignature: jest.fn(() => true),
  fetchRazorpayOrder: jest.fn(),
  fetchRazorpayPayment: jest.fn(),
}));
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}));

import { POST } from '@/app/api/v1/payments/verify/route';
import { authenticatePaymentRequest } from '@/lib/payments/auth';
import { fetchRazorpayOrder, fetchRazorpayPayment, verifyRazorpaySignature } from '@/lib/payments/razorpay';
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

describe('provider-backed payment verification checks', () => {
  const paymentData = {
    userId: 'firebase-test-user',
    amount: 149,
    currency: 'INR',
    paymentType: 'membership',
    billingPeriod: 'monthly',
    status: 'pending',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (verifyRazorpaySignature as jest.Mock).mockReturnValue(true);
    (authenticatePaymentRequest as jest.Mock).mockResolvedValue('firebase-test-user');
    (adminDb.collection as jest.Mock).mockReturnValue({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: true, data: () => paymentData }),
      })),
    });
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: 'order_test_dummy', amount: 14900, currency: 'INR',
    });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: 'pay_test_dummy', order_id: 'order_test_dummy', amount: 14900, currency: 'INR', status: 'captured', captured: true,
    });
  });

  it('requires Firebase authentication before verifying a signature or calling Razorpay', async () => {
    (authenticatePaymentRequest as jest.Mock).mockResolvedValue(null);

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(401);
    expect(verifyRazorpaySignature).not.toHaveBeenCalled();
    expect(fetchRazorpayOrder).not.toHaveBeenCalled();
  });

  it('does not query provider payment details when the HMAC signature is invalid', async () => {
    (verifyRazorpaySignature as jest.Mock).mockReturnValue(false);

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(400);
    expect(fetchRazorpayOrder).not.toHaveBeenCalled();
  });

  it.each(['authorized', 'failed', 'created'])('does not fulfill a %s but uncaptured payment', async (status) => {
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: 'pay_test_dummy', order_id: 'order_test_dummy', amount: 14900, currency: 'INR', status, captured: false,
    });

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: 'Payment has not been captured.' });
  });

  it('rejects provider amount or currency mismatch', async () => {
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: 'pay_test_dummy', order_id: 'order_test_dummy', amount: 14901, currency: 'INR', status: 'captured', captured: true,
    });

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: 'Razorpay payment details do not match this order.' });
  });

  it('rejects a payment attached to another Razorpay order', async () => {
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: 'pay_test_dummy', order_id: 'order_test_other', amount: 14900, currency: 'INR', status: 'captured', captured: true,
    });

    const response = await POST(postVerification() as never);

    expect(response.status).toBe(400);
    expect(fetchRazorpayPayment).toHaveBeenCalledWith('pay_test_dummy');
  });
});
