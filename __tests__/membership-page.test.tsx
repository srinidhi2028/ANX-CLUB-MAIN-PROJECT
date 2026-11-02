/** @jest-environment jsdom */

jest.mock('@/modules/module3/components/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'firebase-test-user', email: 'student@example.test' },
    profile: { fullName: 'Test Student', email: 'student@example.test', role: 'Member' },
  }),
}));
jest.mock('@/modules/module3/lib/razorpay', () => ({
  createRazorpayOrder: jest.fn(),
  verifyRazorpayPayment: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MembershipPage from '@/app/(dashboard)/membership/page';
import { createRazorpayOrder } from '@/modules/module3/lib/razorpay';

describe('membership plan selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    class RazorpayMock {
      on = jest.fn();
      open = jest.fn();
      constructor(_options: unknown) {}
    }
    (window as any).Razorpay = RazorpayMock;
    (createRazorpayOrder as jest.Mock).mockResolvedValue({
      id: 'order_test_dummy',
      amount: 14900,
      currency: 'INR',
      keyId: 'rzp_test_dummy',
    });
  });

  afterEach(() => {
    delete (window as any).Razorpay;
  });

  it.each([
    ['Monthly', 149, 'monthly'],
    ['Annual', 999, 'annual'],
  ] as const)('%s selection displays its price and sends its period to the order API', async (label, price, period) => {
    render(<MembershipPage />);

    const planButton = screen.getByRole('button', { name: new RegExp(label) });
    fireEvent.click(planButton);
    expect(planButton).toHaveAttribute('aria-pressed', 'true');
    expect(document.body.textContent).toContain(`₹${price}`);

    fireEvent.click(screen.getByRole('button', { name: /Upgrade Plan Now/ }));
    expect(screen.queryByLabelText(/card details|cvv|expiry date|cardholder/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue to Razorpay Checkout/ }));

    await waitFor(() => {
      expect(createRazorpayOrder).toHaveBeenCalledWith(price, 'INR', {
        paymentType: 'membership',
        billingPeriod: period,
      });
    });
  });
});
