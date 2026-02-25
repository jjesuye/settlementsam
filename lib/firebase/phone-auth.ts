/**
 * lib/firebase/phone-auth.ts
 * Firebase Phone Authentication — client-side only ('use client').
 * Uses module-level confirmationResult to avoid window storage.
 */

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { clientApp } from './client';

let confirmationResult: ConfirmationResult | null = null;

export function initRecaptcha() {
  if (typeof window === 'undefined') return;

  const auth = getAuth(clientApp);

  // Clear existing verifier
  if ((window as any).recaptchaVerifier) {
    try { (window as any).recaptchaVerifier.clear(); } catch { /* ignore */ }
    (window as any).recaptchaVerifier = null;
  }

  (window as any).recaptchaVerifier = new RecaptchaVerifier(
    auth,
    'recaptcha-container',
    { size: 'invisible' },
  );
}

export async function sendSMSCode(
  phoneNumber: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getAuth(clientApp);

    const digits = phoneNumber.replace(/\D/g, '');
    const e164   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;

    if (digits.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit US phone number.' };
    }

    initRecaptcha();
    const verifier = (window as any).recaptchaVerifier;

    confirmationResult = await signInWithPhoneNumber(auth, e164, verifier);
    return { success: true };

  } catch (err: any) {
    console.error('SMS send error:', err.code, err.message);
    const errorMap: Record<string, string> = {
      'auth/invalid-phone-number':   'Please enter a valid US phone number.',
      'auth/too-many-requests':      'Too many attempts. Please wait 15 minutes and try again.',
      'auth/quota-exceeded':         'SMS service temporarily unavailable. Try again shortly.',
      'auth/captcha-check-failed':   'Security check failed. Please refresh the page.',
      'auth/missing-phone-number':   'Please enter your phone number first.',
    };
    return { success: false, error: errorMap[err.code] ?? `Verification failed. Please try again.` };
  }
}

export async function verifySMSCode(
  code: string,
): Promise<{ success: boolean; idToken?: string; phone?: string; error?: string }> {
  if (!confirmationResult) {
    return { success: false, error: 'No verification in progress. Please request a new code.' };
  }

  try {
    const result  = await confirmationResult.confirm(code);
    confirmationResult = null;
    const idToken = await result.user.getIdToken();
    const phone   = result.user.phoneNumber ?? '';
    return { success: true, idToken, phone };

  } catch (err: any) {
    console.error('SMS verify error:', err.code, err.message);
    const errorMap: Record<string, string> = {
      'auth/invalid-verification-code': 'That code is incorrect. Please try again.',
      'auth/code-expired':              'Code expired. Please request a new one.',
      'auth/missing-verification-code': 'Please enter the 6-digit code.',
    };
    return { success: false, error: errorMap[err.code] ?? 'Verification failed. Please try again.' };
  }
}
