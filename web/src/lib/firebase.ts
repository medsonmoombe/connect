import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only on the client side
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;
let functions: Functions | undefined;

if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  storage = getStorage(app);
  functions = getFunctions(app, process.env.NEXT_PUBLIC_FIREBASE_REGION || 'us-central1');
}

/**
 * Create a secondary Firebase app instance for administrative tasks
 * that shouldn't affect the main app's authentication state.
 */
export const createAdminAuth = async () => {
  const adminApp = initializeApp(firebaseConfig, 'AdminProvisioning');
  const adminAuth = getAuth(adminApp);
  // Ensure this auth instance doesn't persist or interfere with the main app
  await setPersistence(adminAuth, inMemoryPersistence);
  return { adminAuth, adminApp };
};

export { auth, storage, functions };
export default app;
