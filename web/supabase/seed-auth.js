/**
 * Seed Script — Supabase Auth edition
 * Creates test users in Supabase Auth + app tables.
 *
 * Usage:
 *   set SUPABASE_SERVICE_ROLE_KEY=<your_key>
 *   node seed-auth.js
 */

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = 'https://sawqtppqrslmlwwaaiyy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY env var before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const TEST_PASSWORD = 'Test1234!';

const COMPANY_DEV_ID  = 'a1a1a1a1-0001-4001-a001-000000000001';
const COMPANY_CAP_ID  = 'a2a2a2a2-0002-4002-a002-000000000002';
const COMPANY_TECH_ID = 'a3a3a3a3-0003-4003-a003-000000000003';
const PROJECT_1_ID    = 'b1b1b1b1-0001-4001-b001-000000000001';
const PROJECT_2_ID    = 'b2b2b2b2-0002-4002-b002-000000000002';

// Org IDs for the new auth layer
const ORG_DEV_ID   = 'c1c1c1c1-0001-4001-c001-000000000001';
const ORG_CAP_ID   = 'c2c2c2c2-0002-4002-c002-000000000002';
const ORG_TECH_ID  = 'c3c3c3c3-0003-4003-c003-000000000003';
const ORG_ADMIN_ID = 'c4c4c4c4-0004-4004-c004-000000000004';

const testUsers = [
  { email: 'admin@test.com',     full_name: 'Admin User',        orgRole: 'ADMIN',   orgId: ORG_ADMIN_ID },
  { email: 'developer@test.com', full_name: 'Dev User',          orgRole: 'OWNER',   orgId: ORG_DEV_ID   },
  { email: 'capital@test.com',   full_name: 'Capital Partner',   orgRole: 'OWNER',   orgId: ORG_CAP_ID   },
  { email: 'technical@test.com', full_name: 'Technical Partner', orgRole: 'OWNER',   orgId: ORG_TECH_ID  },
];

const organizations = [
  { id: ORG_ADMIN_ID, name: 'Platform Admin',      primary_role: 'DEVELOPER',        status: 'verified' },
  { id: ORG_DEV_ID,   name: 'Zambia Power Dev',     primary_role: 'DEVELOPER',        status: 'verified' },
  { id: ORG_CAP_ID,   name: 'GreenGrowth Capital',  primary_role: 'CAPITAL_PARTNER',  status: 'verified' },
  { id: ORG_TECH_ID,  name: 'Global EPC Solutions', primary_role: 'TECHNICAL_PARTNER',status: 'verified' },
];

const companies = [
  { id: COMPANY_DEV_ID,  name: 'Zambia Power Dev',     type: 'DEVELOPER', country: 'Zambia',       years_operating: 12, team_size: 45,  description: 'Leading renewable energy developer in the Copperbelt region.' },
  { id: COMPANY_CAP_ID,  name: 'GreenGrowth Capital',  type: 'CAPITAL',   country: 'South Africa', years_operating: 20, team_size: 150, description: 'Institutional infrastructure fund focused on ESG-compliant energy projects.' },
  { id: COMPANY_TECH_ID, name: 'Global EPC Solutions', type: 'TECHNICAL', country: 'Zambia',       years_operating: 25, team_size: 500, description: 'Tier 1 EPC contractor with over 1500 MW delivered across Africa.' },
];

const projects = [
  {
    id: PROJECT_1_ID,
    developer_id: COMPANY_DEV_ID,
    name: 'Solana West Phase II',
    technology_type: 'Solar PV',
    location_country: 'Zambia',
    location_region: 'Copperbelt',
    project_size_mw: 40,
    capital_required: 35000000,
    capital_structure_type: 'EQUITY',
    project_stage: 'READY_TO_BUILD',
    status: 'validated',
    governance_terms: 'Board observer seat offered to lead investor.',
    exit_terms: 'Strategic sale or IPO within 7 years.',
    risk_disclosures: 'Grid connection subject to ZESCO approval timeline.',
  },
  {
    id: PROJECT_2_ID,
    developer_id: COMPANY_DEV_ID,
    name: 'Copperbelt Mining Solar',
    technology_type: 'Solar PV',
    location_country: 'Zambia',
    location_region: 'Copperbelt',
    project_size_mw: 20,
    capital_required: 15000000,
    capital_structure_type: 'PROFIT_SHARING',
    project_stage: 'FEASIBILITY',
    status: 'submitted',
    governance_terms: 'No board seat. Profit sharing quarterly.',
    exit_terms: 'Buyout option after year 5.',
    risk_disclosures: 'Mining offtake agreement under negotiation.',
  },
];

async function seed() {
  console.log('🌱 Starting Supabase Auth seed...\n');

  // ── 1. Organizations ───────────────────────────────────────
  console.log('🏢 Upserting organizations...');
  const { error: orgErr } = await supabase
    .from('organizations')
    .upsert(organizations, { onConflict: 'id' });
  if (orgErr) { console.error('  ✗ Organizations:', orgErr.message); process.exit(1); }
  console.log(`  ✓ ${organizations.length} organizations`);

  // ── 2. Companies (existing table, kept for project relations) ─
  console.log('\n📦 Upserting companies...');
  const { error: compErr } = await supabase
    .from('companies')
    .upsert(companies, { onConflict: 'id' });
  if (compErr) console.error('  ✗ Companies:', compErr.message);
  else console.log(`  ✓ ${companies.length} companies`);

  // ── 3. Auth users + profiles + memberships ─────────────────
  console.log('\n👤 Creating auth users...');
  for (const u of testUsers) {
    // Check if already exists in auth.users
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find(au => au.email === u.email);

    let userId;
    if (found) {
      userId = found.id;
      console.log(`  ~ ${u.email} already exists in auth.users (${userId})`);
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: TEST_PASSWORD,
        email_confirm: true, // skip email verification for test accounts
      });
      if (createErr || !created.user) {
        console.error(`  ✗ ${u.email}:`, createErr?.message);
        continue;
      }
      userId = created.user.id;
      console.log(`  + ${u.email} created in auth.users (${userId})`);
    }

    // Upsert user_profile
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, email: u.email, full_name: u.full_name, onboarding_complete: true }, { onConflict: 'id' });
    if (profileErr) console.error(`  ✗ profile for ${u.email}:`, profileErr.message);

    // Upsert organization_member
    const { error: memberErr } = await supabase
      .from('organization_members')
      .upsert({ user_id: userId, org_id: u.orgId, role: u.orgRole }, { onConflict: 'user_id,org_id' });
    if (memberErr) console.error(`  ✗ membership for ${u.email}:`, memberErr.message);

    // Also upsert into old users table so existing dashboard queries still work
    const legacyRole = u.orgRole === 'ADMIN' ? 'ADMIN'
      : organizations.find(o => o.id === u.orgId)?.primary_role ?? 'DEVELOPER';
    const legacyCompanyId = u.orgId === ORG_DEV_ID ? COMPANY_DEV_ID
      : u.orgId === ORG_CAP_ID ? COMPANY_CAP_ID
      : u.orgId === ORG_TECH_ID ? COMPANY_TECH_ID
      : null;

    await supabase.from('users').upsert({
      id: userId,
      email: u.email,
      full_name: u.full_name,
      role: legacyRole,
      company_id: legacyCompanyId,
      verification_status: 'VERIFIED',
    }, { onConflict: 'email' });

    console.log(`  ✓ ${u.email} → org role: ${u.orgRole}`);
  }

  // ── 4. Projects ────────────────────────────────────────────
  console.log('\n📁 Upserting projects...');
  const { error: projErr } = await supabase
    .from('projects')
    .upsert(projects, { onConflict: 'id' });
  if (projErr) console.error('  ✗ Projects:', projErr.message);
  else console.log(`  ✓ ${projects.length} projects`);

  // ── 5. Capital & Technical partners ───────────────────────
  console.log('\n💰 Upserting capital partner profiles...');
  await supabase.from('capital_partners').upsert([{
    company_id: COMPANY_CAP_ID,
    preferred_structures: ['EQUITY', 'PROFIT_SHARING'],
    min_ticket_size: 5000000,
    max_ticket_size: 100000000,
    risk_tolerance: 'MEDIUM',
    governance_preference: 'BOARD_SEAT',
    geographic_focus: ['Zambia', 'Kenya', 'South Africa'],
    sector_focus: ['Solar PV', 'Wind', 'Storage'],
  }], { onConflict: 'company_id' });
  console.log('  ✓ 1 capital partner');

  console.log('\n🔧 Upserting technical partner profiles...');
  await supabase.from('technical_partners').upsert([{
    company_id: COMPANY_TECH_ID,
    service_categories: ['EPC', 'Engineering Design'],
    sector_experience: ['Solar PV', 'Wind', 'Transmission'],
    min_mw_capacity: 10,
    max_mw_capacity: 500,
    regions_operated: ['Zambia', 'DRC', 'Angola'],
    annual_delivery_capacity_mw: 250,
    total_mw_delivered: 1500,
    bonding_capacity: 100000000,
  }], { onConflict: 'company_id' });
  console.log('  ✓ 1 technical partner');

  // ── 6. Project scores ──────────────────────────────────────
  console.log('\n📊 Upserting project scores...');
  await supabase.from('project_scores').upsert([
    { project_id: PROJECT_1_ID, capital_readiness_score: 88, regulatory_score: 36, financial_score: 30, developer_score: 22, documentation_score: 80, governance_score: 75, financial_transparency_score: 70, summary: 'Strong utility-scale solar project. Land rights secured, Grid Impact Study approved by ZESCO.', recommendations: ['Finalise PPA with ZESCO', 'Upload updated financial model'], risk_flags: ['Grid connection timeline risk'] },
    { project_id: PROJECT_2_ID, capital_readiness_score: 65, regulatory_score: 24, financial_score: 22, developer_score: 19, documentation_score: 60, governance_score: 55, financial_transparency_score: 50, summary: 'Early-stage solar project with strong developer track record.', recommendations: ['Complete feasibility study', 'Secure offtake agreement'], risk_flags: ['Offtake agreement not yet signed'] },
  ], { onConflict: 'project_id' });
  console.log('  ✓ 2 project scores');

  console.log('\n✅ Seed complete!\n');
  console.log('Test accounts (password: Test1234!):');
  testUsers.forEach(u => console.log(`  ${u.orgRole.padEnd(8)} → ${u.email}`));
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
