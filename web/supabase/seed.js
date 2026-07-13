/**
 * Seed Script - Creates test users in Firebase Auth + Supabase
 * Run: node seed.js
 */

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const serviceAccount = require('./serviceAccountKey.json');

const SUPABASE_URL = 'https://sawqtppqrslmlwwaaiyy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY env var before running.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

const TEST_PASSWORD = 'Test1234!';

const COMPANY_DEV_ID  = 'a1a1a1a1-0001-4001-a001-000000000001';
const COMPANY_CAP_ID  = 'a2a2a2a2-0002-4002-a002-000000000002';
const COMPANY_TECH_ID = 'a3a3a3a3-0003-4003-a003-000000000003';
const PROJECT_1_ID    = 'b1b1b1b1-0001-4001-b001-000000000001';
const PROJECT_2_ID    = 'b2b2b2b2-0002-4002-b002-000000000002';

const testUsers = [
  { email: 'admin@test.com',     full_name: 'Admin User',        role: 'ADMIN',            company_id: null },
  { email: 'developer@test.com', full_name: 'Dev User',          role: 'DEVELOPER',        company_id: COMPANY_DEV_ID },
  { email: 'capital@test.com',   full_name: 'Capital Partner',   role: 'CAPITAL_PARTNER',  company_id: COMPANY_CAP_ID },
  { email: 'technical@test.com', full_name: 'Technical Partner', role: 'TECHNICAL_PARTNER',company_id: COMPANY_TECH_ID },
];

const companies = [
  { id: COMPANY_DEV_ID,  name: 'Zambia Power Dev',    type: 'DEVELOPER', country: 'Zambia',        years_operating: 12, team_size: 45,  website: 'https://zambiapower.com',  description: 'Leading renewable energy developer in the Copperbelt region with a strong track record in solar and hydro projects.' },
  { id: COMPANY_CAP_ID,  name: 'GreenGrowth Capital', type: 'CAPITAL',   country: 'South Africa',  years_operating: 20, team_size: 150, website: 'https://greengrowth.cap',   description: 'Institutional infrastructure fund focused on ESG-compliant energy projects across Sub-Saharan Africa.' },
  { id: COMPANY_TECH_ID, name: 'Global EPC Solutions', type: 'TECHNICAL', country: 'Zambia',       years_operating: 25, team_size: 500, website: 'https://globalepc.com',     description: 'Tier 1 EPC contractor for power generation and transmission lines with over 1500 MW delivered across Africa.' },
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
    governance_terms: 'No board seat. Profit sharing quarterly.',
    exit_terms: 'Buyout option after year 5.',
    risk_disclosures: 'Mining offtake agreement under negotiation.',
  },
];

const capitalPartners = [{
  company_id: COMPANY_CAP_ID,
  preferred_structures: ['EQUITY', 'PROFIT_SHARING'],
  min_ticket_size: 5000000,
  max_ticket_size: 100000000,
  risk_tolerance: 'MEDIUM',
  governance_preference: 'BOARD_SEAT',
  geographic_focus: ['Zambia', 'Kenya', 'South Africa'],
  sector_focus: ['Solar PV', 'Wind', 'Storage'],
}];

const technicalPartners = [{
  company_id: COMPANY_TECH_ID,
  service_categories: ['EPC', 'Engineering Design'],
  sector_experience: ['Solar PV', 'Wind', 'Transmission'],
  min_mw_capacity: 10,
  max_mw_capacity: 500,
  regions_operated: ['Zambia', 'DRC', 'Angola'],
  annual_delivery_capacity_mw: 250,
  total_mw_delivered: 1500,
  bonding_capacity: 100000000,
}];

async function seed() {
  console.log('🌱 Starting seed...\n');

  // Step 1: Companies
  console.log('\n📦 Inserting companies...');
  const { error: compErr } = await supabase.from('companies').upsert(companies, { onConflict: 'id' });
  if (compErr) console.error('  Companies error:', compErr.message);
  else console.log(`  ✓ ${companies.length} companies`);

  // Step 3: Firebase users + Supabase rows
  console.log('\n👤 Creating users...');
  for (const u of testUsers) {
    let uid;
    try {
      const existing = await admin.auth().getUserByEmail(u.email);
      uid = existing.uid;
      console.log(`  ~ ${u.email} already exists in Firebase (${uid})`);
    } catch {
      const created = await admin.auth().createUser({ email: u.email, password: TEST_PASSWORD, displayName: u.full_name });
      uid = created.uid;
      console.log(`  + ${u.email} created in Firebase (${uid})`);
    }

    const { error: userErr } = await supabase.from('users').upsert({
      id: uid,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      company_id: u.company_id,
      verification_status: 'VERIFIED',
    }, { onConflict: 'email' });

    if (userErr) console.error(`  ✗ ${u.email}:`, userErr.message);
    else console.log(`  ✓ ${u.email} → ${u.role}`);
  }

  // Step 4: Projects
  console.log('\n📁 Inserting projects...');
  const { error: projErr } = await supabase.from('projects').upsert(projects, { onConflict: 'id' });
  if (projErr) console.error('  Projects error:', projErr.message);
  else console.log(`  ✓ ${projects.length} projects`);

  // Step 5: Capital partners (insert, skip if exists)
  console.log('\n💰 Inserting capital partner profiles...');
  const { error: capErr } = await supabase.from('capital_partners').insert(capitalPartners, { ignoreDuplicates: true });
  if (capErr) console.error('  Capital partners error:', capErr.message);
  else console.log(`  ✓ ${capitalPartners.length} capital partner profiles`);

  // Step 6: Technical partners
  console.log('\n🔧 Inserting technical partner profiles...');
  const { error: techErr } = await supabase.from('technical_partners').insert(technicalPartners, { ignoreDuplicates: true });
  if (techErr) console.error('  Technical partners error:', techErr.message);
  else console.log(`  ✓ ${technicalPartners.length} technical partner profiles`);

  // Step 7: Project scores
  console.log('\n📊 Inserting project scores...');
  const scores = [
    { project_id: PROJECT_1_ID, capital_readiness_score: 88, regulatory_score: 36, financial_score: 30, developer_score: 22, summary: 'Strong utility-scale solar project. Land rights secured, Grid Impact Study approved by ZESCO.', recommendations: ['Finalise PPA with ZESCO', 'Upload updated financial model'], risk_flags: ['Grid connection timeline risk'] },
    { project_id: PROJECT_2_ID, capital_readiness_score: 65, regulatory_score: 24, financial_score: 22, developer_score: 19, summary: 'Early-stage solar project with strong developer track record. Feasibility study in progress.', recommendations: ['Complete feasibility study', 'Secure offtake agreement'], risk_flags: ['Offtake agreement not yet signed'] },
  ];
  const { error: scoreErr } = await supabase.from('project_scores').insert(scores, { ignoreDuplicates: true });
  if (scoreErr) console.error('  Project scores error:', scoreErr.message);
  else console.log(`  ✓ ${scores.length} project scores`);

  console.log('\n✅ Seed complete!\n');
  console.log('Test accounts (password: Test1234!):');
  testUsers.forEach(u => console.log(`  ${u.role.padEnd(18)} → ${u.email}`));
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
