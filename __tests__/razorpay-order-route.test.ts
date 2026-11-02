const mockCreateOrder = jest.fn();

jest.mock('razorpay', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    orders: { create: mockCreateOrder },
  })),
}));

import Razorpay from 'razorpay';
import { POST } from '@/app/api/razorpay/order/route';

function request(body: unknown) {
  return new Request('http://localhost/api/razorpay/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('legacy Razorpay order route safety', () => {
  const originalKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-test-secret';
  });

  afterAll(() => {
    if (originalKeyId === undefined) delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    else process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalKeyId;
    if (originalSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalSecret;
  });

  it.each([0, -1, 0.001, 1.234, Number.MAX_SAFE_INTEGER, null, '149'])('rejects invalid amount %p without contacting Razorpay', async (amount) => {
    const response = await POST(request({ amount }));

    expect(response.status).toBe(400);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('does not use fallback credentials when provider configuration is missing', async () => {
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const response = await POST(request({ amount: 149 }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Payment provider is not configured' });
    expect(Razorpay).not.toHaveBeenCalled();
  });

  it.each([[149, 14900], [999, 99900]])('converts ₹%i to %i paise and returns the provider order', async (amount, amountInPaise) => {
    const providerOrder = { id: 'order_test_dummy', amount: amountInPaise, currency: 'INR' };
    mockCreateOrder.mockResolvedValue(providerOrder);

    const response = await POST(request({ amount }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(providerOrder);
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: amountInPaise, currency: 'INR' }));
  });
});
