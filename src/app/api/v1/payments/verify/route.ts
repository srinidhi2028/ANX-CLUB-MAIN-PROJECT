import { NextRequest, NextResponse } from "next/server";
import { fetchRazorpayOrder, fetchRazorpayPayment, verifyRazorpaySignature } from "@/lib/payments/razorpay";
import { adminDb } from '@/lib/firebase/admin';
import { authenticatePaymentRequest } from '@/lib/payments/auth';
import { calculateMembershipExpiry } from '@/lib/payments/membership-dates';
import * as admin from "firebase-admin";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const candidate = value as { toDate?: () => Date };
  const date = typeof candidate.toDate === "function" ? candidate.toDate() : new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticatePaymentRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      eventId,
      name,
      email,
      phone,
    } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json({ success: false, message: "Signature verification failed" }, { status: 400 });
    }

    const paymentDoc = await adminDb.collection("payments").doc(razorpay_order_id).get();
    if (!paymentDoc.exists || paymentDoc.data()?.userId !== userId) {
      return NextResponse.json({ success: false, message: "Payment order not found." }, { status: 404 });
    }
    const paymentData = paymentDoc.data()!;

    const expectedAmount = Number(paymentData.amount);
    const expectedAmountInPaise = Math.round(expectedAmount * 100);
    if (
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isSafeInteger(expectedAmountInPaise) ||
      Math.abs(expectedAmount * 100 - expectedAmountInPaise) > 1e-8
    ) {
      return NextResponse.json({ success: false, message: "Stored payment amount is invalid." }, { status: 409 });
    }

    let providerOrder;
    let providerPayment;
    try {
      [providerOrder, providerPayment] = await Promise.all([
        fetchRazorpayOrder(razorpay_order_id),
        fetchRazorpayPayment(razorpay_payment_id),
      ]);
    } catch (error: any) {
      if (error?.message === "Razorpay credentials are not configured") {
        return NextResponse.json({ success: false, message: "Razorpay Test Mode credentials are not configured on the server." }, { status: 503 });
      }
      return NextResponse.json({ success: false, message: "Could not verify payment with Razorpay. Please retry." }, { status: 502 });
    }

    const expectedCurrency = paymentData.currency || "INR";
    if (
      providerOrder.id !== razorpay_order_id ||
      Number(providerOrder.amount) !== expectedAmountInPaise ||
      providerOrder.currency !== expectedCurrency ||
      providerPayment.order_id !== razorpay_order_id ||
      Number(providerPayment.amount) !== expectedAmountInPaise ||
      providerPayment.currency !== expectedCurrency
    ) {
      return NextResponse.json({ success: false, message: "Razorpay payment details do not match this order." }, { status: 400 });
    }

    if (providerPayment.status !== "captured" || providerPayment.captured !== true) {
      return NextResponse.json({ success: false, message: "Payment has not been captured." }, { status: 409 });
    }

    if (paymentData.paymentType === "membership") {
      if (paymentData.billingPeriod !== "monthly" && paymentData.billingPeriod !== "annual") {
        return NextResponse.json({ success: false, message: "Membership billing period is invalid." }, { status: 409 });
      }

      const startDate = new Date();
      const expiry = calculateMembershipExpiry(startDate, paymentData.billingPeriod);
      const membershipRef = adminDb.collection("memberships").doc(userId);
      const historyRef = membershipRef.collection("history").doc(razorpay_order_id);
      const userRef = adminDb.collection("users").doc(userId);
      const duplicateMemberships = adminDb.collection("memberships")
        .where("orderId", "==", razorpay_order_id)
        .limit(1);

      const fulfillment = await adminDb.runTransaction(async (transaction) => {
        const [currentPayment, existingHistory, currentMembership, currentUser, existingLegacyTerm] = await Promise.all([
          transaction.get(paymentDoc.ref),
          transaction.get(historyRef),
          transaction.get(membershipRef),
          transaction.get(userRef),
          transaction.get(duplicateMemberships),
        ]);

        if (!currentPayment.exists || currentPayment.data()?.userId !== userId) {
          throw new Error("PAYMENT_ORDER_NOT_FOUND");
        }
        if (existingHistory.exists || !existingLegacyTerm.empty) {
          return { alreadyFulfilled: true, activeMembership: false };
        }

        const currentMembershipData = currentMembership.data() || {};
        const currentUserData = currentUser.data() || {};
        const existingExpiryValue = currentMembershipData.expiresAt || currentMembershipData.endDate || currentUserData.membershipExpiry;
        const existingExpiry = toDate(existingExpiryValue);
        const hasActiveMembership = currentMembershipData.status === "active" ||
          currentUserData.role === "Premium Member" ||
          String(currentUserData.membershipType || "").toLowerCase() === "premium";
        if (hasActiveMembership && (!existingExpiry || existingExpiry.getTime() > startDate.getTime())) {
          transaction.update(paymentDoc.ref, {
            status: "paid",
            providerStatus: "captured",
            fulfillmentStatus: "retry_required",
            paymentId: razorpay_payment_id,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            fulfillmentFailure: "Membership is already active.",
          });
          return { alreadyFulfilled: false, activeMembership: true };
        }

        const plan = paymentData.billingPeriod === "monthly" ? "monthly_149" : "annual_999";
        const startIso = startDate.toISOString();
        const expiryIso = expiry.toISOString();
        const term = {
          id: razorpay_order_id,
          userId,
          memberId: userId,
          ownerUid: userId,
          tier: "Premium",
          plan,
          billingPeriod: paymentData.billingPeriod,
          status: "active",
          startDate: startIso,
          endDate: expiryIso,
          expiresAt: expiryIso,
          razorpayPaymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          amount: paymentData.amount,
          currency: paymentData.currency || "INR",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.set(historyRef, term);
        transaction.set(membershipRef, {
          ...term,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(userRef, {
          uid: userId,
          membershipType: "premium",
          membershipExpiry: expiryIso,
          role: "Premium Member",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.update(paymentDoc.ref, {
          status: "paid",
          providerStatus: "captured",
          fulfillmentStatus: "completed",
          paymentId: razorpay_payment_id,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          fulfillmentFailure: admin.firestore.FieldValue.delete(),
        });

        return { alreadyFulfilled: false, activeMembership: false };
      });

      if (fulfillment.activeMembership) {
        return NextResponse.json({ success: false, message: "Payment was captured, but your membership is already active. Contact support before retrying." }, { status: 409 });
      }

      // Send emails
      const targetEmail = email || paymentData.userEmail || "";
      if (targetEmail && !fulfillment.alreadyFulfilled) {
        try {
          const { sendEmail } = await import("@/lib/resend");
          const { membershipActivationEmail, paymentConfirmationEmail } = await import("@/lib/email-templates");
          await sendEmail(
            targetEmail,
            "A.N.X Premium Membership Activated! 🚀",
            membershipActivationEmail(name || "Member", expiry.toISOString().split('T')[0], paymentData.billingPeriod === "monthly" ? "Monthly Elite" : "Annual Elite")
          );
          await sendEmail(
            targetEmail,
            "Payment Receipt - A.N.X Platform",
            paymentConfirmationEmail(paymentData.amount, razorpay_payment_id, "Premium Membership Subscription")
          );
        } catch (emailErr) {
          console.warn("Membership emails skipped:", emailErr);
        }
      }

      return NextResponse.json({ success: true, idempotent: fulfillment.alreadyFulfilled, message: "Membership upgraded successfully." });
    }

    // Execute atomic transaction for seat booking and registration creation
    const result = await adminDb.runTransaction(async (transaction) => {
      const eventRef = adminDb.collection("events").doc(eventId);
      const paymentRef = adminDb.collection("payments").doc(razorpay_order_id);
      
      const orderRegQuery = adminDb.collection("eventRegistrations")
        .where("orderId", "==", razorpay_order_id)
        .limit(1);
        
      const userRegQuery = adminDb.collection("eventRegistrations")
        .where("eventId", "==", eventId)
        .where("userId", "==", userId)
        .limit(1);

      const [eventDoc, paymentDoc, orderRegSnap, userRegSnap] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(paymentRef),
        transaction.get(orderRegQuery),
        transaction.get(userRegQuery),
      ]);

      if (!eventDoc.exists) throw new Error("EVENT_NOT_FOUND");
      if (!paymentDoc.exists) throw new Error("PAYMENT_NOT_FOUND");

      // Idempotency check: prevent duplicate registration processing for the same order
      if (!orderRegSnap.empty) {
        return { registrationId: orderRegSnap.docs[0].id, idempotent: true };
      }
      
      // Prevent duplicate registration for the same user on the same event
      if (!userRegSnap.empty) {
        throw new Error("USER_ALREADY_REGISTERED");
      }
      
      const paymentData = paymentDoc.data()!;
      if (paymentData.eventId !== eventId) {
        throw new Error("PAYMENT_EVENT_MISMATCH");
      }
      if (paymentData.userId !== userId) {
         throw new Error("PAYMENT_USER_MISMATCH");
      }

      const eventData = eventDoc.data()!;
      const seatsAvailable = eventData.seatsAvailable;
      const seatsBooked = eventData.seatsBooked || 0;

      if (seatsAvailable !== null && seatsAvailable !== undefined && seatsBooked >= seatsAvailable) {
        throw new Error("EVENT_SOLD_OUT");
      }

      const regRef = adminDb.collection("eventRegistrations").doc();
      const registrationData = {
        eventId,
        eventTitle: eventData.title,
        userId,
        name: name || "Attendee",
        email: email || "",
        phone: phone || "",
        paymentStatus: "paid",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: paymentData.amount,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "confirmed",
      };

      transaction.set(regRef, registrationData);
      transaction.update(paymentRef, {
        status: "paid",
        paymentId: razorpay_payment_id,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(eventRef, {
        seatsBooked: admin.firestore.FieldValue.increment(1),
        registeredCount: admin.firestore.FieldValue.increment(1),
      });

      return { registrationId: regRef.id, idempotent: false, eventTitle: eventData.title, email: registrationData.email, name: registrationData.name, amount: paymentData.amount };
    });

    if (result && !result.idempotent && result.email) {
      try {
        const { sendEmail } = await import("@/lib/resend");
        const { eventRegistrationEmail, paymentConfirmationEmail } = await import("@/lib/email-templates");
        await sendEmail(
          result.email,
          `Event Registration Confirmed: ${result.eventTitle}`,
          eventRegistrationEmail(result.eventTitle, result.name)
        );
        await sendEmail(
          result.email,
          "Event Payment Receipt - A.N.X Platform",
          paymentConfirmationEmail(result.amount, razorpay_payment_id, `Event: ${result.eventTitle}`)
        );
      } catch (emailErr) {
        console.warn("Event confirmation emails skipped:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and registration confirmed!",
      data: result,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/payments/verify] Payment verification failed.");
    if (error?.message === "RAZORPAY_KEY_SECRET is not configured" || error?.message === "Razorpay credentials are not configured") {
      return NextResponse.json({ success: false, message: "Razorpay Test Mode credentials are not configured on the server." }, { status: 503 });
    }
    const status = error.message === "EVENT_SOLD_OUT" ? 409 : 500;
    return NextResponse.json(
      { success: false, message: error.message === "USER_ALREADY_REGISTERED" ? "You are already registered for this event." : "Payment verification failed. Please retry." },
      { status }
    );
  }
}
