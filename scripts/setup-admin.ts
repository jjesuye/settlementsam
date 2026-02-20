#!/usr/bin/env ts-node
/**
 * scripts/setup-admin.ts
 *
 * Creates or updates the admin account in the Firestore 'admins' collection.
 * Prompts for username and password interactively.
 * Hashes the password with bcryptjs and saves to Firestore.
 *
 * Usage:
 *   npm run admin:setup
 */

import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// Load .env and .env.local manually (ts-node doesn't auto-load them)
function loadEnv() {
  const files = ['.env', '.env.local'];
  for (const file of files) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function prompt(question: string, isSecret = false): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (isSecret) {
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let pw = '';
      process.stdin.on('data', (key: Buffer) => {
        const char = key.toString();
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode?.(false);
          process.stdout.write('\n');
          rl.close();
          resolve(pw);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007f') {
          if (pw.length > 0) { pw = pw.slice(0, -1); process.stdout.write('\b \b'); }
        } else {
          pw += char;
          process.stdout.write('*');
        }
      });
      process.stdin.resume();
    } else {
      rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
    }
  });
}

async function main() {
  loadEnv();

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Settlement Sam — Admin Setup (Firebase) ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Get username
  const username = await prompt('Admin username: ');
  if (!username || username.length < 3) {
    console.error('❌ Username must be at least 3 characters.'); process.exit(1);
  }

  // Get password
  const password = await prompt('Admin password (min 12 chars): ', true);
  if (password.length < 12) {
    console.error('❌ Password must be at least 12 characters.'); process.exit(1);
  }
  const confirm = await prompt('Confirm password: ', true);
  if (password !== confirm) {
    console.error('❌ Passwords do not match.'); process.exit(1);
  }

  console.log('\n⏳ Hashing password…');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  console.log('⏳ Connecting to Firestore…');

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      }),
    });
  }

  const db = getFirestore();

  // Upsert by username
  const existing = await db.collection('admins').where('username', '==', username).limit(1).get();

  if (!existing.empty) {
    await existing.docs[0].ref.update({ password_hash: passwordHash, updated_at: Date.now() });
    console.log(`\n✅ Admin account updated for username: ${username}`);
  } else {
    await db.collection('admins').add({
      username,
      password_hash: passwordHash,
      created_at:    Date.now(),
    });
    console.log(`\n✅ Admin account created for username: ${username}`);
  }

  console.log('\n✅ Done. You can now log in at /admin/login\n');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
