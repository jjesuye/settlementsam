/**
 * lib/sms.ts
 * SMS utility: carrier gateways, phone normalization, code generation,
 * and the Nodemailer email-to-SMS transport.
 *
 * All external side effects (sending mail) are isolated to sendSmsCode()
 * so the rest can be unit-tested without a real mailer.
 */

import nodemailer from 'nodemailer';
import crypto from 'crypto';

// ── Carrier gateway map (gateway → display label) ─────────────────────────────

export const CARRIERS: Record<string, string> = {
  'tmomail.net':                 'T-Mobile',
  'vtext.com':                   'Verizon',
  'txt.att.net':                 'AT&T',
  'sms.cricketwireless.net':     'Cricket',
  'sms.myboostmobile.com':       'Boost Mobile',
  'mymetropcs.com':              'Metro PCS',
  'msg.fi.google.com':           'Google Fi',
  'mailmymobile.net':            'Consumer Cellular',
  'vsblmobile.com':              'Visible',
  'tellomail.com':               'Tello',
  'message.ting.com':            'Ting',
  'text.republicwireless.com':   'Republic Wireless',
  'messaging.sprintpcs.com':     'Sprint',
  'email.uscc.net':              'US Cellular',
  'mmst5.tracfone.com':          'TracFone',
};

/**
 * Sentinel value for "I'm not sure / Other" carrier selection.
 * Triggers a multi-gateway blast instead of a single carrier send.
 */
export const MULTI_BLAST_SENTINEL = 'MULTI_BLAST';

/**
 * Gateways blasted simultaneously when the user doesn't know their carrier.
 * First delivery wins. Using Promise.allSettled so one failure doesn't block others.
 */
export const MULTI_BLAST_GATEWAYS = [
  'txt.att.net',
  'vtext.com',
  'tmomail.net',
  'sms.cricketwireless.net',
  'sms.myboostmobile.com',
  'mymetropcs.com',
  'msg.fi.google.com',
  'mailmymobile.net',
];

export const VALID_GATEWAYS = new Set([...Object.keys(CARRIERS), MULTI_BLAST_SENTINEL]);

// ── Constants ─────────────────────────────────────────────────────────────────

export const CODE_TTL_MS       = 10 * 60 * 1_000;  // 10 minutes
export const RATE_WINDOW_MS    = 60 * 60 * 1_000;  // 1 hour
export const MAX_SENDS_PER_HR  = 3;
export const MAX_ATTEMPTS      = 5;
export const RESEND_COOLDOWN_S = 60;                // enforced server-side

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip all non-digits. Remove leading US country code (1) if present.
 * Returns 10-digit string or raw input if shorter/longer.
 */
export function normalizePhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

/**
 * Cryptographically secure 4-digit code, zero-padded.
 * Uses crypto.randomInt to avoid modulo bias of Math.random().
 */
export function generateCode(): string {
  return String(crypto.randomInt(0, 10_000)).padStart(4, '0');
}

/** 32-byte hex session token (64 chars). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Build the email-to-SMS gateway address. */
export function gatewayAddress(phone: string, carrier: string): string {
  return `${phone}@${carrier}`;
}

// ── Mailer ────────────────────────────────────────────────────────────────────

function createMailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send a 4-digit code to the user's phone via a single carrier email-to-SMS gateway.
 * Throws on mail failure so the caller can roll back the stored code.
 */
export async function sendSmsCode(
  phone: string,
  carrier: string,
  code: string,
  name: string,
): Promise<void> {
  const mailer = createMailer();
  const to     = gatewayAddress(phone, carrier);
  const text   = `Hey ${name}, it's Settlement Sam! Your code is ${code}. Your case info is safe with me. 🤝`;

  await mailer.sendMail({
    from:    `"Settlement Sam" <${process.env.GMAIL_USER}>`,
    to,
    subject: '',   // SMS gateways ignore the subject
    text,
  });
}

/**
 * Multi-gateway blast: sends the code to all MULTI_BLAST_GATEWAYS simultaneously.
 * Used when the user selects "I'm not sure / Other" for carrier.
 * Succeeds if at least one gateway accepts the message (first delivery wins).
 * Throws only if every single gateway attempt fails.
 */
export async function sendSmsCodeMulti(
  phone: string,
  code: string,
  name: string,
): Promise<void> {
  const mailer = createMailer();
  const text   = `Hey ${name}, it's Settlement Sam! Your code is ${code}. Your case info is safe with me. 🤝`;

  const results = await Promise.allSettled(
    MULTI_BLAST_GATEWAYS.map(gateway =>
      mailer.sendMail({
        from:    `"Settlement Sam" <${process.env.GMAIL_USER}>`,
        to:      `${phone}@${gateway}`,
        subject: '',
        text,
      }),
    ),
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[send-code] multi-blast: ${succeeded}/${MULTI_BLAST_GATEWAYS.length} gateways accepted`);

  // Log first failure reason for diagnosis
  const firstFail = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
  if (firstFail) {
    const err = firstFail.reason;
    console.error('[send-code] gateway error sample:', err instanceof Error ? err.message : String(err));
  }

  if (succeeded === 0) {
    throw new Error('All carrier gateway attempts failed. Please check your phone number.');
  }
}
