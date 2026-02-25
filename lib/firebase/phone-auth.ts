/**
 * lib/firebase/phone-auth.ts
 * Firebase Phone Authentication — replaces the Nodemailer email-to-SMS system.
 * Only import this in client components ('use client').
 */

import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { clientApp } from './client';

const auth = getAuth(clientApp);

export function setupRecaptcha(containerId: string) {
  if (typeof window === 'undefined') return null;

  // Clear any existing verifier to allow re-use
  if ((window as any).recaptchaVerifier) {
    try { (window as any).recaptchaVerifier.clear(); } catch { /* ignore */ }
  }

  const verifier = new RecaptchaVerifier(
    auth,
    containerId,
    {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        if ((window as any).recaptchaVerifier) {
          try { (window as any).recaptchaVerifier.clear(); } catch { /* ignore */ }
        }
      },
    },
  );

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Send a Firebase OTP to the given US phone number.
 * Returns the E.164-formatted phone string used.
 */
export async function sendVerificationCode(phoneNumber: string): Promise<string> {
  // Format to E.164: +1XXXXXXXXXX
  const cleaned   = phoneNumber.replace(/\D/g, '');
  const formatted = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;

  const verifier = setupRecaptcha('recaptcha-container');
  if (!verifier) throw new Error('Recaptcha not ready');

  const confirmation = await signInWithPhoneNumber(auth, formatted, verifier);
  (window as any).confirmationResult = confirmation;
  return formatted;
}

/**
 * Confirm the 6-digit Firebase OTP.
 * Returns { idToken, phone } on success — pass idToken to /api/verify-code
 * so the server can create the lead and issue a JWT.
 */
export async function verifyCode(code: string): Promise<{ idToken: string; phone: string }> {
  const confirmation = (window as any).confirmationResult;
  if (!confirmation) throw new Error('No pending verification');

  const result  = await confirmation.confirm(code);
  const idToken = await result.user.getIdToken();
  const phone   = result.user.phoneNumber ?? '';
  return { idToken, phone };
}

/** Map Firebase auth error codes to human-readable messages. */
export function mapFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Please enter a valid US phone number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait 15 minutes.';
    case 'auth/code-expired':
      return 'Code expired. Please request a new one.';
    case 'auth/invalid-verification-code':
      return "That code didn't match.";
    case 'auth/quota-exceeded':
      return 'Verification temporarily unavailable. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
