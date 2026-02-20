/**
 * tests/sms.test.ts
 * Unit tests for SMS utility functions.
 * All tests run in Node environment with no network calls.
 */

import {
  normalizePhone,
  generateCode,
  generateToken,
  gatewayAddress,
  VALID_GATEWAYS,
  CODE_TTL_MS,
  MAX_SENDS_PER_HR,
  MAX_ATTEMPTS,
} from '@/lib/sms';

describe('normalizePhone', () => {
  it('strips formatting characters', () => {
    expect(normalizePhone('(555) 867-5309')).toBe('5558675309');
  });

  it('strips US country code prefix', () => {
    expect(normalizePhone('+1 555 867 5309')).toBe('5558675309');
    expect(normalizePhone('15558675309')).toBe('5558675309');
  });

  it('leaves 10-digit clean number unchanged', () => {
    expect(normalizePhone('5558675309')).toBe('5558675309');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('handles non-standard inputs gracefully', () => {
    expect(normalizePhone('not a number')).toBe('');
  });

  it('does NOT strip leading 1 from an 11-digit number that does not start with 1', () => {
    // 11 digits starting with 2 — unlikely in practice, keep as-is
    expect(normalizePhone('25558675309')).toBe('25558675309');
  });
});

describe('generateCode', () => {
  it('always produces a 4-character string', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).toHaveLength(4);
    }
  });

  it('only contains digit characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateCode()).toMatch(/^\d{4}$/);
    }
  });

  it('zero-pads codes below 1000', () => {
    // We can't force the RNG, but we can verify the format holds
    const code = generateCode();
    expect(code).toMatch(/^\d{4}$/);
  });
});

describe('generateToken', () => {
  it('produces a 64-character hex string', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('produces unique tokens on every call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('gatewayAddress', () => {
  it('concatenates phone and carrier with @', () => {
    expect(gatewayAddress('5558675309', 'vtext.com')).toBe('5558675309@vtext.com');
  });

  it('handles all known carriers', () => {
    const carriers = [
      'txt.att.net',
      'vtext.com',
      'tmomail.net',
      'messaging.sprintpcs.com',
      'email.uscc.net',
      'sms.myboostmobile.com',
    ];
    for (const c of carriers) {
      const addr = gatewayAddress('5550000000', c);
      expect(addr).toBe(`5550000000@${c}`);
    }
  });
});

describe('VALID_GATEWAYS', () => {
  it('contains all 6 carrier gateways', () => {
    expect(VALID_GATEWAYS.size).toBe(6);
    expect(VALID_GATEWAYS.has('txt.att.net')).toBe(true);
    expect(VALID_GATEWAYS.has('vtext.com')).toBe(true);
    expect(VALID_GATEWAYS.has('tmomail.net')).toBe(true);
    expect(VALID_GATEWAYS.has('messaging.sprintpcs.com')).toBe(true);
    expect(VALID_GATEWAYS.has('email.uscc.net')).toBe(true);
    expect(VALID_GATEWAYS.has('sms.myboostmobile.com')).toBe(true);
  });

  it('rejects invalid gateway strings', () => {
    expect(VALID_GATEWAYS.has('random.com')).toBe(false);
    expect(VALID_GATEWAYS.has('')).toBe(false);
  });
});

describe('Constants', () => {
  it('CODE_TTL_MS is 10 minutes', () => {
    expect(CODE_TTL_MS).toBe(600_000);
  });

  it('MAX_SENDS_PER_HR is 3', () => {
    expect(MAX_SENDS_PER_HR).toBe(3);
  });

  it('MAX_ATTEMPTS is 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
