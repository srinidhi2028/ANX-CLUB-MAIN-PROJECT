import * as admin from 'firebase-admin';

class FirebaseAdminSingleton {
  private static instance: admin.app.App | null = null;
  private static dbInstance: admin.firestore.Firestore | null = null;
  private static authInstance: admin.auth.Auth | null = null;
  private static storageInstance: admin.storage.Storage | null = null;

  private constructor() {}

  public static getApp(): admin.app.App {
    if (this.instance) return this.instance;

    if (admin.apps.length > 0) {
      this.instance = admin.apps[0]!;
      return this.instance;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Firebase Admin SDK missing required credentials.");
    }

    try {
      this.instance = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      return this.instance;
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', getSafeFirestoreDiagnostic(error));
      throw error;
    }
  }

  public static get db(): admin.firestore.Firestore {
    if (!this.dbInstance) this.dbInstance = this.getApp().firestore();
    return this.dbInstance;
  }

  public static get auth(): admin.auth.Auth {
    if (!this.authInstance) this.authInstance = this.getApp().auth();
    return this.authInstance;
  }

  public static get storage(): admin.storage.Storage {
    if (!this.storageInstance) this.storageInstance = this.getApp().storage();
    return this.storageInstance;
  }
}

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_, prop) {
    const db = FirebaseAdminSingleton.db;
    const value = (db as any)[prop];
    return typeof value === 'function' ? value.bind(db) : value;
  }
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_, prop) {
    const auth = FirebaseAdminSingleton.auth;
    const value = (auth as any)[prop];
    return typeof value === 'function' ? value.bind(auth) : value;
  }
});

export const adminStorage = new Proxy({} as admin.storage.Storage, {
  get(_, prop) {
    const storage = FirebaseAdminSingleton.storage;
    const value = (storage as any)[prop];
    return typeof value === 'function' ? value.bind(storage) : value;
  }
});

function sanitizeFirestoreDiagnosticText(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi, "[redacted-private-key]")
    .replace(/\b([A-Z]:\\Users\\)[^\\]+/gi, "$1[redacted]")
    .replace(/\/home\/[^/]+/g, "/home/[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/rzp_(?:test|live)_[A-Za-z0-9]+/gi, "[redacted-key]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(secret|token|password|api[_-]?key|private[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\b(?:users|memberships)\/[^/\s,;)]+/gi, (path) => `${path.split("/")[0]}/[redacted-id]`)
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-number]")
    .slice(0, 1200);
}

export function getSafeFirestoreDiagnostic(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown; stack?: unknown } | null;
  const rawCode = candidate?.code;
  const code = typeof rawCode === "number"
    ? rawCode
    : typeof rawCode === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(rawCode)
      ? rawCode
      : undefined;
  const message = typeof candidate?.message === "string"
    ? sanitizeFirestoreDiagnosticText(candidate.message)
    : undefined;
  const stack = typeof candidate?.stack === "string"
    ? candidate.stack
      .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi, "[redacted-private-key]")
      .split("\n").slice(1, 7).map((line) => sanitizeFirestoreDiagnosticText(line)).join("\n")
    : undefined;

  return { code, message, stack };
}

export function logFirestoreFallback(service: string, error: unknown): void {
  const diagnostic = getSafeFirestoreDiagnostic(error);
  if (diagnostic.code === 5 || diagnostic.code === '5' || diagnostic.code === "not-found") {
    console.warn(`${service}: Firestore returned NOT_FOUND (code 5); using mock fallback.`, diagnostic);
    return;
  }

  console.warn(`${service}: Firestore request failed; using mock fallback.`, diagnostic);
}
