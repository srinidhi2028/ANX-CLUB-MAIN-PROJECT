import Razorpay from "razorpay";
import crypto from "crypto";

function getRazorpayClient() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export interface CreateOrderOptions {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export async function createRazorpayOrder({
  amount,
  currency = "INR",
  receipt,
  notes,
}: CreateOrderOptions) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid payment amount");
  }
  const amountInPaise = Math.round(amount * 100);
  if (
    amountInPaise <= 0 ||
    !Number.isSafeInteger(amountInPaise) ||
    Math.abs(amount * 100 - amountInPaise) > 1e-8
  ) {
    throw new Error("Invalid payment amount");
  }

  const options = {
    amount: amountInPaise, // Razorpay requires amount in paise
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes,
  };
  return getRazorpayClient().orders.create(options);
}

export async function fetchRazorpayOrder(orderId: string) {
  return getRazorpayClient().orders.fetch(orderId);
}

export async function fetchRazorpayPayment(paymentId: string) {
  return getRazorpayClient().payments.fetch(paymentId);
}

export interface VerifySignatureOptions {
  orderId: string;
  paymentId: string;
  signature: string;
}

export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature,
}: VerifySignatureOptions) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
    
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
