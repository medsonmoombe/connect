#!/usr/bin/env node
/**
 * migrate.js — Run SQL migration files against Supabase database.
 *
 * Usage:
 *   node migrate.js              # run all pending migrations
 *   node migrate.js --status     # show which migrations have been applied
 *   node migrate.js 004          # run a specific migration by prefix
 *
 * Requires DATABASE_URL in web/.env.local or environment.
 * Get it from: Supabase Dashboard → Settings → Database → Connection string → URI
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'supabase', 'migrations');

// ── Load env vars from .env.local ────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found — rely on environment variables
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('\x1b[31mERROR: DATABASE_URL not set.\x1b[0m');
  console.error('\nAdd it to web/.env.local or set it as an environment variable.');
  console.error('Get the connection string from:');
  console.error('  Supabase Dashboard → Settings → Database → Connection string → URI');
  console.error('  Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres\n');
  process.exit(1);
}

// ── Lazy-import pg (node-postgres) ───────────────────────────────────────────
let pgModule;
try {
  pgModule = await import('pg');
} catch {
  console.error('\x1b[31mERROR: pg package not installed.\x1b[0m');
  console.error('Run: npm install pg\n');
  process.exit(1);
}
const { Pool } = pgModule;

// ── Migration table for tracking ─────────────────────────────────────────────
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  applied_at timestamptz DEFAULT now()
);`;

/**
 * Split a SQL script into top-level statements.
 *
 * Tracks:
 *   - line comments       (-- ... to end of line)
 *   - single-quoted text  ('...' with '' as the escape)
 *   - double-quoted idents ("...")
 *   - dollar-quoted text  ($tag$ ... $tag$ — also handles bare $$ ... $$)
 *
 * A ';' is only treated as a statement terminator when it appears outside
 * any of the above.
 */
function splitSqlStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  const n = sql.length;

  // Current quote context. null = not in any quote.
  let mode = null;            // 'line' | 'squote' | 'dquote' | 'dollar'
  let dollarTag = '';         // e.g. '$$' or '$tag$'
  let pendingDollar = null;   // tag candidate seen as we walk (no whitespace check)

  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];

    if (mode === 'line') {
      buf += c;
      if (c === '\n') mode = null;
      i++;
      continue;
    }

    if (mode === 'squote') {
      buf += c;
      if (c === "'") {
        if (c2 === "'") { buf += c2; i += 2; continue; } // escaped quote
        mode = null;
      }
      i++;
      continue;
    }

    if (mode === 'dquote') {
      buf += c;
      if (c === '"') mode = null;
      i++;
      continue;
    }

    if (mode === 'dollar') {
      buf += c;
      if (c === '$' && sql.startsWith(dollarTag, i)) {
        buf += dollarTag.slice(1); // already added first $
        i += dollarTag.length - 1;
        mode = null;
        dollarTag = '';
      }
      i++;
      continue;
    }

    // mode === null — scan for next interesting character
    if (c === '-' && c2 === '-') {
      mode = 'line';
      buf += c + c2;
      i += 2;
      continue;
    }
    if (c === "'") {
      mode = 'squote';
      buf += c;
      i++;
      continue;
    }
    if (c === '"') {
      mode = 'dquote';
      buf += c;
      i++;
      continue;
    }
    if (c === '$') {
      // Try to read a dollar-quote tag: $[word]$ where word = [A-Za-z_][A-Za-z0-9_]*
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j++;
      if (sql[j] === '$') {
        dollarTag = sql.slice(i, j + 1); // includes both $...$
        mode = 'dollar';
        buf += dollarTag;
        i = j + 1;
        continue;
      }
    }

    if (c === ';') {
      const trimmed = buf.trim();
      if (trimmed.length > 0) out.push(trimmed);
      buf = '';
      i++;
      continue;
    }

    buf += c;
    i++;
  }

  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

// ── Get list of SQL files sorted ─────────────────────────────────────────────
function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

// ── Get applied migrations from DB ───────────────────────────────────────────
async function getApplied(pool) {
  try {
    const { rows } = await pool.query('SELECT name FROM _migrations ORDER BY id');
    return new Set(rows.map(r => r.name));
  } catch {
    return new Set();
  }
}

// ── Run a single migration ───────────────────────────────────────────────────
async function runMigration(pool, filename) {
  const filepath = join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(filepath, 'utf8');

  console.log(`\x1b[36m▶ Applying:\x1b[0m ${filename}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(CREATE_TABLE_SQL);

    // Split SQL into top-level statements.
    // We can't just split on ';' because PL/pgSQL DO $$ ... $$ blocks
    // contain semicolons that aren't statement terminators. This splitter
    // skips over:
    //   - line comments      (-- ...)
    //   - single-quoted strings ('...''s are escaped via doubled quotes)
    //   - double-quoted identifiers ("...")
    //   - dollar-quoted strings ($$ ... $$)
    // A ';' outside any of those is a statement terminator.
    const statements = splitSqlStatements(sql);

    let applied = 0;
    let skipped = 0;

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        applied++;
      } catch (err) {
        // "already exists" / "duplicate" / "does not exist" → skip gracefully
        if (
          err.code === '42710' ||  // duplicate_object
          err.code === '42P07' ||  // duplicate_table
          err.code === '42701' ||  // duplicate_column
          err.code === '23505' ||  // unique_violation
          err.message?.includes('already exists') ||
          err.message?.includes('does not exist') ||
          err.message?.includes('duplicate')
        ) {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    await client.query(
      `INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [filename]
    );
    await client.query('COMMIT');

    console.log(`  \x1b[32m✓\x1b[0m Applied ${applied} statements, ${skipped} skipped (already exists)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  \x1b[31m✗\x1b[0m Failed: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const showStatus = args.includes('--status');
  const filter = args.find(a => !a.startsWith('--'));

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    // Ensure migration tracking table exists
    await pool.query(CREATE_TABLE_SQL);

    const files = getMigrationFiles();
    const applied = await getApplied(pool);

    if (showStatus) {
      console.log('\n\x1b[1mMigration Status\x1b[0m\n');
      for (const f of files) {
        const status = applied.has(f)
          ? '\x1b[32m✓ applied\x1b[0m'
          : '\x1b[33m○ pending\x1b[0m';
        console.log(`  ${status}  ${f}`);
      }
      console.log('');
      return;
    }

    const pending = files.filter(f => {
      if (applied.has(f)) return false;
      if (filter && !f.startsWith(filter)) return false;
      return true;
    });

    if (pending.length === 0) {
      console.log('\x1b[32mAll migrations already applied.\x1b[0m\n');
      return;
    }

    console.log(`\n\x1b[1mRunning ${pending.length} migration(s)...\x1b[0m`);

    for (const file of pending) {
      await runMigration(pool, file);
    }

    console.log('\n\x1b[32mDone!\x1b[0m\n');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n\x1b[31mMigration failed:\x1b[0m', err.message);
  process.exit(1);
});
