/**
 * scripts/set-gmail-user.mjs
 * Uses the Firebase CLI refresh token to get a fresh access token,
 * then stores GMAIL_USER correctly in Secret Manager with full IAM.
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

const cfgPath   = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg       = JSON.parse(readFileSync(cfgPath, 'utf8'));
const userEmail = cfg.user?.email;

// ── Refresh the access token ──────────────────────────────────────────────────

async function getFreshToken() {
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error('No refresh_token in firebase-tools.json');

  // Firebase CLI uses Google OAuth2 with a fixed client ID/secret for the CLI
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8vu8aXm0pOPlG5A95',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  console.log('Fresh access token obtained.');
  return data.access_token;
}

const token    = await getFreshToken();
const PROJECT  = 'settlement-sam-77db2';
const PROJ_NUM = '693548612429';

const PRINCIPALS = [
  `user:${userEmail}`,
  `serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com`,
  `serviceAccount:${PROJECT}@appspot.gserviceaccount.com`,
  `serviceAccount:firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com`,
];

async function addVersion(secretName, value) {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}:addVersion`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ payload: { data: Buffer.from(value).toString('base64') } }),
  });
  const data = await res.json();
  if (res.status !== 200) throw new Error(`addVersion: ${JSON.stringify(data.error)}`);
  console.log(`  Created: ${data.name}`);
}

async function ensureIAM(secretName) {
  const base   = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}`;
  const getRes = await fetch(`${base}:getIamPolicy`, { headers: { Authorization: `Bearer ${token}` } });
  const policy = await getRes.json();
  if (getRes.status !== 200) throw new Error(`getIamPolicy: ${JSON.stringify(policy.error)}`);
  const role   = 'roles/secretmanager.secretAccessor';
  const bindings = policy.bindings ?? [];
  let binding  = bindings.find(b => b.role === role);
  if (!binding) { binding = { role, members: [] }; bindings.push(binding); }
  let changed  = false;
  for (const m of PRINCIPALS) {
    if (!binding.members.includes(m)) { binding.members.push(m); console.log(`  + IAM: ${m}`); changed = true; }
  }
  if (!changed) { console.log('  IAM already complete'); return; }
  const setRes = await fetch(`${base}:setIamPolicy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy: { ...policy, bindings } }),
  });
  if (setRes.status !== 200) { const e = await setRes.json(); throw new Error(JSON.stringify(e.error)); }
  console.log('  IAM updated.');
}

async function readBack(secretName) {
  const url  = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}/versions/latest:access`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (res.status !== 200) return `ERROR: ${JSON.stringify(data.error?.message)}`;
  return Buffer.from(data.payload?.data ?? '', 'base64').toString('utf8');
}

console.log('\n--- GMAIL_USER ---');
await addVersion('GMAIL_USER', 'settlementsam.verify@gmail.com');
await ensureIAM('GMAIL_USER');
const v = await readBack('GMAIL_USER');
console.log(`  Verified: "${v}" (${v.length} chars)`);

console.log('\n--- GMAIL_APP_PASSWORD (checking current value) ---');
await ensureIAM('GMAIL_APP_PASSWORD');
const p = await readBack('GMAIL_APP_PASSWORD');
console.log(`  Current value: ${p.trim().length} chars, trimmed: "${p.trim().substring(0,4)}${p.trim().length > 4 ? '****' : '(empty)'}"`);

console.log('\nDone. If GMAIL_APP_PASSWORD is still empty, run:');
console.log('  firebase functions:secrets:set GMAIL_APP_PASSWORD');
