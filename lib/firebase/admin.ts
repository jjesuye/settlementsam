/**
 * lib/firebase/admin.ts
 * Firebase Admin SDK — lazy singleton using a Proxy so the app is only
 * initialized when a property is first accessed at runtime (not at build time).
 * Never import in client components.
 *
 * When Firebase frameworksBackend runs the Next.js server, it pre-initializes
 * a Firebase app named 'firebase-frameworks'. We reuse that app rather than
 * trying to create a DEFAULT app. getFirestore/getAuth must receive the app
 * instance explicitly to avoid the "default app does not exist" error.
 */

import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

function getOrInitApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    // Prefer the DEFAULT app; fall back to whatever app exists (e.g. 'firebase-frameworks')
    try { return getApp(); } catch { return apps[0]; }
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID ?? 'settlement-sam-77db2',
        clientEmail,
        privateKey,
      }),
    });
  }
  // Running on Google Cloud — Application Default Credentials + FIREBASE_CONFIG
  return initializeApp();
}

// Lazy Proxy — Firebase is initialized on first access, not at build time.
export const adminDb = new Proxy({} as Firestore, {
  get(_: Firestore, prop: string | symbol) {
    const app = getOrInitApp();
    const db  = getFirestore(app);
    const val = Reflect.get(db, prop, db);
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(db) : val;
  },
});

export const adminAuth = new Proxy({} as Auth, {
  get(_: Auth, prop: string | symbol) {
    const app  = getOrInitApp();
    const auth = getAuth(app);
    const val  = Reflect.get(auth, prop, auth);
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(auth) : val;
  },
});
