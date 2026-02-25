'use client';
/**
 * lib/firebase/phone-auth.ts
 * Firebase Phone Authentication — client-side only.
 * Module-level state persists across renders; reCAPTCHA attaches to the button.
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

/** Call this ONCE after the send-code button exists in the DOM. */
export function initRecaptcha(buttonId: string): void {
  if (typeof window === 'undefined') return;

  // Always destroy existing before creating new
  destroyRecaptcha();

  const auth = getAuth(clientApp);

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    buttonId,
    {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired — will reinitialize on next attempt');
        destroyRecaptcha();
      },
    },
  );

  // Pre-render so it's ready when the user clicks
  recaptchaVerifier.render().catch((err) => {
    console.error('reCAPTCHA render error:', err);
  });
}

export async function sendVerificationCode(
  phoneNumber: string,
  buttonId: string,
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
      initRecaptcha(buttonId);
    }

    console.log('Sending SMS to:', e164);

    confirmationResult = await signInWithPhoneNumber(auth, e164, recaptchaVerifier!);

    console.log('SMS sent successfully');
    return { success: true };

  } catch (err: any) {
    console.error('SMS send error:', err.code, err.message);

    // Always destroy and recreate verifier after any error
    destroyRecaptcha();

    const errorMessages: Record<string, string> = {
      'auth/invalid-phone-number':    'Please enter a valid US phone number.',
      'auth/too-many-requests':       'Too many attempts. Please wait 15 minutes.',
      'auth/quota-exceeded':          'SMS service temporarily unavailable. Try again in a few minutes.',
      'auth/captcha-check-failed':    'Security check failed. Please refresh the page and try again.',
      'auth/missing-phone-number':    'Please enter your phone number.',
      'auth/user-disabled':           'This phone number has been disabled.',
      'auth/operation-not-allowed':   'Phone sign-in is not enabled. Please contact support.',
      'auth/network-request-failed':  'Network error. Please check your connection and try again.',
    };

    return {
      success: false,
      error: errorMessages[err.code] ?? `Verification failed (${err.code}). Please try again.`,
    };
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
    console.log('Phone verified successfully, user:', result.user.uid);
    const idToken = await result.user.getIdToken();
    confirmationResult = null;
    return { success: true, idToken };

  } catch (err: any) {
    console.error('Code confirm error:', err.code, err.message);

    const errorMessages: Record<string, string> = {
      'auth/invalid-verification-code': 'Incorrect code. Please check and try again.',
      'auth/code-expired':              'This code has expired. Please request a new one.',
      'auth/missing-verification-code': 'Please enter the 6-digit code.',
    };

    return {
      success: false,
      error: errorMessages[err.code] ?? 'Verification failed. Please try again.',
    };
  }
}

export function hasPendingConfirmation(): boolean {
  return confirmationResult !== null;
}
