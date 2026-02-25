/**
 * lib/validate-email.ts
 *
 * Level 1 — Format + disposable domain check (client-safe, instant).
 * Safe to import in any client or server component.
 *
 * For server-side MX record checks, use lib/validate-email-server.ts
 */

import validator from 'email-validator';

// ── Disposable / throwaway domain blocklist ────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'grr.la',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'spam4.me',
  'trashmail.com',
  'trashmail.at',
  'trashmail.io',
  'trashmail.me',
  'dispostable.com',
  'mailnull.com',
  'spamgourmet.com',
  'getairmail.com',
  'fakeinbox.com',
  'mailnesia.com',
  'maildrop.cc',
  'spambox.us',
  'tempinbox.com',
  'spamherelots.com',
]);

// ── Obvious fake email addresses ──────────────────────────────────────────────

const FAKE_EMAILS = new Set([
  'test@test.com',
  'fake@fake.com',
  'asdf@asdf.com',
  '123@123.com',
  'aaa@aaa.com',
  'abc@abc.com',
  'noreply@noreply.com',
  'email@email.com',
  'user@user.com',
  'test@example.com',
]);

/**
 * Level 1 — Format + disposable domain check (instant, client-safe).
 * Returns null if valid, or a user-facing error message string if invalid.
 */
export function validateEmailFormat(email: string): string | null {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) return 'Please enter your email address.';

  if (!validator.validate(trimmed)) {
    return 'Please enter a valid email address.';
  }

  if (FAKE_EMAILS.has(trimmed)) {
    return "Please use a real email address — we'll send your results there.";
  }

  const domain = trimmed.split('@')[1] ?? '';
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return 'Temporary email addresses are not accepted. Please use a real email.';
  }

  return null; // valid
}
