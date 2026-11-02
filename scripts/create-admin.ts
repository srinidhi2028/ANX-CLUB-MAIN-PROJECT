import { adminAuth, adminDb } from '@/lib/firebase/admin';

const email = (process.env.ADMIN_EMAIL || 'admin@algorithmaliens.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin@anx@7';
const fullName = process.env.ADMIN_NAME || 'System Administrator';

async function createAdmin() {
  let user;
  try {
    user = await adminAuth.getUserByEmail(email!);
    user = await adminAuth.updateUser(user.uid, { password, displayName: fullName });
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await adminAuth.createUser({ email, password, displayName: fullName });
  }

  await adminAuth.setCustomUserClaims(user.uid, { admin: true });
  await adminDb.collection('users').doc(user.uid).set({
    uid: user.uid,
    email,
    fullName,
    role: 'Admin',
    membershipType: 'premium',
    updatedAt: new Date(),
  }, { merge: true });

  await adminDb.collection('system_config').doc('admin_auth').set({
    currentPassword: password,
    updatedAt: new Date().toISOString(),
    updatedBy: email,
  }, { merge: true });

  console.log(`Admin account ready: ${email}`);
}

createAdmin().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
