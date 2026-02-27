/**
 * scripts/check-secret-iam.mjs
 * Shows the IAM policy for GMAIL_USER and GMAIL_APP_PASSWORD secrets,
 * then grants the Firebase user account secretAccessor if missing.
 *
 * Run: node scripts/check-secret-iam.mjs
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg     = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token   = cfg.tokens?.access_token;
const userEmail = cfg.user?.email;

if (!token || (cfg.tokens?.expires_at ?? 0) < Date.now()) {
  console.error('Firebase CLI token expired. Run: firebase login'); process.exit(1);
}

const PROJECT_ID     = 'settlement-sam-77db2';
const PROJECT_NUMBER = '693548612429';
const SECRETS        = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];

// Firebase deploy reads secrets using the user's oauth token.
// The user account needs secretmanager.secretAccessor on these secrets.
const MEMBERS_TO_GRANT = [
  `user:${userEmail}`,
  `serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`,
  `serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com`,
  // Firebase deployer service account
  `serviceAccount:firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com`,
];

async function showAndFixPolicy(secretName) {
  const base = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretName}`;

  const getRes = await fetch(`${base}:getIamPolicy`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const policy = await getRes.json();
  if (getRes.status !== 200) {
    console.error(`  getIamPolicy failed (${getRes.status}):`, JSON.stringify(policy.error));
    return;
  }

  console.log(`  Current policy bindings: ${JSON.stringify(policy.bindings ?? [])}`);

  const bindings = policy.bindings ?? [];
  const role     = 'roles/secretmanager.secretAccessor';
  let binding    = bindings.find(b => b.role === role);
  if (!binding)  { binding = { role, members: [] }; bindings.push(binding); }

  let changed = false;
  for (const m of MEMBERS_TO_GRANT) {
    if (!binding.members.includes(m)) {
      binding.members.push(m);
      console.log(`  + granting: ${m}`);
      changed = true;
    } else {
      console.log(`  already has: ${m}`);
    }
  }

  if (!changed) { console.log('  No changes needed.'); return; }

  const setRes = await fetch(`${base}:setIamPolicy`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ policy: { ...policy, bindings } }),
  });
  const result = await setRes.json();
  if (setRes.status !== 200) {
    console.error(`  setIamPolicy failed:`, JSON.stringify(result.error));
  } else {
    console.log(`  Policy updated OK`);
  }
}

console.log(`User: ${userEmail}\n`);
for (const s of SECRETS) {
  console.log(`${s}:`);
  await showAndFixPolicy(s);
  console.log();
}

console.log('Done. Now run: firebase deploy --only hosting');
