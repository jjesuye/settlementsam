/**
 * lib/firebase/client.ts
 * Firebase Client SDK singleton — safe to import in client components.
 *
 * initializeRecaptchaConfig MUST be called before any Phone Auth operations.
 * Without it, Firebase SDK v10+ cannot resolve the correct reCAPTCHA site key
 * for the current hostname, causing auth/captcha-check-failed errors.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore }           from 'firebase/firestore';
import { getAuth, initializeRecaptchaConfig } from 'firebase/auth';

const config = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton — never initialize twice
export const clientApp = getApps().length ? getApps()[0] : initializeApp(config);
export const db   = getFirestore(clientApp);
export const auth = getAuth(clientApp);

// Download reCAPTCHA config from Firebase so Phone Auth knows which site key
// to use for this hostname. Must run client-side only.
if (typeof window !== 'undefined') {
  initializeRecaptchaConfig(auth).catch(err =>
    console.error('[Firebase] initializeRecaptchaConfig failed:', err)
  );
}
