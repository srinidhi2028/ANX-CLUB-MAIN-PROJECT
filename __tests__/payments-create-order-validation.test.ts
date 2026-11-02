jest.mock("@/lib/payments/auth", () => ({
  authenticatePaymentRequest: jest.fn(),
}));
jest.mock("@/lib/payments/razorpay", () => ({
  createRazorpayOrder: jest.fn(),
}));
jest.mock("@/lib/firebase/admin", () => ({
  adminDb: { collection: jest.fn() },
  getSafeFirestoreDiagnostic: jest.fn((error: any) => ({
    code: error?.code,
    message: "5 NOT_FOUND: projects/test/databases/(default)/documents/users/[redacted-id]",
    stack: "    at FirebaseAdminSingleton.getDb (admin.ts:50:10)",
  })),
}));

import { POST } from "@/app/api/v1/payments/create-order/route";
import { authenticatePaymentRequest } from "@/lib/payments/auth";
import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { adminDb } from "@/lib/firebase/admin";

function postJson(body: unknown) {
  return new Request("https://example.test/api/v1/payments/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("membership order request validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticatePaymentRequest as jest.Mock).mockResolvedValue("firebase-test-user");
  });

  it.each(["weekly", "Monthly", null])("rejects unsupported billing period %p", async (billingPeriod) => {
    const response = await POST(postJson({ paymentType: "membership", billingPeriod }) as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "Unsupported membership billing period.",
    });
    expect(createRazorpayOrder).not.toHaveBeenCalled();
    expect(adminDb.collection).not.toHaveBeenCalled();
  });

  it.each([["monthly", 149], ["annual", 999]])("uses the server price for %s membership, ignoring client amount", async (billingPeriod, serverPrice) => {
    (createRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_test_dummy",
      amount: serverPrice * 100,
      currency: "INR",
    });
    (adminDb.collection as jest.Mock).mockImplementation((collection: string) => ({
      doc: jest.fn(() => collection === 'payments'
        ? { set: jest.fn().mockResolvedValue(undefined) }
        : { get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }) }),
    }));

    const response = await POST(postJson({ paymentType: "membership", billingPeriod, amount: 1 }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      id: "order_test_dummy",
      orderId: "order_test_dummy",
      amount: serverPrice,
      amountInPaise: serverPrice * 100,
      currency: "INR",
    });
    expect(createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: serverPrice, currency: "INR" }));
    expect(adminDb.collection).toHaveBeenCalledWith("payments");
  });

  it("rejects a new order while the existing membership is active", async () => {
    (adminDb.collection as jest.Mock).mockImplementation((collection: string) => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(collection === 'memberships'
          ? { exists: true, data: () => ({ status: 'active', expiresAt: '2099-01-01T00:00:00.000Z' }) }
          : { exists: true, data: () => ({}) }),
      })),
    }));

    const response = await POST(postJson({ paymentType: 'membership', billingPeriod: 'monthly' }) as never);

    expect(response.status).toBe(409);
    expect(createRazorpayOrder).not.toHaveBeenCalled();
    expect(adminDb.collection).not.toHaveBeenCalledWith('payments');
  });

  it("logs sanitized provider diagnostics without returning provider details", async () => {
    const providerError = {
      statusCode: 401,
      error: {
        code: "BAD_CREDENTIALS",
        description: "Invalid credentials for student@example.test; token=topsecret; key rzp_test_doNotLeak; contact +1 555 123 4567",
      },
    };
    (createRazorpayOrder as jest.Mock).mockRejectedValue(providerError);
    (adminDb.collection as jest.Mock).mockImplementation((collection: string) => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(collection === "memberships"
          ? { exists: false, data: () => undefined }
          : { exists: true, data: () => ({}) }),
      })),
    }));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(postJson({ paymentType: "membership", billingPeriod: "monthly" }) as never);
    const responseBody = await response.json();

    expect(response.status).toBe(502);
    expect(responseBody.message).toBe("Razorpay could not create the order. Check the Test Mode configuration and try again.");
    expect(JSON.stringify(responseBody)).not.toContain("topsecret");
    expect(errorLog).toHaveBeenCalledWith("[POST /api/v1/payments/create-order] Request failed", {
      stage: "provider_order_creation",
      reason: "request_failed",
      providerStatusCode: 401,
      providerCode: "BAD_CREDENTIALS",
      providerDescription: "Invalid credentials for [redacted-email]; token=[redacted]; key [redacted-key]; contact [redacted-number]",
    });
    errorLog.mockRestore();
  });

  it("reports Firestore lookup failures as a data-service error with safe diagnostics", async () => {
    const firestoreError = Object.assign(new Error("5 NOT_FOUND: database does not exist"), { code: 5 });
    (adminDb.collection as jest.Mock).mockImplementation(() => ({
      doc: jest.fn(() => ({ get: jest.fn().mockRejectedValue(firestoreError) })),
    }));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(postJson({ paymentType: "membership", billingPeriod: "monthly" }) as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toBe("Membership information is temporarily unavailable. Please try again later.");
    expect(errorLog).toHaveBeenCalledWith("[POST /api/v1/payments/create-order] Request failed", expect.objectContaining({
      stage: "membership_lookup",
      code: 5,
      message: expect.stringContaining("NOT_FOUND"),
    }));
    expect(createRazorpayOrder).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("rejects unauthenticated order requests before reading the body or contacting Razorpay", async () => {
    (authenticatePaymentRequest as jest.Mock).mockResolvedValue(null);

    const response = await POST(postJson({ paymentType: "membership", billingPeriod: "annual" }) as never);

    expect(response.status).toBe(401);
    expect(createRazorpayOrder).not.toHaveBeenCalled();
    expect(adminDb.collection).not.toHaveBeenCalled();
  });
});
