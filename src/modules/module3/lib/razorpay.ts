import { auth } from '@/lib/firebase/client';

async function getPaymentHeaders() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in with your Firebase account before making a payment.');
  }

  const idToken = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

async function readResponse(response: Response, fallbackMessage: string) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }
  return data;
}

export const createRazorpayOrder = async (amount: number, currency: string = "INR", extraData: any = {}) => {
  const headers = await getPaymentHeaders();
  const response = await fetch('/api/v1/payments/create-order', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount, currency, ...extraData }),
  });

  const data = await readResponse(response, 'Failed to create Razorpay order');
  return {
    ...data,
    id: data.id || data.orderId,
    // The API supplies the provider's paise amount explicitly. Never convert it again here.
    amount: data.amountInPaise ?? data.amount,
  };
};

export const verifyRazorpayPayment = async (
  paymentResponse: any, 
  userId?: string,
  userEmail?: string,
  amount?: number,
  paymentType?: string
) => {
  const headers = await getPaymentHeaders();
  const response = await fetch('/api/v1/payments/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...paymentResponse,
      userId,
      userEmail,
      amount,
      paymentType
    }),
  });

  return readResponse(response, 'Payment verification failed');
};
