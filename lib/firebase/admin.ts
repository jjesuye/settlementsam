/**
 * lib/firebase/admin.ts
 * Firebase Admin SDK — lazy singleton using a Proxy so the app is only
 * initialized when a property is first accessed at runtime (not at build time).
 * Never import this in client components.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

function ensureInit(): void {
  if (getApps().length > 0) return;
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    }),
  });
}

// Lazy Proxy — Firebase is only initialized when a property is first accessed.
// This prevents build-time failures when env vars are not set.
export const adminDb = new Proxy({} as Firestore, {
  get(_: Firestore, prop: string | symbol) {
    ensureInit();
    const db = getFirestore();
    const val = Reflect.get(db, prop, db);
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(db) : val;
  },
});

export const adminAuth = new Proxy({} as Auth, {
  get(_: Auth, prop: string | symbol) {
    ensureInit();
    const auth = getAuth();
    const val = Reflect.get(auth, prop, auth);
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(auth) : val;
  },
});
