/**
 * lib/firebase/client.ts
 * Firebase Client SDK singleton — safe to import in client components.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore }           from 'firebase/firestore';

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
export const db = getFirestore(clientApp);

// Temporary config check — remove after confirming SMS works in production
if (typeof window !== 'undefined') {
  console.log('Firebase config check:', {
    apiKey:    config.apiKey    ? 'SET' : 'MISSING',
    authDomain: config.authDomain ? 'SET' : 'MISSING',
    projectId: config.projectId ? 'SET' : 'MISSING',
  });
}
