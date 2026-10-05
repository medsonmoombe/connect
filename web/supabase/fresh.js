/**
 * fresh.js — One-shot: migrate → reset → seed.
 *
 * Boots a clean database with the full schema applied, all data wiped
 * (except the platform admin), and the platform admin user created.
 *
 * Usage:
 *   node fresh.js
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongP@ss!' node fresh.js
 *
 * This will:
 *   1. Run all pending SQL migrations (idempotent)
 *   2. TRUNCATE all public tables, preserve platform admin
 *   3. Re-create the platform admin auth user + profile + membership
 *
 * Refuses to run without CONFIRM_RESET=1 in env (same guard as reset.js).
 */

const { spawnSync } = require('child_process');
const { join, resolve } = require('path');

const SUPABASE_DIR = resolve(__dirname);                            // web/supabase/
const WEB_DIR = resolve(join(SUPABASE_DIR, '..'));                  // web/

if (process.env.CONFIRM_RESET !== '1') {
  console.error('\x1b[31mRefusing to run without confirmation.\x1b[0m');
  console.error('This will TRUNCATE all application data and re-seed the platform admin.');
  console.error('Re-run with:');
  console.error('  CONFIRM_RESET=1 node fresh.js\n');
  process.exit(2);
}

function run(label, scriptPath, extraEnv = {}) {
  console.log(`\n\x1b[1m── ${label}\x1b[0m`);
  console.log(`   ${scriptPath}`);
  const res = spawnSync(process.execPath, [scriptPath], {
    cwd: WEB_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) {
    console.error(`\n\x1b[31m✗ ${label} failed (exit ${res.status})\x1b[0m`);
    process.exit(res.status || 1);
  }
}

async function main() {
  // 1. Migrations (migrate.mjs reads web/.env.local relative to its own dir,
  //    so we just point at it and let it find its config)
  run('Step 1/3 · Apply pending migrations', resolve(join(WEB_DIR, 'migrate.mjs')));

  // 2. Reset (wipe data, keep admin)
  run('Step 2/3 · Wipe application data', resolve(join(SUPABASE_DIR, 'reset.js')));

  // 3. Seed (ensure admin auth user + profile exist)
  run('Step 3/3 · Seed platform admin', resolve(join(SUPABASE_DIR, 'seed.js')));

  console.log('\n\x1b[32m✅ Database is fresh and ready.\x1b[0m\n');
}

main().catch(err => {
  console.error('Fresh failed:', err);
  process.exit(1);
});
