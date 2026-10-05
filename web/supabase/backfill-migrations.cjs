/**
 * backfill-migrations.js — Mark every migration in web/supabase/migrations/
 * as already applied in the _migrations table.
 *
 * Use only when:
 *   - The schema is already in place (tables exist)
 *   - But _migrations is empty (schema was applied via Supabase SQL editor
 *     or a previous run of a different migration tool).
 *
 * This lets `db:reset` work on an existing DB without trying to re-apply
 * migrations that would either fail (e.g. dirty seed data) or are no-ops.
 *
 * Reads DATABASE_URL from ../.env.local.
 */

const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');

// __dirname is provided by the CommonJS wrapper.
const MIGRATIONS_DIR = join(__dirname, 'migrations');

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('\x1b[31mERROR: DATABASE_URL not set in web/.env.local.\x1b[0m');
  process.exit(1);
}

if (process.argv[2] !== '--confirm') {
  console.log('This will insert every file in web/supabase/migrations/ into the _migrations table');
  console.log('without running any of them. Use only when the schema is already in place.');
  console.log('');
  console.log('Re-run with:  node backfill-migrations.js --confirm');
  process.exit(2);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
client
  .connect()
  .then(async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz DEFAULT now()
      );
    `);
    let inserted = 0;
    for (const f of files) {
      const { rowCount } = await client.query(
        'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [f]
      );
      if (rowCount) inserted++;
    }
    console.log(`\x1b[32m✓\x1b[0m Recorded ${files.length} migrations (${inserted} new, ${files.length - inserted} already present).`);
    await client.end();
  })
  .catch((e) => {
    console.error('\x1b[31mBackfill failed:\x1b[0m', e.message);
    process.exit(1);
  });
