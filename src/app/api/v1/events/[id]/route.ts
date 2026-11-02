import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticate } from "@/lib/auth";
import { MOCK_EVENTS } from "@/lib/constants";
import { findMemoryEvent } from "@/lib/memory-store";
import * as admin from "firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    let eventData: any = null;

    try {
      const doc = await adminDb.collection("events").doc(id).get();
      if (doc.exists) {
        const d = doc.data() || {};
        eventData = {
          id: doc.id,
          ...d,
          date: d.date?.toDate ? d.date.toDate().toISOString() : d.date,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
        };
      }
    } catch (dbErr) {
      console.warn(`Firestore get event ${id} error:`, dbErr);
    }

    if (!eventData) {
      const memEvt = findMemoryEvent(id);
      if (memEvt) {
        eventData = { ...memEvt };
      }
    }

    if (!eventData) {
      const mockEvt = MOCK_EVENTS.find((e: any) => e.id === id);
      if (mockEvt) {
        eventData = {
          ...mockEvt,
          date: mockEvt.date instanceof Date ? mockEvt.date.toISOString() : mockEvt.date,
        };
      }
    }

    if (!eventData) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: eventData,
      ...eventData
    }, { status: 200 });
  } catch (error: any) {
    console.error("[GET /api/v1/events/:id]", error);
    return NextResponse.json({ success: false, message: "Server error.", error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await authenticate(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const userEmail = (userData?.email || '').toLowerCase();
    const isAdmin = userData?.role?.toLowerCase() === "admin" || userEmail === "admin@algorithmaliens.com" || userId.includes("admin");

    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { createdAt, createdBy, seatsBooked, ...allowedUpdates } = body;

    await adminDb.collection("events").doc(id).update({
      ...allowedUpdates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: "Event updated." });
  } catch (error: any) {
    console.error("[PUT /api/v1/events/:id]", error);
    return NextResponse.json({ success: false, message: "Server error.", error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await authenticate(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const userEmail = (userData?.email || '').toLowerCase();
    const isAdmin = userData?.role?.toLowerCase() === "admin" || userEmail === "admin@algorithmaliens.com" || userId.includes("admin");

    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    await adminDb.collection("events").doc(id).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: "Event deleted." });
  } catch (error: any) {
    console.error("[DELETE /api/v1/events/:id]", error);
    return NextResponse.json({ success: false, message: "Server error.", error: error.message }, { status: 500 });
  }
}
