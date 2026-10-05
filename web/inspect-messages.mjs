import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
try {
  const content = readFileSync(join(__dirname, '.env.local'), 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('NO DATABASE_URL'); process.exit(1); }

const { Pool } = await import('pg');
const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  // 1. messages column types
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages'
      AND column_name IN ('sender_id','deleted_by')
    ORDER BY column_name;
  `);
  console.log('\n=== messages columns ===');
  console.table(cols.rows);

  // 2. FKs on messages
  const fks = await pool.query(`
    SELECT con.conname, a.attname AS column_name,
           refcl.relname AS references_table,
           af.attname AS references_column
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class refcl ON refcl.oid = con.confrelid
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = con.confkey[1]
    WHERE cl.relname = 'messages' AND con.contype = 'f';
  `);
  console.log('\n=== messages FKs ===');
  console.table(fks.rows);

  // 3. user_profiles FK target
  const up = await pool.query(`
    SELECT con.conname, refcl.relname AS references_table,
           af.attname AS references_column
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class refcl ON refcl.oid = con.confrelid
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE cl.relname = 'user_profiles' AND con.contype = 'f';
  `);
  console.log('\n=== user_profiles FKs ===');
  console.table(up.rows);

  // 4. user_profiles.id type
  const upid = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles' AND column_name='id';
  `);
  console.log('\n=== user_profiles.id type ===');
  console.table(upid.rows);

  // 5. sample sender_id values
  const sample = await pool.query(`
    SELECT sender_id, pg_typeof(sender_id)::text AS typ FROM messages LIMIT 5;
  `);
  console.log('\n=== sample messages.sender_id ===');
  console.table(sample.rows);

  // 6. Does 043 appear in _migrations?
  let m = [];
  try { const r = await pool.query("SELECT name FROM _migrations ORDER BY id"); m = r.rows; } catch (e) { console.log('no _migrations table'); }
  console.log('\n=== _migrations (last 5) ===');
  console.table(m.slice(-5));

  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
