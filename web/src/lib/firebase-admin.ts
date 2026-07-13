import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { join } from 'path';

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  // Try env vars first (production/CI), fall back to local JSON file (dev)
  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && !process.env.FIREBASE_ADMIN_PRIVATE_KEY.includes('<paste')) {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  // Dev fallback: load serviceAccountKey.json from supabase/ folder
  const keyPath = join(process.cwd(), 'supabase', 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  return initializeApp({ credential: cert(serviceAccount) });
}

export async function verifyFirebaseToken(token: string) {
  const app = getAdminApp();
  return getAuth(app).verifyIdToken(token);
}

export function getAdminStorage() {
  const app = getAdminApp();
  // Firebase Admin SDK requires the appspot.com bucket name, not firebasestorage.app
  const bucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '')
    .replace('.firebasestorage.app', '.appspot.com');
  return getStorage(app).bucket(bucket);
}
