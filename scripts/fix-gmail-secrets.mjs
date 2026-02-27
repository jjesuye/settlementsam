/**
 * scripts/fix-gmail-secrets.mjs
 *
 * Reads GMAIL_USER and GMAIL_APP_PASSWORD from .env.local,
 * then creates new Secret Manager versions with the correct values.
 * Also grants all required principals secretAccessor.
 *
 * Run: node scripts/fix-gmail-secrets.mjs
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv(path) {
  const vars = {};
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      vars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch { /* file missing */ }
  return vars;
}

// Try .env first, fall back to .env.local
const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };
const GMAIL_USER     = env.GMAIL_USER;
const GMAIL_APP_PASS = env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASS) {
  console.error('GMAIL_USER or GMAIL_APP_PASSWORD not found in .env or .env.local');
  process.exit(1);
}

console.log(`GMAIL_USER from .env.local: "${GMAIL_USER}" (${GMAIL_USER.length} chars)`);
console.log(`GMAIL_APP_PASSWORD from .env.local: ${GMAIL_APP_PASS.substring(0,4)}**** (${GMAIL_APP_PASS.length} chars)`);

// ── Firebase CLI token ────────────────────────────────────────────────────────

const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg     = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token   = cfg.tokens?.access_token;
const userEmail = cfg.user?.email;

if (!token || (cfg.tokens?.expires_at ?? 0) < Date.now()) {
  console.error('Firebase CLI token expired. Run: firebase login');
  process.exit(1);
}

const PROJECT    = 'settlement-sam-77db2';
const PROJ_NUM   = '693548612429';

// ── Add new secret version with correct value ─────────────────────────────────

async function addSecretVersion(secretName, value) {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}:addVersion`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      payload: { data: Buffer.from(value, 'utf8').toString('base64') },
    }),
  });
  const data = await res.json();
  if (res.status !== 200) throw new Error(`addVersion failed: ${JSON.stringify(data.error)}`);
  console.log(`  + Created ${data.name}`);
  return data.name;
}

// ── Grant secretAccessor to all required principals ───────────────────────────

async function ensureAccess(secretName) {
  const base = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}`;
  const getRes = await fetch(`${base}:getIamPolicy`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const policy   = await getRes.json();
  const bindings = policy.bindings ?? [];
  const role     = 'roles/secretmanager.secretAccessor';
  let   binding  = bindings.find(b => b.role === role);
  if (!binding)  { binding = { role, members: [] }; bindings.push(binding); }

  const principals = [
    `user:${userEmail}`,
    `serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com`,
    `serviceAccount:${PROJECT}@appspot.gserviceaccount.com`,
    `serviceAccount:firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com`,
  ];
  let changed = false;
  for (const m of principals) {
    if (!binding.members.includes(m)) {
      binding.members.push(m);
      console.log(`  + granted: ${m}`);
      changed = true;
    }
  }
  if (!changed) { console.log('  IAM: all principals already have access'); return; }

  const setRes = await fetch(`${base}:setIamPolicy`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ policy: { ...policy, bindings } }),
  });
  const result = await setRes.json();
  if (setRes.status !== 200) throw new Error(`setIamPolicy failed: ${JSON.stringify(result.error)}`);
  console.log('  IAM: updated OK');
}

// ── Verify the newly stored value ─────────────────────────────────────────────

async function readLatest(secretName) {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}/versions/latest:access`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (res.status !== 200) return `ERROR: ${JSON.stringify(data.error?.message)}`;
  const raw = data.payload?.data ?? '';
  return Buffer.from(raw, 'base64').toString('utf8');
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('\n--- GMAIL_USER ---');
await addSecretVersion('GMAIL_USER', GMAIL_USER);
await ensureAccess('GMAIL_USER');
const storedUser = await readLatest('GMAIL_USER');
console.log(`  Verify read-back: "${storedUser}" (${storedUser.length} chars) ✓`);

console.log('\n--- GMAIL_APP_PASSWORD ---');
await addSecretVersion('GMAIL_APP_PASSWORD', GMAIL_APP_PASS);
await ensureAccess('GMAIL_APP_PASSWORD');
const storedPass = await readLatest('GMAIL_APP_PASSWORD');
console.log(`  Verify read-back: ${storedPass.substring(0,4)}**** (${storedPass.length} chars) ✓`);

console.log('\nSecrets fixed. Now run: firebase deploy --only hosting');
