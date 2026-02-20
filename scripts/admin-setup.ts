#!/usr/bin/env ts-node
/**
 * scripts/admin-setup.ts
 *
 * CLI tool for admin credential management.
 * Run with: npx ts-node scripts/admin-setup.ts [command]
 *
 * Commands:
 *   setup          Interactive first-run wizard — prints env vars to set
 *   hash-password  Hash a password and print the ADMIN_PASSWORD_HASH value
 *   reset-password Same as hash-password but with a reset-focused prompt
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/admin-setup.ts setup
 *   npx ts-node --project tsconfig.json scripts/admin-setup.ts hash-password
 *   npx ts-node --project tsconfig.json scripts/admin-setup.ts reset-password
 */

import * as readline from 'readline';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

function prompt(question: string, isSecret = false): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (isSecret) {
      // Hide input for passwords (stdout mute hack)
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

async function hashPassword(password: string): Promise<string> {
  console.log('\n⏳ Hashing password (this takes a moment)…');
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

async function commandSetup() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Settlement Sam — Admin Setup Wizard    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const email = await prompt('Admin email address: ');
  if (!email.includes('@')) {
    console.error('❌ Invalid email address.'); process.exit(1);
  }

  const pw1 = await prompt('Admin password (min 12 chars): ', true);
  if (pw1.length < 12) {
    console.error('❌ Password must be at least 12 characters.'); process.exit(1);
  }

  const pw2 = await prompt('Confirm password: ', true);
  if (pw1 !== pw2) {
    console.error('❌ Passwords do not match.'); process.exit(1);
  }

  const hash = await hashPassword(pw1);

  const secret = require('crypto').randomBytes(48).toString('hex');

  console.log('\n✅ Setup complete! Add these variables to your .env file:\n');
  console.log('─'.repeat(60));
  console.log(`ADMIN_EMAIL=${email}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`JWT_SECRET=${secret}`);
  console.log('─'.repeat(60));
  console.log('\n⚠️  Never commit .env to version control.');
  console.log('✅  Restart the server after updating .env.\n');
}

async function commandHashPassword(isReset = false) {
  if (isReset) {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   Settlement Sam — Admin Password Reset  ║');
    console.log('╚══════════════════════════════════════════╝\n');
  } else {
    console.log('\n⚖  Settlement Sam — Password Hasher\n');
  }

  const pw1 = await prompt('New password (min 12 chars): ', true);
  if (pw1.length < 12) {
    console.error('❌ Password must be at least 12 characters.'); process.exit(1);
  }

  const pw2 = await prompt('Confirm password: ', true);
  if (pw1 !== pw2) {
    console.error('❌ Passwords do not match.'); process.exit(1);
  }

  const hash = await hashPassword(pw1);

  console.log('\n✅ Update your .env file with:\n');
  console.log('─'.repeat(60));
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('─'.repeat(60));
  console.log('\n✅  Restart the server after updating .env.\n');
}

// ── Entry point ──────────────────────────────────────────────────────────────

const cmd = process.argv[2] ?? 'setup';

switch (cmd) {
  case 'setup':
    commandSetup().catch(e => { console.error(e); process.exit(1); });
    break;
  case 'hash-password':
    commandHashPassword(false).catch(e => { console.error(e); process.exit(1); });
    break;
  case 'reset-password':
    commandHashPassword(true).catch(e => { console.error(e); process.exit(1); });
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Usage: ts-node scripts/admin-setup.ts [setup | hash-password | reset-password]');
    process.exit(1);
}
