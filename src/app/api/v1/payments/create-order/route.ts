import { NextRequest, NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { adminDb, getSafeFirestoreDiagnostic } from "@/lib/firebase/admin";
import { authenticatePaymentRequest } from "@/lib/payments/auth";
import * as admin from "firebase-admin";

function getTimestampMillis(value: unknown): number {
  if (!value) return Number.NaN;
  const timestamp = value as { toDate?: () => Date };
  const date = typeof timestamp.toDate === "function"
    ? timestamp.toDate()
    : new Date(value as string | number | Date);
  return date.getTime();
}

function getSafeProviderError(error: unknown) {
  const candidate = error as {
    statusCode?: unknown;
    error?: { code?: unknown; description?: unknown };
    description?: unknown;
  } | null;
  const statusCode = candidate && Number.isInteger(candidate.statusCode) && Number(candidate.statusCode) >= 100 && Number(candidate.statusCode) <= 599
    ? Number(candidate.statusCode)
    : undefined;
  const rawCode = candidate?.error?.code;
  const code = typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode)
    ? rawCode
    : undefined;
  const rawDescription = candidate?.error?.description ?? candidate?.description;
  const description = typeof rawDescription === "string"
    ? rawDescription
      .replace(/[\r\n\t]+/g, " ")
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/rzp_(?:test|live)_[A-Za-z0-9]+/gi, "[redacted-key]")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .replace(/\b(secret|token|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
      .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-number]")
      .slice(0, 200)
    : undefined;

  return { providerStatusCode: statusCode, providerCode: code, providerDescription: description };
}

export async function POST(request: NextRequest) {
  let requestStage = "authentication";
  try {
    const userId = await authenticatePaymentRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    requestStage = "request_validation";
    const { eventId, paymentType, billingPeriod = "annual" } = await request.json();
    const isMembership = paymentType === "membership";
    if (!eventId && !isMembership) {
      return NextResponse.json({ success: false, message: "eventId or membership paymentType is required." }, { status: 400 });
    }

    if (isMembership) {
      if (billingPeriod !== "monthly" && billingPeriod !== "annual") {
        return NextResponse.json({ success: false, message: "Unsupported membership billing period." }, { status: 400 });
      }

      requestStage = "membership_lookup";
      const [membershipDoc, userDoc] = await Promise.all([
        adminDb.collection("memberships").doc(userId).get(),
        adminDb.collection("users").doc(userId).get(),
      ]);
      const membership = membershipDoc.data() || {};
      const profile = userDoc.data() || {};
      const markedActive = membership.status === "active" ||
        profile.role === "Premium Member" ||
        String(profile.membershipType || "").toLowerCase() === "premium";
      const expiryValue = membership.expiresAt || membership.endDate || profile.membershipExpiry;
      const expiryTime = getTimestampMillis(expiryValue);
      if (markedActive && (!Number.isFinite(expiryTime) || expiryTime > Date.now())) {
        return NextResponse.json({ success: false, message: "Your membership is already active." }, { status: 409 });
      }

      const amount = billingPeriod === "monthly" ? 149 : 999;
      requestStage = "provider_order_creation";
      const order = await createRazorpayOrder({
        amount,
        currency: "INR",
        receipt: `membership_${userId.slice(0, 8)}_${Date.now()}`,
        notes: { userId, paymentType, billingPeriod },
      });
      requestStage = "payment_record_write";
      await adminDb.collection("payments").doc(order.id).set({
        orderId: order.id,
        userId,
        amount,
        currency: "INR",
        status: "pending",
        paymentType: "membership",
        billingPeriod,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        success: true,
        id: order.id,
        orderId: order.id,
        amount,
        amountInPaise: order.amount,
        currency: "INR",
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      });
    }

    requestStage = "event_lookup";
    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    if (!eventDoc.exists || eventDoc.data()?.isActive === false) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }
    const event = eventDoc.data()!;

    // Check seats
    const seatsAvailable = event.seatsAvailable ?? event.seats;
    const seatsBooked = event.seatsBooked ?? event.registeredCount ?? 0;
    if (seatsAvailable !== null && seatsAvailable !== undefined) {
      if (seatsBooked >= seatsAvailable) {
        return NextResponse.json({ success: false, message: "No seats available." }, { status: 400 });
      }
    }

    // Determine pricing
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const user = userDoc.data() || {};
    const isPremium = user.membershipType === "premium" || user.role === "Premium Member";
    const amount = isPremium && event.premiumPrice ? event.premiumPrice : event.price;

    // Check if already registered
    const existingReg = await adminDb.collection("eventRegistrations")
      .where("userId", "==", userId)
      .where("eventId", "==", eventId)
      .limit(1)
      .get();
    if (!existingReg.empty) {
      return NextResponse.json({ success: false, message: "Already registered." }, { status: 409 });
    }

    // Create order
    requestStage = "provider_order_creation";
    const order = await createRazorpayOrder({
      amount,
      currency: "INR",
      receipt: `evt_${eventId}_${userId.slice(0, 8)}`,
      notes: {
        eventId,
        userId,
        eventTitle: event.title,
      },
    });

    // Store pending payment record
    requestStage = "payment_record_write";
    await adminDb.collection("payments").doc(order.id).set({
      orderId: order.id,
      eventId,
      eventTitle: event.title,
      userId,
      amount,
      currency: "INR",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      id: order.id,
      orderId: order.id,
      amount,
      amountInPaise: order.amount,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      prefill: {
        name: user.fullName || "",
        email: user.email || "",
        contact: user.phone || "",
      },
    });
  } catch (error: any) {
    const isCredentialError = error?.message === "Razorpay credentials are not configured";
    const diagnostics = requestStage === "provider_order_creation" ? getSafeProviderError(error) : {};
    const isFirestoreStage = ["membership_lookup", "event_lookup", "payment_record_write"].includes(requestStage);
    console.error("[POST /api/v1/payments/create-order] Request failed", {
      stage: requestStage,
      reason: isCredentialError ? "provider_configuration_missing" : "request_failed",
      ...(isFirestoreStage ? getSafeFirestoreDiagnostic(error) : {}),
      ...diagnostics,
    });
    const responseStatus = isCredentialError ? 503 : isFirestoreStage ? 503 : requestStage === "provider_order_creation" ? 502 : 500;
    const message = isCredentialError
      ? "Razorpay Test Mode credentials are not configured on the server."
      : requestStage === "membership_lookup"
        ? "Membership information is temporarily unavailable. Please try again later."
        : isFirestoreStage
          ? "Payment service data is temporarily unavailable. Please try again later."
          : requestStage === "provider_order_creation"
            ? "Razorpay could not create the order. Check the Test Mode configuration and try again."
            : "Payment order request could not be completed.";
    return NextResponse.json(
      { success: false, message },
      { status: responseStatus }
    );
  }
}
