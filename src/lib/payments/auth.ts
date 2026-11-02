import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Authenticate payment API requests using only Firebase-verified ID tokens.
 * The general auth helper supports demo identities for other app flows; those
 * identities must never establish ownership of a payment.
 */
export async function authenticatePaymentRequest(
  request: NextRequest | Request
): Promise<string | null> {
  let token = "";
  const authorization = request.headers.get("Authorization");

  if (authorization?.startsWith("Bearer ")) {
    token = authorization.slice("Bearer ".length).trim();
  } else {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)(?:session|__session)=([^;]*)/);
    if (match) token = match[1];
  }

  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return typeof decoded.uid === "string" && decoded.uid.length > 0
      ? decoded.uid
      : null;
  } catch {
    return null;
  }
}
