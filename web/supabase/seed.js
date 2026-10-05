/**
 * Seed Script — Creates the platform admin user in Supabase Auth + app tables.
 * Usage:
 *   node seed.js
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongP@ss!' node seed.js
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from ../.env.local.
 * Override either admin email or password via env vars shown above.
 */

const { readFileSync } = require('fs');
const { join, dirname } = require('path');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const ROOT = join(__dirname, '..');

// ── Load .env.local ────────────────────────────────────────────
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
  } catch {
    // .env.local not found — rely on environment variables
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) not set.');
  console.error('Add it to web/.env.local or set it as an environment variable.');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set.');
  console.error('Add it to web/.env.local or set it as an environment variable.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Platform Admin';

const PLATFORM_COMPANY_ID = 'a4a4a4a4-0004-4004-a004-000000000004';

/** Set is_platform_org flag on the companies table. */
async function setPlatformOrgFlag(supabase, companyId) {
  const { error } = await supabase.from('companies').update({ is_platform_org: true }).eq('id', companyId);
  if (error && !error.message?.includes('column')) {
    console.error('  ⚠ Could not set is_platform_org:', error.message);
  }
}

async function seed() {
  console.log('🌱 Starting platform seed...\n');

  // ── 1. Platform company (base table from schema.sql) ──────
  console.log('📦 Upserting platform company...');
  const { error: compErr } = await supabase
    .from('companies')
    .upsert({
      id: PLATFORM_COMPANY_ID,
      name: 'Platform Admin',
      type: 'DEVELOPER',
      primary_role: 'ADMIN',
      country: 'Zambia',
      description: 'Platform administration organization.',
    }, { onConflict: 'id' });
  if (compErr) { console.error('  ✗ Company:', compErr.message); process.exit(1); }
  console.log('  ✓ Platform company created');
  await setPlatformOrgFlag(supabase, PLATFORM_COMPANY_ID);

  // ── 2. Create / update platform admin auth user ───────────
  console.log(`\n👤 Creating platform admin user (${ADMIN_EMAIL})...`);

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find(au => au.email === ADMIN_EMAIL);

  let userId;
  if (found) {
    userId = found.id;
    console.log(`  ~ ${ADMIN_EMAIL} already exists (${userId})`);
    // Reset password to current value (so reseed always lands on a known password)
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (updErr) console.error('  ⚠ Could not reset password:', updErr.message);
    else console.log('  ✓ Password reset to current ADMIN_PASSWORD');
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      console.error('  ✗ Failed to create admin user:', createErr?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`  + ${ADMIN_EMAIL} created (${userId})`);
  }

  // ── 3. User profile (base table from schema.sql) ──────────
  const { error: profileErr } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      onboarding_complete: true,
    }, { onConflict: 'id' });
  if (profileErr) console.error('  ✗ Profile:', profileErr.message);
  else console.log('  ✓ User profile created');

  // ── 4. Company membership (ADMIN role for platform admin) ──
  const { error: memberErr } = await supabase
    .from('company_members')
    .upsert({
      user_id: userId,
      company_id: PLATFORM_COMPANY_ID,
      role: 'ADMIN',
    }, { onConflict: 'user_id,company_id' });
  if (memberErr) console.error('  ✗ Membership:', memberErr.message);
  else console.log('  ✓ Company membership created');

  // ── 5. Legacy users table ──────────────────────────────────
  await supabase.from('users').upsert({
    id: userId,
    email: ADMIN_EMAIL,
    full_name: ADMIN_NAME,
    role: 'ADMIN',
    company_id: PLATFORM_COMPANY_ID,
    verification_status: 'VERIFIED',
  }, { onConflict: 'email' });

  // ── 6. AI provider config (singleton row id=1) ─────────────
  console.log('\n🤖 Seeding AI provider config...');
  const { error: aiConfigErr } = await supabase
    .from('ai_provider_config')
    .upsert({
      id: 1,
      active_provider: 'gemini',
      active_model: 'gemini-3.5-flash-lite',
      prompt_version: 1,
      confidence_threshold: 0.70,
      max_chars_per_doc: 48000,
      platform_monthly_budget_usd: 200.00,
    }, { onConflict: 'id' });
  if (aiConfigErr) console.error('  ✗ AI config:', aiConfigErr.message);
  else console.log('  ✓ AI provider config seeded');

  // ── 7. AI model catalog ────────────────────────────────────
  const { error: aiCatalogErr } = await supabase
    .from('ai_model_catalog')
    .upsert([
      { provider: 'gemini',   model: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', input_per_1m: 0.30,  output_per_1m: 2.50, supports_vision: true,  max_input_tokens: 1000000, max_output_tokens: 8192, enabled: true  },
      { provider: 'gemini',   model: 'gemini-3.6-flash',      label: 'Gemini 3.6 Flash',      input_per_1m: 1.50,  output_per_1m: 7.50, supports_vision: true,  max_input_tokens: 1000000, max_output_tokens: 8192, enabled: true  },
      { provider: 'gemini',   model: 'gemini-2.0-flash-lite', label: 'Gemini Flash-Lite',      input_per_1m: 0.075, output_per_1m: 0.30, supports_vision: true,  max_input_tokens: 1000000, max_output_tokens: 8192, enabled: false },
      { provider: 'gemini',   model: 'gemini-2.0-flash',      label: 'Gemini Flash',           input_per_1m: 0.10,  output_per_1m: 0.40, supports_vision: true,  max_input_tokens: 1000000, max_output_tokens: 8192, enabled: false },
      { provider: 'mistral',  model: 'mistral-small-latest',  label: 'Mistral Small',          input_per_1m: 0.15,  output_per_1m: 0.60, supports_vision: true,  max_input_tokens: 128000,  max_output_tokens: 8192, enabled: true  },
      { provider: 'deepseek', model: 'deepseek-chat',         label: 'DeepSeek V4 Flash',      input_per_1m: 0.14,  output_per_1m: 0.28, supports_vision: false, max_input_tokens: 128000,  max_output_tokens: 8192, enabled: false },
    ], { onConflict: 'provider,model' });
  if (aiCatalogErr) console.error('  ✗ AI catalog:', aiCatalogErr.message);
  else console.log('  ✓ AI model catalog seeded (6 models)');

  console.log('\n✅ Seed complete!');
  console.log(`\n  Platform admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('');
}

module.exports = { seed, PLATFORM_COMPANY_ID, ADMIN_EMAIL, ADMIN_PASSWORD };

if (require.main === module) {
  seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
