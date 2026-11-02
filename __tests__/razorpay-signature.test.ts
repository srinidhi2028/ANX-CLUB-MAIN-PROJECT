import crypto from 'crypto';
import { verifyRazorpaySignature } from '@/lib/payments/razorpay';

describe('Razorpay signature verification helper', () => {
  const secret = 'unit-test-razorpay-secret';
  const orderId = 'order_test_dummy';
  const paymentId = 'pay_test_dummy';
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;

  function sign(forOrderId: string, forPaymentId: string, signingSecret = secret) {
    return crypto
      .createHmac('sha256', signingSecret)
      .update(`${forOrderId}|${forPaymentId}`)
      .digest('hex');
  }

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = secret;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalSecret;
  });

  it('accepts a valid HMAC SHA256 signature', () => {
    expect(verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: sign(orderId, paymentId),
    })).toBe(true);
  });

  it('rejects a signature for a different order or payment ID', () => {
    expect(verifyRazorpaySignature({
      orderId: 'order_test_other',
      paymentId,
      signature: sign(orderId, paymentId),
    })).toBe(false);
  });

  it('rejects malformed or wrong-length signatures', () => {
    expect(verifyRazorpaySignature({ orderId, paymentId, signature: 'not-a-signature' })).toBe(false);
    expect(verifyRazorpaySignature({ orderId, paymentId, signature: 'zz'.repeat(32) })).toBe(false);
  });

  it('rejects a signature created with a different secret', () => {
    expect(verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: sign(orderId, paymentId, 'another-unit-test-secret'),
    })).toBe(false);
  });
});
