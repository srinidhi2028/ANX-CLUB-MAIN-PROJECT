jest.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
}));

import { adminAuth } from "@/lib/firebase/admin";
import { authenticatePaymentRequest } from "@/lib/payments/auth";

const verifyIdToken = adminAuth.verifyIdToken as jest.Mock;

describe("payment API authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the UID from a Firebase-verified bearer token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "firebase-user-1" });

    const uid = await authenticatePaymentRequest(
      new Request("https://example.test/api/v1/payments/create-order", {
        headers: { Authorization: "Bearer valid-firebase-token" },
      })
    );

    expect(uid).toBe("firebase-user-1");
    expect(verifyIdToken).toHaveBeenCalledWith("valid-firebase-token");
  });

  it("accepts a verified Firebase token from the session cookie", async () => {
    verifyIdToken.mockResolvedValue({ uid: "firebase-user-2" });

    const uid = await authenticatePaymentRequest(
      new Request("https://example.test/api/v1/payments/create-order", {
        headers: { cookie: "__session=valid-cookie-token" },
      })
    );

    expect(uid).toBe("firebase-user-2");
    expect(verifyIdToken).toHaveBeenCalledWith("valid-cookie-token");
  });

  it("rejects missing credentials without calling Firebase", async () => {
    const uid = await authenticatePaymentRequest(
      new Request("https://example.test/api/v1/payments/create-order")
    );

    expect(uid).toBeNull();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    "not-a-firebase-token",
    "usr_12345",
    "session_usr_12345_1700000000",
    "mock-admin-token",
  ])("rejects an invalid or fake token: %s", async (token) => {
    verifyIdToken.mockRejectedValue(new Error("Invalid ID token"));

    const uid = await authenticatePaymentRequest(
      new Request("https://example.test/api/v1/payments/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(uid).toBeNull();
    expect(verifyIdToken).toHaveBeenCalledWith(token);
  });

  it("rejects an expired Firebase token", async () => {
    verifyIdToken.mockRejectedValue(new Error("Firebase ID token has expired"));

    const uid = await authenticatePaymentRequest(
      new Request("https://example.test/api/v1/payments/verify", {
        headers: { Authorization: "Bearer expired-firebase-token" },
      })
    );

    expect(uid).toBeNull();
  });

  it("does not accept a decoded identity without a UID", async () => {
    verifyIdToken.mockResolvedValue({ email: "member@example.test" });

    const uid = await authenticatePaymentRequest(
      new Request("https://example.test/api/v1/payments/verify", {
        headers: { Authorization: "Bearer token-without-uid" },
      })
    );

    expect(uid).toBeNull();
  });
});
