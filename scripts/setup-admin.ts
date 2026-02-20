#!/usr/bin/env ts-node
/**
 * scripts/setup-admin.ts
 *
 * Creates or updates the admin account in the Firestore 'admins' collection.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env (or prompts interactively).
 * Hashes the password with bcryptjs and saves to Firestore.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/setup-admin.ts
 */

import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// Load .env manually (ts-node doesn't auto-load it)
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  for (const p of [envPath, envLocalPath]) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf-8').split('\n');
      for (const line of lines) {
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

  // Get email
  let email = process.env.ADMIN_EMAIL ?? '';
  if (!email) {
    email = await prompt('Admin email address: ');
  } else {
    console.log(`Using ADMIN_EMAIL from env: ${email}`);
  }
  if (!email.includes('@')) {
    console.error('❌ Invalid email address.'); process.exit(1);
  }

  // Get password
  let password = process.env.ADMIN_PASSWORD ?? '';
  if (!password) {
    password = await prompt('Admin password (min 12 chars): ', true);
    if (password.length < 12) {
      console.error('❌ Password must be at least 12 characters.'); process.exit(1);
    }
    const confirm = await prompt('Confirm password: ', true);
    if (password !== confirm) {
      console.error('❌ Passwords do not match.'); process.exit(1);
    }
  } else {
    console.log('Using ADMIN_PASSWORD from env.');
  }

  console.log('\n⏳ Hashing password…');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  console.log('⏳ Connecting to Firestore…');

  // Dynamically import Firebase Admin after env is loaded
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

  // Upsert admin document
  const existing = await db.collection('admins').where('email', '==', email).limit(1).get();

  if (!existing.empty) {
    await existing.docs[0].ref.update({ password_hash: passwordHash, updated_at: Date.now() });
    console.log(`\n✅ Admin account updated in Firestore for ${email}`);
  } else {
    await db.collection('admins').add({
      email,
      password_hash: passwordHash,
      created_at:    Date.now(),
    });
    console.log(`\n✅ Admin account created in Firestore for ${email}`);
  }

  const jwtSecret = require('crypto').randomBytes(48).toString('hex');

  console.log('\n─'.repeat(60));
  console.log('Also add these to your .env / Railway environment variables:\n');
  console.log(`ADMIN_EMAIL=${email}`);
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log('─'.repeat(60));
  console.log('\n✅ Done. Restart the server to apply changes.\n');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
