/**
 * scripts/read-secrets.mjs
 * Read the raw bytes of the GMAIL secrets to verify format.
 * Run: node scripts/read-secrets.mjs
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg     = JSON.parse(readFileSync(cfgPath, 'utf8'));
const token   = cfg.tokens?.access_token;
const PROJECT = 'settlement-sam-77db2';

for (const name of ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'JWT_SECRET']) {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${name}/versions/latest:access`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (res.status !== 200) {
    console.log(`${name}: ERROR ${res.status} — ${JSON.stringify(data.error?.message)}`);
    continue;
  }
  const raw = data.payload?.data;
  if (!raw) { console.log(`${name}: NO PAYLOAD DATA`); continue; }
  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  const preview = name === 'GMAIL_APP_PASSWORD'
    ? decoded.substring(0, 4) + '****'
    : decoded;
  console.log(`${name}: "${preview}" (${decoded.length} chars)`);
}
