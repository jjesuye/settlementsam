/**
 * scripts/patch-cloudrun-secrets.mjs
 *
 * Patches the Cloud Run service to bind GMAIL_USER and GMAIL_APP_PASSWORD
 * as proper Secret Manager references instead of plain empty env vars.
 *
 * Run: node scripts/patch-cloudrun-secrets.mjs
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg     = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token   = cfg.tokens?.access_token;

if (!token || (cfg.tokens?.expires_at ?? 0) < Date.now()) {
  console.error('Firebase CLI token expired. Run: firebase login');
  process.exit(1);
}

const PROJECT_ID     = 'settlement-sam-77db2';
const PROJECT_NUMBER = '693548612429';
const REGION         = 'us-central1';
const SERVICE        = 'ssrsettlementsam77db2';

// Secrets to bind: env var name → Secret Manager secret name
const SECRET_BINDINGS = {
  GMAIL_USER:         'GMAIL_USER',
  GMAIL_APP_PASSWORD: 'GMAIL_APP_PASSWORD',
  JWT_SECRET:         'JWT_SECRET',
  ADMIN_PASSWORD_HASH:'ADMIN_PASSWORD_HASH',
  STRIPE_SECRET_KEY:  'STRIPE_SECRET_KEY',
};

const baseUrl = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${SERVICE}`;

// ── Fetch current service ─────────────────────────────────────────────────────

const getRes = await fetch(baseUrl, {
  headers: { Authorization: `Bearer ${token}` },
});
const service = await getRes.json();
if (!getRes.ok) {
  console.error('Failed to get service:', JSON.stringify(service.error));
  process.exit(1);
}

console.log('Current env vars:');
const container  = service.template.containers[0];
const currentEnv = container.env ?? [];

for (const e of currentEnv) {
  if (e.valueSource?.secretKeyRef) {
    console.log(`  ${e.name} => SECRET:${e.valueSource.secretKeyRef.secret}@${e.valueSource.secretKeyRef.version}`);
  } else {
    const preview = e.value ? e.value.substring(0, 30) : '<empty>';
    console.log(`  ${e.name} => plain: "${preview}"`);
  }
}

// ── Build updated env array ───────────────────────────────────────────────────

// Keep all existing env vars; replace or add secret bindings
const newEnv = currentEnv.map(e => {
  if (SECRET_BINDINGS[e.name]) {
    console.log(`\n  Binding ${e.name} → Secret Manager:${SECRET_BINDINGS[e.name]}`);
    return {
      name: e.name,
      valueSource: {
        secretKeyRef: {
          secret:  `projects/${PROJECT_NUMBER}/secrets/${SECRET_BINDINGS[e.name]}`,
          version: 'latest',
        },
      },
    };
  }
  return e;
});

// Add any bindings not yet in the env at all
for (const [envName, secretName] of Object.entries(SECRET_BINDINGS)) {
  if (!newEnv.find(e => e.name === envName)) {
    console.log(`\n  Adding new binding ${envName} → Secret Manager:${secretName}`);
    newEnv.push({
      name: envName,
      valueSource: {
        secretKeyRef: {
          secret:  `projects/${PROJECT_NUMBER}/secrets/${secretName}`,
          version: 'latest',
        },
      },
    });
  }
}

// ── Patch the service ─────────────────────────────────────────────────────────
// Strip revision name/suffix so Cloud Run auto-generates a new revision

const templatePatch = { ...service.template };
delete templatePatch.revision;        // avoid 409 "revision already exists"
delete templatePatch.revisionSuffix;

const patch = {
  template: {
    ...templatePatch,
    containers: [
      {
        ...container,
        env: newEnv,
      },
    ],
  },
};

console.log('\nPatching Cloud Run service...');

const patchRes = await fetch(`${baseUrl}?updateMask=template.containers`, {
  method:  'PATCH',
  headers: {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(patch),
});

const patchResult = await patchRes.json();
if (!patchRes.ok) {
  console.error('Patch failed:', JSON.stringify(patchResult.error, null, 2));
  process.exit(1);
}

console.log('\nPatch submitted — operation:', patchResult.name ?? 'unknown');
console.log('Cloud Run will roll out a new revision. Wait ~30s then test.');
