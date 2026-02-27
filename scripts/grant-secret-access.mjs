/**
 * scripts/grant-secret-access.mjs
 *
 * Grants the Cloud Functions Gen 2 / Compute Engine default service account
 * secretmanager.secretAccessor access on GMAIL_USER and GMAIL_APP_PASSWORD.
 *
 * Uses the Firebase CLI's cached access token (already authenticated user).
 *
 * Run once: node scripts/grant-secret-access.mjs
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ── Load Firebase CLI cached token ────────────────────────────────────────────

const cfgPath  = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg      = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token    = cfg.tokens?.access_token;
const expiresAt = cfg.tokens?.expires_at ?? 0;

if (!token || expiresAt < Date.now()) {
  console.error('Firebase CLI token missing or expired. Run: firebase login');
  process.exit(1);
}

const PROJECT_ID     = 'settlement-sam-77db2';
const PROJECT_NUMBER = '693548612429';

// Cloud Functions Gen 2 runs as the Compute Engine default service account.
// Also grant to the legacy AppEngine SA as a fallback.
const SERVICE_ACCOUNTS = [
  `${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`,
  `${PROJECT_ID}@appspot.gserviceaccount.com`,
];

// ── Grant secretAccessor on a single secret ───────────────────────────────────

async function grantAccess(secretName) {
  const base = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretName}`;

  const getRes = await fetch(`${base}:getIamPolicy`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const policy = await getRes.json();
  if (getRes.status !== 200) {
    throw new Error(`getIamPolicy failed (${getRes.status}): ${JSON.stringify(policy.error)}`);
  }

  const bindings = policy.bindings ?? [];
  const role     = 'roles/secretmanager.secretAccessor';
  let binding    = bindings.find(b => b.role === role);
  if (!binding) {
    binding = { role, members: [] };
    bindings.push(binding);
  }

  for (const sa of SERVICE_ACCOUNTS) {
    const member = `serviceAccount:${sa}`;
    if (binding.members.includes(member)) {
      console.log(`  already has access: ${sa}`);
    } else {
      binding.members.push(member);
      console.log(`  + granted: ${sa}`);
    }
  }

  const setRes = await fetch(`${base}:setIamPolicy`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ policy: { ...policy, bindings } }),
  });
  const result = await setRes.json();
  if (setRes.status !== 200) {
    throw new Error(`setIamPolicy failed (${setRes.status}): ${JSON.stringify(result.error)}`);
  }
  console.log(`  OK: ${secretName}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`Project: ${PROJECT_ID} (${PROJECT_NUMBER})\n`);

  for (const secret of ['GMAIL_USER', 'GMAIL_APP_PASSWORD']) {
    console.log(`${secret}:`);
    await grantAccess(secret);
    console.log();
  }

  console.log('Access granted. Redeploy for changes to take effect.');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
