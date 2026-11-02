jest.mock("@/lib/payments/auth", () => ({
  authenticatePaymentRequest: jest.fn(),
}));
jest.mock("@/lib/payments/razorpay", () => ({
  verifyRazorpaySignature: jest.fn(() => true),
}));
jest.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));

import { POST } from "@/app/api/v1/payments/verify/route";
import { authenticatePaymentRequest } from "@/lib/payments/auth";
import { adminDb } from "@/lib/firebase/admin";

describe("payment verification ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticatePaymentRequest as jest.Mock).mockResolvedValue("signed-in-user");
  });

  it("does not expose or fulfill another user's payment order", async () => {
    const update = jest.fn();
    const paymentDoc = {
      exists: true,
      data: () => ({ userId: "different-user", status: "pending" }),
      ref: { update },
    };
    const get = jest.fn().mockResolvedValue(paymentDoc);
    (adminDb.collection as jest.Mock).mockReturnValue({
      doc: jest.fn(() => ({ get })),
    });

    const response = await POST(
      new Request("https://example.test/api/v1/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_for_different_user",
          razorpay_payment_id: "payment-id",
          razorpay_signature: "valid-signature",
          userId: "different-user",
        }),
      }) as never
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "Payment order not found.",
    });
    expect(update).not.toHaveBeenCalled();
    expect(adminDb.collection).toHaveBeenCalledWith("payments");
  });
});
