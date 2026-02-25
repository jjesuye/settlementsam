/**
 * lib/validate-email-server.ts
 *
 * Level 2 — MX record check + combined validation.
 * SERVER-SIDE ONLY. Never import this in client components.
 * Uses Node's dns module which is not available in browser bundles.
 */

import dns from 'dns/promises';
import { validateEmailFormat } from './validate-email';

/**
 * Check if the email domain has valid MX records.
 * Returns true if resolvable, false on any error.
 */
export async function hasValidMX(email: string): Promise<boolean> {
  try {
    const domain  = email.trim().toLowerCase().split('@')[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Combined server-side validation: format check + MX record check.
 * Returns null if valid, or a user-facing error string if invalid.
 */
export async function validateEmailServer(email: string): Promise<string | null> {
  const formatError = validateEmailFormat(email);
  if (formatError) return formatError;

  const mxOk = await hasValidMX(email);
  if (!mxOk) {
    return "Please use a real email address — we'll send your results there.";
  }

  return null;
}
