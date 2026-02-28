import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const token = cfg.tokens?.access_token;

// Check Cloud Run service directly (v2 API)
const res = await fetch('https://run.googleapis.com/v2/projects/settlement-sam-77db2/locations/us-central1/services/ssrsettlementsam77db2', {
  headers: { Authorization: `Bearer ${token}` }
});
const d = await res.json();

if (!res.ok) {
  console.error('Error:', JSON.stringify(d.error, null, 2));
  process.exit(1);
}

const containers = d.template?.containers || [];
const c = containers[0] || {};
const env = c.env || [];

console.log('=== Cloud Run service env vars (GMAIL only) ===');
const gmailEnvs = env.filter(e => e.name && e.name.includes('GMAIL'));
if (gmailEnvs.length === 0) {
  console.log('No GMAIL env vars in Cloud Run template');
} else {
  gmailEnvs.forEach(e => console.log(JSON.stringify(e, null, 2)));
}

console.log('\n=== Traffic ===');
console.log(d.traffic?.map(t => `${t.revision}: ${t.percent}%`));

console.log('\n=== Latest ready revision ===');
console.log(d.latestReadyRevision);
console.log(d.latestCreatedRevision);
