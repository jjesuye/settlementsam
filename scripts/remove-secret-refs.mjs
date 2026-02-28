/**
 * scripts/remove-secret-refs.mjs
 *
 * Removes secretEnvironmentVariables for GMAIL_USER and GMAIL_APP_PASSWORD
 * from the Cloud Function config so Firebase can deploy them as plain env vars.
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token = cfg.tokens?.access_token;

if (!token) { console.error('No access_token. Run: firebase functions:secrets:access JWT_SECRET'); process.exit(1); }

const PROJECT = 'settlement-sam-77db2';
const LOCATION = 'us-central1';
const FUNCTION = 'ssrsettlementsam77db2';
const BASE_URL = `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${LOCATION}/functions/${FUNCTION}`;

// Get current config
const getRes = await fetch(BASE_URL, { headers: { Authorization: `Bearer ${token}` } });
const current = await getRes.json();
if (!getRes.ok) { console.error('GET failed:', current.error); process.exit(1); }

const existingSecrets = current.serviceConfig?.secretEnvironmentVariables ?? [];
const existingPlain = current.serviceConfig?.environmentVariables ?? {};
console.log('Current secret refs:', existingSecrets.map(s => s.key));
console.log('Current plain GMAIL env vars:', Object.keys(existingPlain).filter(k => k.includes('GMAIL')));

// Remove GMAIL_USER and GMAIL_APP_PASSWORD from secret refs
const updatedSecretEnvs = existingSecrets.filter(
  s => s.key !== 'GMAIL_USER' && s.key !== 'GMAIL_APP_PASSWORD'
);
console.log('After removal, secret refs:', updatedSecretEnvs.map(s => s.key));

// Patch: update secretEnvironmentVariables only
const patchRes = await fetch(`${BASE_URL}?updateMask=serviceConfig.secretEnvironmentVariables`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceConfig: { secretEnvironmentVariables: updatedSecretEnvs },
  }),
});
const op = await patchRes.json();
if (!patchRes.ok) {
  console.error('PATCH failed:', JSON.stringify(op.error, null, 2));
  process.exit(1);
}

console.log('Operation started:', op.name);
console.log('Polling...');

const opUrl = `https://cloudfunctions.googleapis.com/v2/${op.name}`;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const pollRes = await fetch(opUrl, { headers: { Authorization: `Bearer ${token}` } });
  const pollData = await pollRes.json();
  if (pollData.done) {
    if (pollData.error) {
      console.error('Operation failed:', JSON.stringify(pollData.error, null, 2));
      process.exit(1);
    }
    console.log('\n✓ Secret refs for GMAIL_USER and GMAIL_APP_PASSWORD removed.');
    console.log('Now run: firebase deploy --only hosting');
    process.exit(0);
  }
  process.stdout.write('.');
}
console.log('\nTimed out — check Firebase console.');
