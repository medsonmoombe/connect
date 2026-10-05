/**
 * reset.js — Wipe all application data, keep the platform admin.
 *
 * TRUNCATEs every public-schema table CASCADE except:
 *   - the platform admin company row (is_platform_org = true)
 *   - the platform admin auth user (matched by email from seed.js)
 *
 * After truncate, removes the platform admin's old memberships / profiles so
 * the seed script can re-create them cleanly. Storage buckets are NOT touched
 * (use Supabase Dashboard → Storage to clear those manually if needed).
 *
 * Usage:
 *   node reset.js
 *   ADMIN_EMAIL=you@example.com node reset.js    # override which user is "platform admin"
 *
 * Reads DATABASE_URL from ../.env.local.
 * Refuses to run unless CONFIRM_RESET=1 is set in env.
 */

const { readFileSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');

const ROOT = join(__dirname, '..');

function loadEnv() {
  try {
    const envPath = join(ROOT, '.env.local');
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
  console.error('\x1b[31mERROR: DATABASE_URL not set.\x1b[0m');
  console.error('Add it to web/.env.local (Supabase → Settings → Database → Connection string → URI).');
  process.exit(1);
}

if (process.env.CONFIRM_RESET !== '1') {
  console.error('\x1b[31mRefusing to run without confirmation.\x1b[0m');
  console.error('This will TRUNCATE all application data. Re-run with:');
  console.error('  CONFIRM_RESET=1 node reset.js\n');
  process.exit(2);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
const PLATFORM_COMPANY_ID = 'a4a4a4a4-0004-4004-a004-000000000004';

async function reset() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('🧹 Resetting database (keeping platform admin)...\n');

    // 1. Find the platform admin user id, if any
    const { rows: userRows } = await client.query(
      'SELECT id FROM auth.users WHERE email = $1 LIMIT 1',
      [ADMIN_EMAIL]
    );
    const adminUserId = userRows[0]?.id || null;
    if (adminUserId) {
      console.log(`  · Found platform admin ${ADMIN_EMAIL} (${adminUserId}) — will preserve`);
    } else {
      console.log(`  · No existing admin for ${ADMIN_EMAIL} (will be created on next seed)`);
    }

    // 2. Truncate every public table CASCADE. The CASCADE on each table covers
    //    FK dependencies, and we use RESTART IDENTITY so sequences reset too.
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '\\_%' ESCAPE '\\'
      ORDER BY tablename
    `);

    if (tables.length === 0) {
      console.log('  ! No public tables found — run `npm run migrate` first.');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    for (const { tablename } of tables) {
      // pg_quote_ident would be safer, but table names are constrained to
      // [a-z0-9_] by Postgres naming rules. Still, be defensive.
      const safe = tablename.replace(/[^a-z0-9_]/gi, '');
      await client.query(`TRUNCATE TABLE public."${safe}" RESTART IDENTITY CASCADE`);
    }
    console.log(`  ✓ Truncated ${tables.length} public tables (CASCADE)`);

    // 3. Re-insert the platform company so the next seed has a valid parent row
    await client.query(`
      INSERT INTO public.companies
        (id, name, type, primary_role, country, description, is_platform_org, created_at, updated_at)
      VALUES
        ($1, 'Platform Admin', 'DEVELOPER', 'ADMIN', 'Zambia',
         'Platform administration organization.', true, now(), now())
      ON CONFLICT (id) DO UPDATE SET is_platform_org = true
    `, [PLATFORM_COMPANY_ID]);
    console.log('  ✓ Platform company row restored');

    // 4. Re-insert platform admin user_profiles / users / company_members if we
    //    knew the id. (auth.users was not touched; we only truncated *public*.)
    if (adminUserId) {
      await client.query(`
        INSERT INTO public.user_profiles (id, email, full_name, onboarding_complete)
        VALUES ($1, $2, 'Platform Admin', true)
        ON CONFLICT (id) DO NOTHING
      `, [adminUserId, ADMIN_EMAIL]);

      await client.query(`
        INSERT INTO public.users (id, email, full_name, role, company_id, verification_status)
        VALUES ($1, $2, 'Platform Admin', 'ADMIN', $3, 'VERIFIED')
        ON CONFLICT (email) DO NOTHING
      `, [adminUserId, ADMIN_EMAIL, PLATFORM_COMPANY_ID]);

      await client.query(`
        INSERT INTO public.company_members (user_id, company_id, role)
        VALUES ($1, $2, 'ADMIN')
        ON CONFLICT (user_id, company_id) DO NOTHING
      `, [adminUserId, PLATFORM_COMPANY_ID]);
      console.log('  ✓ Platform admin profile / membership restored');
    }

    await client.query('COMMIT');
    console.log('\n✅ Reset complete. Run `npm run db:seed` (or `db:fresh`) to finish.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\x1b[31mReset failed:\x1b[0m', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  reset().catch(err => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
}

module.exports = { reset };
