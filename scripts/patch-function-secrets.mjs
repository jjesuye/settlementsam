/**
 * scripts/patch-function-secrets.mjs
 *
 * Fixes GMAIL_USER and GMAIL_APP_PASSWORD on the deployed Cloud Function:
 *   1. Removes them from plain environmentVariables
 *   2. Adds them as secretEnvironmentVariables (read from Secret Manager at runtime)
 *
 * Run: node scripts/patch-function-secrets.mjs
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg     = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token   = cfg.tokens?.access_token;

if (!token || (cfg.tokens?.expires_at ?? 0) < Date.now()) {
  console.error('Token expired. Run: firebase functions:secrets:access JWT_SECRET first');
  process.exit(1);
}

const PROJECT  = 'settlement-sam-77db2';
const LOCATION = 'us-central1';
const FUNCTION = 'ssrsettlementsam77db2';
const BASE_URL = `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${LOCATION}/functions/${FUNCTION}`;

// ── Get current function config ───────────────────────────────────────────────

console.log('Fetching current function config...');
const getRes  = await fetch(BASE_URL, { headers: { Authorization: `Bearer ${token}` } });
const current = await getRes.json();
if (!getRes.ok) { console.error('GET failed:', JSON.stringify(current.error)); process.exit(1); }

const plainEnvVars    = current.serviceConfig?.environmentVariables ?? {};
const existingSecrets = current.serviceConfig?.secretEnvironmentVariables ?? [];

console.log('Plain env vars containing GMAIL:', Object.keys(plainEnvVars).filter(k => k.includes('GMAIL')));
console.log('Existing secret refs:', existingSecrets.map(s => s.key));

// ── Build updated configs ─────────────────────────────────────────────────────

// Remove GMAIL vars from plain env vars
const updatedPlainEnvs = Object.fromEntries(
  Object.entries(plainEnvVars).filter(([k]) => k !== 'GMAIL_USER' && k !== 'GMAIL_APP_PASSWORD')
);

// Keep any existing secret refs that aren't GMAIL, then add the correct ones
const updatedSecretEnvs = [
  ...existingSecrets.filter(s => s.key !== 'GMAIL_USER' && s.key !== 'GMAIL_APP_PASSWORD'),
  { key: 'GMAIL_USER',         projectId: PROJECT, secret: 'GMAIL_USER',         version: 'latest' },
  { key: 'GMAIL_APP_PASSWORD', projectId: PROJECT, secret: 'GMAIL_APP_PASSWORD', version: 'latest' },
];

console.log('\nRemoving from plain env vars: GMAIL_USER, GMAIL_APP_PASSWORD');
console.log('Adding as secret refs:', updatedSecretEnvs.map(s => s.key));

// ── Single PATCH covering both fields ─────────────────────────────────────────

const patchBody = {
  serviceConfig: {
    environmentVariables:          updatedPlainEnvs,
    secretEnvironmentVariables:    updatedSecretEnvs,
  },
};

const updateMask = 'serviceConfig.environmentVariables,serviceConfig.secretEnvironmentVariables';

console.log('\nPatching function...');
const patchRes = await fetch(`${BASE_URL}?updateMask=${updateMask}`, {
  method:  'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body:    JSON.stringify(patchBody),
});
const op = await patchRes.json();
if (!patchRes.ok) {
  console.error('PATCH failed:', JSON.stringify(op.error, null, 2));
  process.exit(1);
}

console.log('Operation started:', op.name);
console.log('Polling for completion (up to 2.5 min)...');

// ── Poll the long-running operation ──────────────────────────────────────────

const opUrl = `https://cloudfunctions.googleapis.com/v2/${op.name}`;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const pollRes  = await fetch(opUrl, { headers: { Authorization: `Bearer ${token}` } });
  const pollData = await pollRes.json();
  if (pollData.done) {
    if (pollData.error) {
      console.error('\nOperation failed:', JSON.stringify(pollData.error, null, 2));
      process.exit(1);
    }
    console.log('\n✓ Done! GMAIL_USER and GMAIL_APP_PASSWORD now read from Secret Manager at runtime.');
    console.log('Test the live site — SMS should work now.');
    process.exit(0);
  }
  process.stdout.write('.');
}
console.log('\nTimed out polling — check Firebase console for operation status.');
