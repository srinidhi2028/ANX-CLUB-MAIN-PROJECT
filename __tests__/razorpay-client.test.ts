jest.mock('@/lib/firebase/client', () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn(),
    },
  },
}));

import { auth } from '@/lib/firebase/client';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/modules/module3/lib/razorpay';

const getIdToken = auth.currentUser?.getIdToken as jest.Mock;

describe('Razorpay browser request helper', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    getIdToken.mockResolvedValue('firebase-test-id-token');
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('sends a Firebase ID token and normalizes the order ID and paise amount once', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        orderId: 'order_test_dummy',
        amount: 149,
        amountInPaise: 14900,
        currency: 'INR',
        keyId: 'rzp_test_dummy',
      }),
    });

    const order = await createRazorpayOrder(149, 'INR', {
      paymentType: 'membership',
      billingPeriod: 'monthly',
    });

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/payments/create-order',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer firebase-test-id-token' }),
        body: JSON.stringify({ amount: 149, currency: 'INR', paymentType: 'membership', billingPeriod: 'monthly' }),
      })
    );
    expect(order).toMatchObject({ id: 'order_test_dummy', amount: 14900, currency: 'INR' });
  });

  it('uses the API message when an authenticated order request is rejected', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Unauthorized' }),
    });

    await expect(createRazorpayOrder(999, 'INR', { paymentType: 'membership', billingPeriod: 'annual' }))
      .rejects.toThrow('Unauthorized');
  });

  it('sends the Firebase ID token with payment verification too', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await verifyRazorpayPayment({ razorpay_order_id: 'order_test_dummy' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/payments/verify',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer firebase-test-id-token' }),
      })
    );
  });
});
