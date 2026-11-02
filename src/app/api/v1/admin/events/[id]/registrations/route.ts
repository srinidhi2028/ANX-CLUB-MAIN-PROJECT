import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getMemoryRegistrations } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    let registrations: any[] = [];
    try {
      const registrationsSnapshot = await adminDb.collection('eventRegistrations')
        .where('eventId', '==', params.id)
        .get();
        
      const firestoreRegs = registrationsSnapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          registeredAt: data.registeredAt?.toDate ? data.registeredAt.toDate().toISOString() : data.registeredAt || data.createdAt || new Date().toISOString()
        };
      });

      const memRegs = getMemoryRegistrations(params.id);
      const regMap = new Map<string, any>();
      memRegs.forEach(r => regMap.set(r.id, r));
      firestoreRegs.forEach(r => regMap.set(r.id, r));
      registrations = Array.from(regMap.values());
    } catch (dbErr: any) {
      console.warn(`[admin event registrations fallback to memory store]: ${dbErr?.message || dbErr}`);
      registrations = getMemoryRegistrations(params.id);
    }

    if (registrations.length === 0) {
      registrations = getMemoryRegistrations(params.id);
    }

    return NextResponse.json(registrations);
  } catch (error: any) {
    console.warn('Error fetching registrations:', error?.message || error);
    return NextResponse.json(getMemoryRegistrations(params.id), { status: 200 });
  }
}
