'use client';
/**
 * lib/firebase/phone-auth.ts
 * Firebase Phone Authentication — client-side only.
 * reCAPTCHA attaches to a persistent hidden <div id="recaptcha-container"> (not a button).
 */

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { clientApp } from './client';

// Store at module level — persists across renders
let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export function destroyRecaptcha() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* ignore cleanup errors */ }
    recaptchaVerifier = null;
  }
}

/** Call this ONCE after <div id="recaptcha-container"> exists in the DOM. */
export function initRecaptcha(): void {
  if (typeof window === 'undefined') return;

  const container = document.getElementById('recaptcha-container');
  if (!container) {
    console.error('[phone-auth] initRecaptcha: #recaptcha-container div not found in DOM');
    return;
  }

  // Always destroy existing before creating new
  destroyRecaptcha();

  const auth = getAuth(clientApp);

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    'recaptcha-container',
    {
      size: 'invisible',
      callback: () => {
        console.log('[phone-auth] reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.log('[phone-auth] reCAPTCHA expired — will reinitialize on next attempt');
        destroyRecaptcha();
      },
    },
  );

  // Pre-render so it's ready when the user clicks
  recaptchaVerifier.render()
    .then((widgetId) => {
      console.log('[phone-auth] reCAPTCHA rendered, widgetId:', widgetId);
    })
    .catch((err) => {
      console.error('[phone-auth] reCAPTCHA render error:', err);
    });
}

export async function sendVerificationCode(
  phoneNumber: string,
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Cannot send SMS on server' };
  }

  // Format to E.164 (+1XXXXXXXXXX)
  const digits = phoneNumber.replace(/\D/g, '');
  let e164: string;

  if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else {
    return { success: false, error: 'Please enter a valid 10-digit US phone number.' };
  }

  try {
    const auth = getAuth(clientApp);

    // Initialize fresh verifier if needed
    if (!recaptchaVerifier) {
      initRecaptcha();
      // Give it a moment to render
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (!recaptchaVerifier) {
      return { success: false, error: 'reCAPTCHA not ready. Please refresh the page.' };
    }

    console.log('[phone-auth] Sending SMS to:', e164);

    confirmationResult = await signInWithPhoneNumber(auth, e164, recaptchaVerifier);

    console.log('[phone-auth] SMS sent successfully');
    return { success: true };

  } catch (err: unknown) {
    // Full error logging to diagnose undefined error codes
    console.error('[phone-auth] SMS send error — full dump:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    const e = err as Record<string, unknown>;
    console.error('[phone-auth] err.code:', e?.code);
    console.error('[phone-auth] err.message:', e?.message);
    console.error('[phone-auth] err.name:', e?.name);
    console.error('[phone-auth] err.stack:', e?.stack);

    // Always destroy and recreate verifier after any error
    destroyRecaptcha();

    const errorMessages: Record<string, string> = {
      'auth/invalid-phone-number':   'Please enter a valid US phone number.',
      'auth/too-many-requests':      'Too many attempts. Please wait 15 minutes.',
      'auth/quota-exceeded':         'SMS service temporarily unavailable. Try again in a few minutes.',
      'auth/captcha-check-failed':   'Security check failed. Please refresh the page and try again.',
      'auth/missing-phone-number':   'Please enter your phone number.',
      'auth/user-disabled':          'This phone number has been disabled.',
      'auth/operation-not-allowed':  'Phone sign-in is not enabled. Please contact support.',
      'auth/network-request-failed': 'Network error. Please check your connection and try again.',
    };

    const code = typeof e?.code === 'string' ? e.code : '';
    const msg  = typeof e?.message === 'string' ? e.message : '';
    const friendlyMsg = code ? (errorMessages[code] ?? `Verification failed (${code}). Please try again.`)
                              : (msg ? `Error: ${msg}` : 'Verification failed. Please refresh and try again.');

    return { success: false, error: friendlyMsg };
  }
}

export async function confirmVerificationCode(
  code: string,
): Promise<{ success: boolean; idToken?: string; error?: string }> {
  if (!confirmationResult) {
    return { success: false, error: 'Session expired. Please request a new code.' };
  }

  if (!code || code.length !== 6) {
    return { success: false, error: 'Please enter the complete 6-digit code.' };
  }

  try {
    const result = await confirmationResult.confirm(code);
    console.log('[phone-auth] Phone verified successfully, user:', result.user.uid);
    const idToken = await result.user.getIdToken();
    confirmationResult = null;
    return { success: true, idToken };

  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error('[phone-auth] Code confirm error:', e?.code, e?.message);

    const errorMessages: Record<string, string> = {
      'auth/invalid-verification-code': 'Incorrect code. Please check and try again.',
      'auth/code-expired':              'This code has expired. Please request a new one.',
      'auth/missing-verification-code': 'Please enter the 6-digit code.',
    };

    const code_ = typeof e?.code === 'string' ? e.code : '';
    return {
      success: false,
      error: code_ ? (errorMessages[code_] ?? 'Verification failed. Please try again.') : 'Verification failed. Please try again.',
    };
  }
}

export function hasPendingConfirmation(): boolean {
  return confirmationResult !== null;
}
