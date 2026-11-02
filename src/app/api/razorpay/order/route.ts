import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, currency = 'INR', userId = '', email = '', purpose = 'Payment', eventId = '', name = '', college = '', mobile = '', teamName = '', teamMembers = '' } = body;

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'A valid positive amount is required' }, { status: 400 });
    }

    const amountInPaise = Math.round(amount * 100);
    if (
      amountInPaise <= 0 ||
      !Number.isSafeInteger(amountInPaise) ||
      Math.abs(amount * 100 - amountInPaise) > 1e-8
    ) {
      return NextResponse.json({ error: 'Amount must be a valid value in paise' }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment provider is not configured' }, { status: 503 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const options = {
      amount: amountInPaise,
      currency,
      receipt: `rcptid_${Date.now()}`,
      notes: {
        userId,
        email,
        purpose,
        eventId,
        name: name.substring(0, 255),
        college: college.substring(0, 255),
        mobile: mobile.substring(0, 255),
        teamName: teamName.substring(0, 255),
        teamMembers: teamMembers.substring(0, 255)
      }
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json(order);
  } catch {
    // Provider errors may include request details. Keep credentials and payloads out of logs/responses.
    console.error('Razorpay order creation failed');
    return NextResponse.json({ error: 'Error creating payment order' }, { status: 500 });
  }
}
