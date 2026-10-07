/**
 * Seed Profiles — Manual Entry Reference
 * ========================================
 * 3 fully-specified examples for each profile type.
 * Use these to manually register users through the onboarding flow.
 *
 * For each profile you get:
 *   1. Auth credentials (email / password)
 *   2. Step 1 — Profile  (full_name)
 *   3. Step 2 — Company  (all company fields)
 *   4. Step 3 — Preferences (role-specific preference fields)
 *
 * Password for all accounts:  Admin1234!
 * (Change after first login.)
 *
 * How to use:
 *   1. Open the app → Sign up with the email/password below.
 *   2. Fill Step 1 (Full Name) with the value shown.
 *   3. On Step 2 click "Create New Company Profile" and fill every field.
 *   4. On Step 3 fill every preference field exactly as listed.
 *   5. Submit → Admin verifies → Profile is live.
 */

// ────────────────────────────────────────────────────────────
//  1. DEVELOPER  (3 examples)
// ────────────────────────────────────────────────────────────

const DEVELOPER_PROFILES = [
  // ── Developer #1 ──────────────────────────────────────────
  {
    auth: {
      email: 'james.mwanza@solargen.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'James Mwanza',
    },
    step2_company: {
      name: 'SolarGen Zambia Ltd',
      country: 'Zambia',
      description:
        'SolarGen Zambia is a Lusaka-based renewable energy developer focused on utility-scale solar photovoltaic projects across Zambia. Founded in 2021, we have successfully completed two small-scale solar installations in the Copperbelt and are now scaling to 20 MW+ projects targeting industrial and mining offtakers.',
      website: 'https://solargen.co.zm',
      years_operating: 4,
      team_size: 18,
      registration_number: 'PACRA/2021/SOL/0892',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '60% James Mwanza (Founder/CEO), 25% Mwape Investments Ltd, 15% Employee Option Pool',
      contact_email: 'info@solargen.co.zm',
      contact_phone: '+260 977 123 456',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'CEO has 12 years in power sector including 5 years at ZESCO in grid planning. CTO has 8 years designing solar farms across East Africa.',
    },
    step3_preferences: null, // Developers don't fill preferences
  },

  // ── Developer #2 ──────────────────────────────────────────
  {
    auth: {
      email: 'fatima.banda@zamhydro.energy',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Fatima Banda',
    },
    step2_company: {
      name: 'ZamHydro Energy',
      country: 'Zambia',
      description:
        'ZamHydro Energy develops small-to-medium run-of-river hydropower projects in Zambia\'s Northern and Luapula provinces. We combine local community engagement with international engineering standards to deliver reliable clean power to off-grid mining operations and rural electrification schemes.',
      website: 'https://zamhydro.energy',
      years_operating: 7,
      team_size: 24,
      registration_number: 'PACRA/2018/HYD/0432',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '50% Banda Family Trust, 30% GreenField Capital (Pty) Ltd, 20% Co-founders',
      contact_email: 'projects@zamhydro.energy',
      contact_phone: '+260 966 789 012',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Founder has 15 years in hydropower development across Zambia and Mozambique. Engineering Director previously led EPC delivery for a 10 MW hydro project in Malawi.',
    },
    step3_preferences: null,
  },

  // ── Developer #3 ──────────────────────────────────────────
  {
    auth: {
      email: 'chanda.k@windforce.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Chanda Kabwe',
    },
    step2_company: {
      name: 'WindForce Zambia',
      country: 'Zambia',
      description:
        'WindForce Zambia is a renewable energy startup developing wind-solar hybrid projects for commercial and industrial customers. Our first 5 MW hybrid project in Lusaka Province is at PPA-ready stage with signed letters of intent from two mining companies. We are now raising capital for construction.',
      website: 'https://windforce.co.zm',
      years_operating: 1,
      team_size: 8,
      registration_number: 'PACRA/2025/WND/0118',
      ownership_structure: 'JV',
      ownership_details: '55% WindForce Holdings (Pty) Ltd South Africa, 30% Chanda Kabwe (Founder), 15% Zambia Angel Fund',
      contact_email: 'chanda.k@windforce.co.zm',
      contact_phone: '+260 955 345 678',
      is_new_company_with_experienced_team: true,
      management_team_experience: { years: 17, description: 'Founder 10 years energy finance; lead engineer 7 years EPC.' },
      management_experience_summary: 'Founder has 10 years in energy finance at Standard Chartered Zambia. Lead engineer has 7 years EPC experience in South African wind farms. New company but seasoned leadership team.',
    },
    step3_preferences: null,
  },
];

// ────────────────────────────────────────────────────────────
//  2. CAPITAL PARTNER / FINANCIER  (3 examples)
// ────────────────────────────────────────────────────────────

const CAPITAL_PROFILES = [
  // ── Capital #1 ────────────────────────────────────────────
  {
    auth: {
      email: 'sarah.omalley@africangreenco.com',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Sarah O\'Malley',
    },
    step2_company: {
      name: 'African Green Capital Partners',
      country: 'Zambia',
      description:
        'African Green Capital Partners is a Lusaka-based impact investment firm focused on renewable energy infrastructure across Southern Africa. We deploy equity and quasi-equity capital into early-to-mid-stage energy projects, targeting risk-adjusted returns alongside measurable climate impact.',
      website: 'https://africangreenco.com',
      years_operating: 6,
      team_size: 12,
      registration_number: 'PACRA/2019/CAP/0654',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '40% Global Climate Fund LP, 30% Management Team, 20% Development Finance Institution, 10% Local Pension Fund',
      contact_email: 'investments@africangreenco.com',
      contact_phone: '+260 971 234 567',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Managing Partner has 18 years in infrastructure finance including roles at IFC and CDC Group. Investment Director previously led renewable energy deals at Actis.',
    },
    step3_preferences: {
      min_ticket_size: 5000000,       // 5M ZMW
      max_ticket_size: 200000000,     // 200M ZMW
      sector_focus: ['SOLAR', 'WIND', 'HYDRO', 'STORAGE'],
      geographic_focus: ['Lusaka', 'Copperbelt', 'Southern', 'North-Western'],
      risk_tolerance: 'MEDIUM',
      governance_preference: 'BOARD_SEAT',
      preferred_project_stage: ['FULL_FEASIBILITY', 'PPA_READY', 'FINANCIAL_CLOSE'],
      preferred_capital_structure: ['EQUITY', 'PROFIT_SHARING'],
      expected_return_profile: '15-20% target IRR with strong ESG co-benefits',
    },
  },

  // ── Capital #2 ────────────────────────────────────────────
  {
    auth: {
      email: 'daniel.nkosi@zanacapital.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Daniel Nkosi',
    },
    step2_company: {
      name: 'Zana Capital Advisory',
      country: 'Zambia',
      description:
        'Zana Capital Advisory is a boutique financial advisory and co-investment platform connecting institutional investors with bankable energy infrastructure projects in Zambia. We provide debt structuring, financial modelling, and investor syndication services alongside our own balance sheet commitments.',
      website: 'https://zanacapital.co.zm',
      years_operating: 3,
      team_size: 6,
      registration_number: 'PACRA/2022/CAP/0211',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '70% Daniel Nkosi (Founder), 20% Zambian Diaspora Investment Fund, 10% Employee shares',
      contact_email: 'daniel@zanacapital.co.zm',
      contact_phone: '+260 968 876 543',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Founder spent 10 years at Standard Bank CIB in infrastructure debt. Previously structured $150M+ in power sector financing across the region.',
    },
    step3_preferences: {
      min_ticket_size: 2000000,       // 2M ZMW
      max_ticket_size: 100000000,     // 100M ZMW
      sector_focus: ['SOLAR', 'HYDRO', 'GRID_INFRA'],
      geographic_focus: ['Lusaka', 'Copperbelt', 'Central'],
      risk_tolerance: 'LOW',
      governance_preference: 'ACTIVE_ROLE',
      preferred_project_stage: ['PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION'],
      preferred_capital_structure: ['DEBT', 'EQUITY'],
      expected_return_profile: '12-18% target IRR, senior secured preferred',
    },
  },

  // ── Capital #3 ────────────────────────────────────────────
  {
    auth: {
      email: 'grace.mutale@luminafund.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Grace Mutale',
    },
    step2_company: {
      name: 'Lumina Energy Fund',
      country: 'Zambia',
      description:
        'Lumina Energy Fund is a Zambia-focused blended finance vehicle combining development capital with commercial investment to de-risk early-stage renewable energy projects. We provide patient capital and technical assistance to help projects reach bankability, then syndicate construction finance to commercial lenders.',
      website: 'https://luminafund.co.zm',
      years_operating: 2,
      team_size: 5,
      registration_number: 'PACRA/2024/CAP/0078',
      ownership_structure: 'JV',
      ownership_details: '45% European Development Finance Institution, 30% Zambian Pension Consortium, 25% Management Company',
      contact_email: 'grace@luminafund.co.zm',
      contact_phone: '+260 954 321 098',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Fund Manager has 14 years in blended finance across Africa. Previously structured the first green bond in Zambia. New fund with experienced leadership.',
    },
    step3_preferences: {
      min_ticket_size: 1000000,       // 1M ZMW
      max_ticket_size: 75000000,      // 75M ZMW
      sector_focus: ['SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'STORAGE'],
      geographic_focus: ['Lusaka', 'Copperbelt', 'Southern', 'Eastern', 'Northern', 'Luapula'],
      risk_tolerance: 'HIGH',
      governance_preference: 'PASSIVE',
      preferred_project_stage: ['CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL'],
      preferred_capital_structure: ['EQUITY', 'GRANT', 'PROFIT_SHARING'],
      expected_return_profile: '10-15% blended return with development impact metrics',
    },
  },
];

// ────────────────────────────────────────────────────────────
//  3. TECHNICAL PARTNER / EPC  (3 examples)
// ────────────────────────────────────────────────────────────

const TECHNICAL_PROFILES = [
  // ── Technical #1 ──────────────────────────────────────────
  {
    auth: {
      email: 'michael.tembo@sunridgesepc.com',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Michael Tembo',
    },
    step2_company: {
      name: 'SunRidges EPC',
      country: 'Zambia',
      description:
        'SunRidges EPC is a full-service engineering, procurement, and construction firm specializing in solar PV installations across Zambia. We deliver turnkey solutions from 100 kW commercial rooftops to 50 MW utility-scale ground-mount systems. Our team holds NCEA and IEC certifications.',
      website: 'https://sunridgesepc.com',
      years_operating: 8,
      team_size: 45,
      registration_number: 'PACRA/2017/EPC/1203',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '55% Michael Tembo (Managing Director), 30% Tembo Family Holdings, 15% Employee Trust',
      contact_email: 'contracts@sunridgesepc.com',
      contact_phone: '+260 977 456 789',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Managing Director is a chartered electrical engineer with 18 years in power systems. Operations Manager has 10 years solar EPC experience in Zambia and Zimbabwe.',
    },
    step3_preferences: {
      years_of_experience: 8,
      min_ticket_size_zmw: 2000000,
      max_ticket_size_zmw: 150000000,
      min_mw_capacity: 0.5,
      max_mw_capacity: 50,
      service_categories: ['EPC', 'O_M'],
      sector_experience: ['SOLAR', 'STORAGE'],
      regions_operated: ['Lusaka', 'Copperbelt', 'Southern', 'Central', 'North-Western'],
      delivery_models: ['FIXED_PRICE', 'BOOT'],
      payment_terms: '30% mobilization, 40% at equipment delivery, 20% at commissioning, 10% at COD',
      annual_delivery_capacity_mw: 60,
      total_mw_delivered: 120,
      largest_project_mw: 50,
      average_delivery_time_months: 9,
      bonding_capacity: 5000000,
      project_type_experience: ['Utility-scale', 'Commercial & Industrial'],
      company_experience_doc_url: 'https://sunridgesepc.com/track-record',
    },
  },

  // ── Technical #2 ──────────────────────────────────────────
  {
    auth: {
      email: 'anita.chilufya@nexusengineering.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Anita Chilufya',
    },
    step2_company: {
      name: 'Nexus Engineering Solutions',
      country: 'Zambia',
      description:
        'Nexus Engineering Solutions provides multi-disciplinary engineering services for energy infrastructure projects including feasibility studies, detailed design, project management, and independent engineering reviews. We serve developers, lenders, and DFIs requiring third-party technical due diligence.',
      website: 'https://nexusengineering.co.zm',
      years_operating: 10,
      team_size: 32,
      registration_number: 'PACRA/2015/ENG/2105',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '45% Anita Chilufya (CEO), 35% Dr. Peter Mwamba (CTO), 20% Strategic investor (EIB Ventures)',
      contact_email: 'anita@nexusengineering.co.zm',
      contact_phone: '+260 966 543 210',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'CEO is a licensed Professional Engineer with 20 years across power sector consulting. CTO holds a PhD in Renewable Energy from Imperial College London.',
    },
    step3_preferences: {
      years_of_experience: 10,
      min_ticket_size_zmw: 500000,
      max_ticket_size_zmw: 50000000,
      min_mw_capacity: 1,
      max_mw_capacity: 100,
      service_categories: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_IMPACT', 'EPC'],
      sector_experience: ['SOLAR', 'WIND', 'HYDRO', 'GEOTHERMAL'],
      regions_operated: ['Lusaka', 'Copperbelt', 'Northern', 'Luapula', 'Muchinga', 'Western'],
      delivery_models: ['FIXED_PRICE', 'TIME_MATERIALS'],
      payment_terms: 'Milestone-based billing: 20% on mobilization, remainder in monthly progress payments',
      annual_delivery_capacity_mw: 40,
      total_mw_delivered: 210,
      largest_project_mw: 100,
      average_delivery_time_months: 6,
      bonding_capacity: 2000000,
      project_type_experience: ['Utility-scale', 'Transmission', 'Distribution'],
      company_experience_doc_url: 'https://nexusengineering.co.zm/portfolio',
    },
  },

  // ── Technical #3 ──────────────────────────────────────────
  {
    auth: {
      email: 'blessing.mwila@afrogridconstruct.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Blessing Mwila',
    },
    step2_company: {
      name: 'AfroGrid Construction',
      country: 'Zambia',
      description:
        'AfroGrid Construction is an infrastructure contractor specializing in power transmission, distribution, and grid interconnection works. We build 33kV to 220kV substations, transmission lines, and distribution networks. We also provide O&M services for operational power plants and grid infrastructure.',
      website: 'https://afrogridconstruct.co.zm',
      years_operating: 12,
      team_size: 85,
      registration_number: 'PACRA/2013/CON/3301',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '50% Mwila Family Trust, 30% China-Zambia Infrastructure JV (strategic partner), 20% Management shares',
      contact_email: 'blessing@afrogridconstruct.co.zm',
      contact_phone: '+260 955 678 901',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Founder has 22 years in heavy civil and electrical infrastructure. Company has delivered 500+ km of transmission line and 15 substations across Zambia and DRC.',
    },
    step3_preferences: {
      years_of_experience: 12,
      min_ticket_size_zmw: 5000000,
      max_ticket_size_zmw: 500000000,
      min_mw_capacity: 10,
      max_mw_capacity: 200,
      service_categories: ['EPC', 'O_M'],
      sector_experience: ['SOLAR', 'WIND', 'HYDRO', 'GRID_INFRA', 'STORAGE'],
      regions_operated: ['Lusaka', 'Copperbelt', 'Central', 'North-Western', 'Northern', 'Muchinga'],
      delivery_models: ['FIXED_PRICE', 'COST_PLUS', 'BOOT'],
      payment_terms: '20% upfront, 60% on milestone completion, 20% upon handover and defect liability period',
      annual_delivery_capacity_mw: 150,
      total_mw_delivered: 520,
      largest_project_mw: 200,
      average_delivery_time_months: 14,
      bonding_capacity: 12000000,
      project_type_experience: ['Transmission', 'Distribution', 'Utility-scale'],
      company_experience_doc_url: 'https://afrogridconstruct.co.zm/projects',
    },
  },
];

// ────────────────────────────────────────────────────────────
//  4. CONSULTANT  (3 examples)
// ────────────────────────────────────────────────────────────

const CONSULTANT_PROFILES = [
  // ── Consultant #1 ─────────────────────────────────────────
  {
    auth: {
      email: 'elias.phiri@greenvista.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Elias Phiri',
    },
    step2_company: {
      name: 'GreenVista Advisory',
      country: 'Zambia',
      description:
        'GreenVista Advisory is an environmental and social impact consulting firm helping renewable energy developers navigate Zambia\'s Environmental Council of Zambia (ECZ) approval process. We prepare ESIA reports, conduct stakeholder consultations, and manage regulatory compliance throughout the project lifecycle.',
      website: 'https://greenvista.co.zm',
      years_operating: 9,
      team_size: 15,
      registration_number: 'PACRA/2016/ADV/0887',
      ownership_structure: 'PARTNERSHIP',
      ownership_details: '50% Elias Phiri (Managing Partner), 30% Dr. Nyambwe Mwanza (Senior Partner), 20% Associate Partner Pool',
      contact_email: 'elias@greenvista.co.zm',
      contact_phone: '+260 977 321 654',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Managing Partner is a certified Environmental Impact Assessment specialist with 14 years in Zambian energy sector. Senior Partner holds a PhD in Environmental Science from UNZA.',
    },
    step3_preferences: {
      years_of_experience: 9,
      total_projects_completed: 45,
      largest_project_mw: 80,
      availability: 'AVAILABLE',
      service_categories: ['ENVIRONMENTAL_IMPACT', 'FEASIBILITY_STUDY'],
      sector_experience: ['SOLAR', 'WIND', 'HYDRO', 'BIOMASS'],
      regions_operated: ['Lusaka', 'Copperbelt', 'Southern', 'Central', 'Eastern', 'Northern', 'North-Western'],
      certifications: ['ENVIRONMENTAL'],
      hourly_rate_range: '$100–$180 / hr',
      project_rate_range: '$15k–$60k per ESIA',
      specializations: ['Environmental & Social Impact Assessment', 'Regulatory Compliance'],
      company_experience_doc_url: 'https://greenvista.co.zm/track-record',
      portfolio_doc_url: 'https://greenvista.co.zm/portfolio',
    },
  },

  // ── Consultant #2 ─────────────────────────────────────────
  {
    auth: {
      email: 'rachel.kapoma@zamfinance.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Rachel Kapoma',
    },
    step2_company: {
      name: 'ZamFinance Advisory',
      country: 'Zambia',
      description:
        'ZamFinance Advisory provides independent financial advisory services to renewable energy project developers and investors. We specialize in financial modelling, bankability assessments, capital structuring, and transaction management for energy infrastructure projects seeking debt and equity financing.',
      website: 'https://zamfinance.co.zm',
      years_operating: 5,
      team_size: 8,
      registration_number: 'PACRA/2020/FIN/0556',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '65% Rachel Kapoma (Founder/CEO), 25% Cloud Nine Investments, 10% Employee shares',
      contact_email: 'rachel@zamfinance.co.zm',
      contact_phone: '+260 968 789 012',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'CEO is a CFA charterholder with 12 years in infrastructure finance. Previously led deal origination for a $500M African energy fund.',
    },
    step3_preferences: {
      years_of_experience: 5,
      total_projects_completed: 28,
      largest_project_mw: 60,
      availability: 'AVAILABLE',
      service_categories: ['FINANCIAL_ADVISORY', 'LEGAL_ADVISORY'],
      sector_experience: ['SOLAR', 'WIND', 'HYDRO', 'STORAGE', 'GRID_INFRA'],
      regions_operated: ['Lusaka', 'Copperbelt', 'Southern'],
      certifications: ['CFA'],
      hourly_rate_range: '$120–$220 / hr',
      project_rate_range: '$25k–$100k per engagement',
      specializations: ['Financial Modelling', 'Capital Structuring', 'Transaction Advisory'],
      company_experience_doc_url: 'https://zamfinance.co.zm/track-record',
      portfolio_doc_url: 'https://zamfinance.co.zm/portfolio',
    },
  },

  // ── Consultant #3 ─────────────────────────────────────────
  {
    auth: {
      email: 'samuel.mwale@patriotlegal.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Samuel Mwale',
    },
    step2_company: {
      name: 'Patriot Legal Chambers',
      country: 'Zambia',
      description:
        'Patriot Legal Chambers is a Zambian law firm with a dedicated energy and infrastructure practice. We advise on power purchase agreements, concession agreements, regulatory compliance, land acquisition, and corporate structuring for renewable energy projects. Our team has closed over 30 energy transactions.',
      website: 'https://patriotlegal.co.zm',
      years_operating: 14,
      team_size: 22,
      registration_number: 'PACRA/2011/LAW/1998',
      ownership_structure: 'PARTNERSHIP',
      ownership_details: '35% Senior Partner Samuel Mwale, 30% Partner Grace Tembo, 20% Partner David Lungu, 15% Associate Partner Pool',
      contact_email: 'samuel@patriotlegal.co.zm',
      contact_phone: '+260 955 432 109',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Senior Partner is a member of the Zambia Institute of Legal Practice with 18 years specializing in energy law. Firm has advised on $500M+ in cumulative energy deal value.',
    },
    step3_preferences: {
      years_of_experience: 14,
      total_projects_completed: 55,
      largest_project_mw: 120,
      availability: 'AVAILABLE',
      service_categories: ['LEGAL_ADVISORY', 'FINANCIAL_ADVISORY'],
      sector_experience: ['SOLAR', 'WIND', 'HYDRO', 'STORAGE', 'GRID_INFRA'],
      regions_operated: ['Lusaka', 'Copperbelt', 'Southern', 'Central', 'North-Western'],
      certifications: ['LEGAL'],
      hourly_rate_range: '$150–$300 / hr',
      project_rate_range: '$20k–$150k per transaction',
      specializations: ['Power Purchase Agreements', 'Concession Agreements', 'Land Acquisition'],
      company_experience_doc_url: 'https://patriotlegal.co.zm/track-record',
      portfolio_doc_url: 'https://patriotlegal.co.zm/portfolio',
    },
  },
];

// ────────────────────────────────────────────────────────────
//  5. POWER TRADER  (3 examples)
// ────────────────────────────────────────────────────────────

const POWER_TRADER_PROFILES = [
  // ── Power Trader #1 ───────────────────────────────────────
  {
    auth: {
      email: 'david.silwamba@zampowertrading.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'David Silwamba',
    },
    step2_company: {
      name: 'ZamPower Trading Ltd',
      country: 'Zambia',
      description:
        'ZamPower Trading is a licensed electricity trader and industrial offtaker in Zambia. We purchase power from independent producers under long-term PPAs and resell to mining companies, commercial complexes, and industrial parks. Our portfolio currently manages 45 MW of contracted power.',
      website: 'https://zampowertrading.co.zm',
      years_operating: 5,
      team_size: 14,
      registration_number: 'PACRA/2020/TRD/0443',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '55% Silwamba Investments, 25% PowerGrid Holdings (SA), 20% Employee shares',
      contact_email: 'david@zampowertrading.co.zm',
      contact_phone: '+260 977 876 543',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'CEO has 11 years in power trading and utility management. Previously headed commercial operations at a Zambian independent power producer.',
    },
    step3_preferences: {
      license_type: 'TRADING',
      max_offtake_capacity_mw: 80,
      preferred_technology_types: ['SOLAR', 'WIND', 'HYDRO', 'STORAGE'],
      regions_of_interest: ['Lusaka', 'Copperbelt', 'North-Western', 'Central'],
      min_ppa_duration_years: 7,
    },
  },

  // ── Power Trader #2 ───────────────────────────────────────
  {
    auth: {
      email: 'mary.ngandu@kabweindustrial.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Mary Ngandu',
    },
    step2_company: {
      name: 'Kabwe Industrial Energy',
      country: 'Zambia',
      description:
        'Kabwe Industrial Energy is an industrial conglomerate seeking to secure reliable and affordable power for its mining, manufacturing, and agricultural processing operations. We are actively looking to sign PPAs with independent renewable energy producers to reduce our reliance on grid power and diesel generators.',
      website: 'https://kabweindustrial.co.zm',
      years_operating: 20,
      team_size: 120,
      registration_number: 'PACRA/2005/IND/4412',
      ownership_structure: 'PUBLIC_LIMITED',
      ownership_details: 'Listed on LuSE (Lusaka Securities Exchange). 40% institutional investors, 30% founding family, 20% public float, 10% employee shares',
      contact_email: 'mary.ngandu@kabweindustrial.co.zm',
      contact_phone: '+260 966 234 567',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Group Energy Director has 16 years in industrial energy procurement. Previously negotiated $200M+ in power supply contracts for Zambian mining operations.',
    },
    step3_preferences: {
      license_type: 'SUPPLIER',
      max_offtake_capacity_mw: 50,
      preferred_technology_types: ['SOLAR', 'HYDRO', 'WIND'],
      regions_of_interest: ['Lusaka', 'Copperbelt', 'Central', 'Southern'],
      min_ppa_duration_years: 10,
    },
  },

  // ── Power Trader #3 ───────────────────────────────────────
  {
    auth: {
      email: 'patrick.halwindi@escom-trading.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Patrick Halwindi',
    },
    step2_company: {
      name: 'Southern Africa Cross-Border Power',
      country: 'Zambia',
      description:
        'Southern Africa Cross-Border Power is a cross-border electricity trading company operating across the SAPP (Southern African Power Pool) market. We facilitate wheeling agreements and cross-border power purchases between Zambian generators and industrial consumers in the DRC, Zimbabwe, and Botswana.',
      website: 'https://sacbp.co.zm',
      years_operating: 3,
      team_size: 7,
      registration_number: 'PACRA/2022/TRD/0189',
      ownership_structure: 'PRIVATE_LIMITED',
      ownership_details: '50% Halwindi Family Trust, 30% SAPP Trading Partner (Namibia), 20% Management equity',
      contact_email: 'patrick@sacbp.co.zm',
      contact_phone: '+260 954 654 321',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Founder has 9 years in SAPP market operations and cross-border power trade. Previously managed wheeling contracts for a ZESCO subsidiary.',
    },
    step3_preferences: {
      license_type: 'TRADING',
      max_offtake_capacity_mw: 30,
      preferred_technology_types: ['SOLAR', 'WIND', 'HYDRO'],
      regions_of_interest: ['Lusaka', 'Copperbelt', 'Southern', 'North-Western'],
      min_ppa_duration_years: 5,
    },
  },
];

// ────────────────────────────────────────────────────────────
//  6. GRANT PROVIDER  (3 examples)
// ────────────────────────────────────────────────────────────

const GRANT_PROVIDER_PROFILES = [
  // ── Grant Provider #1 ─────────────────────────────────────
  {
    auth: {
      email: 'anna.becker@energy4all.org',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Anna Becker',
    },
    step2_company: {
      name: 'Energy for All Foundation',
      country: 'Zambia',
      description:
        'Energy for All Foundation is an international non-profit dedicated to accelerating rural electrification in sub-Saharan Africa. We provide grants for early-stage renewable energy project preparation, feasibility studies, and community engagement to help developers reach bankability.',
      website: 'https://energy4all.org',
      years_operating: 8,
      team_size: 20,
      registration_number: 'NGO/2017/0891',
      ownership_structure: 'NON_PROFIT',
      ownership_details: 'Board-governed non-profit. No ownership stakes. Board of 7 directors from development finance, academia, and civil society.',
      contact_email: 'grants@energy4all.org',
      contact_phone: '+260 977 567 890',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Executive Director has 16 years in development finance. Grants Manager previously administered $30M+ in clean energy grants at GIZ.',
    },
    step3_preferences: {
      min_grant_size: 50000,          // 50K ZMW
      max_grant_size: 15000000,       // 15M ZMW
      grant_types: ['TECHNICAL_ASSISTANCE', 'FEASIBILITY_STUDY', 'PROJECT_PREPARATION', 'CAPACITY_BUILDING'],
      focus_sectors: ['SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'STORAGE'],
      geographic_focus: ['Northern', 'Luapula', 'Muchinga', 'Western', 'Eastern', 'Southern'],
      typical_timeline_months: 4,
      eligibility_criteria: 'Applicant must be a registered Zambian company with a renewable energy project in concept or pre-feasibility stage. Priority given to projects serving rural or off-grid communities.',
      application_process: 'Submit online application with project brief → Initial screening (2 weeks) → Full proposal invitation (if shortlisted) → Technical review (4 weeks) → Board decision (2 weeks) → Grant agreement and disbursement.',
    },
  },

  // ── Grant Provider #2 ─────────────────────────────────────
  {
    auth: {
      email: 'james.mutati@greenstartup.co.zm',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'James Mutati',
    },
    step2_company: {
      name: 'Zambia Green Startup Facility',
      country: 'Zambia',
      description:
        'Zambia Green Startup Facility is a domestically-managed grant and technical assistance facility supported by the World Bank and the Government of Zambia. We fund early-stage clean energy innovation, piloting, and business model development for Zambian entrepreneurs and project developers.',
      website: 'https://greenstartup.co.zm',
      years_operating: 2,
      team_size: 8,
      registration_number: 'PACRA/2024/FAC/0012',
      ownership_structure: 'GOVERNMENT',
      ownership_details: 'Government of Zambia (50%), World Bank IDA (40%), Private Sector Advisory Board (10% non-equity governance role)',
      contact_email: 'james.mutati@greenstartup.co.zm',
      contact_phone: '+260 968 345 678',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Facility Director has 12 years in green finance at the World Bank. Deputy Director previously managed innovation grants at ZCIC (Zambia Climate Innovation Centre).',
    },
    step3_preferences: {
      min_grant_size: 100000,         // 100K ZMW
      max_grant_size: 25000000,       // 25M ZMW
      grant_types: ['INNOVATION', 'FEASIBILITY_STUDY', 'CAPACITY_BUILDING', 'BLENDED_FINANCE'],
      focus_sectors: ['SOLAR', 'WIND', 'BIOMASS', 'GEOTHERMAL', 'STORAGE'],
      geographic_focus: ['Lusaka', 'Copperbelt', 'Southern', 'Central', 'North-Western'],
      typical_timeline_months: 6,
      eligibility_criteria: 'Must be a Zambian-registered entity with a renewable energy or clean technology project. Project must demonstrate innovation, scalability, and climate impact. Preference for projects creating local jobs.',
      application_process: 'Online application → Automated eligibility check → Technical screening panel (3 weeks) → Due diligence and site visit (4 weeks) → Investment Committee approval (2 weeks) → Grant disbursement in tranches linked to milestones.',
    },
  },

  // ── Grant Provider #3 ─────────────────────────────────────
  {
    auth: {
      email: 'patricia.mwelwa@devfinance-zm.org',
      password: 'Admin1234!',
    },
    step1_profile: {
      full_name: 'Patricia Mwelwa',
    },
    step2_company: {
      name: 'Development Finance Initiative Zambia',
      country: 'Zambia',
      description:
        'Development Finance Initiative Zambia (DFI-ZM) is a multi-donor trust fund providing blended finance instruments — combining grants, concessional loans, and guarantees — to accelerate private sector investment in Zambian energy infrastructure. We focus on bridging the gap between project development and commercial bankability.',
      website: 'https://dfi-zm.org',
      years_operating: 4,
      team_size: 10,
      registration_number: 'PACRA/2021/DVI/0765',
      ownership_structure: 'NON_PROFIT',
      ownership_details: 'Multi-donor trust fund governed by a Steering Committee of contributing DFIs and the Zambian Ministry of Energy. Independent Secretariat manages day-to-day operations.',
      contact_email: 'patricia@dfi-zm.org',
      contact_phone: '+260 955 789 012',
      is_new_company_with_experienced_team: false,
      management_team_experience: { years: 0, description: '' },
      management_experience_summary: 'Chief Investment Officer has 18 years in blended finance across Africa. Previously led the energy access facility at FMO (Dutch Development Bank).',
    },
    step3_preferences: {
      min_grant_size: 250000,         // 250K ZMW
      max_grant_size: 50000000,       // 50M ZMW
      grant_types: ['PROJECT_PREPARATION', 'TECHNICAL_ASSISTANCE', 'BLENDED_FINANCE'],
      focus_sectors: ['SOLAR', 'WIND', 'HYDRO', 'STORAGE', 'GRID_INFRA'],
      geographic_focus: ['Lusaka', 'Copperbelt', 'Southern', 'North-Western', 'Northern', 'Central', 'Eastern'],
      typical_timeline_months: 8,
      eligibility_criteria: 'Project must be at pre-feasibility to financial close stage. Applicant must demonstrate co-investment capability or have a credible path to commercial financing. Priority for projects with signed or near-signed PPAs.',
      application_process: 'Expression of Interest (EOI) submission → Desk review (2 weeks) → Shortlist notification → Full application invitation (4 weeks) → Technical and financial due diligence (6 weeks) → Board approval → Grant agreement → Tranche-based disbursement against verified milestones.',
    },
  },
];

// ────────────────────────────────────────────────────────────
//  PRINT GUIDE
// ────────────────────────────────────────────────────────────

function printProfile(type, profile, index) {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${type} #${index + 1}`);
  console.log(`${'═'.repeat(64)}`);

  console.log(`\n📧 AUTH CREDENTIALS`);
  console.log(`   Email:    ${profile.auth.email}`);
  console.log(`   Password: ${profile.auth.password}`);

  console.log(`\n👤 STEP 1 — PROFILE`);
  console.log(`   Full Name: ${profile.step1_profile.full_name}`);

  const c = profile.step2_company;
  console.log(`\n🏢 STEP 2 — COMPANY INFORMATION`);
  console.log(`   Company Name:             ${c.name}`);
  console.log(`   Country:                  ${c.country}`);
  console.log(`   Description:              ${c.description}`);
  console.log(`   Website:                  ${c.website}`);
  console.log(`   Years Operating:          ${c.years_operating}`);
  console.log(`   Team Size:                ${c.team_size}`);
  console.log(`   Registration Number:      ${c.registration_number}`);
  console.log(`   Ownership Structure:      ${c.ownership_structure}`);
  console.log(`   Ownership Details:        ${c.ownership_details}`);
  console.log(`   Contact Email:            ${c.contact_email}`);
  console.log(`   Contact Phone:            ${c.contact_phone}`);
  console.log(`   New Co (Exp. Team):       ${c.is_new_company_with_experienced_team}`);
  console.log(`   Mgmt Team Experience:     ${c.management_team_experience?.years ?? 0} yrs — ${c.management_team_experience?.description || '—'}`);
  console.log(`   Management Experience:    ${c.management_experience_summary}`);

  if (profile.step3_preferences) {
    console.log(`\n⚙️  STEP 3 — PREFERENCES`);
    const p = profile.step3_preferences;
    for (const [key, value] of Object.entries(p)) {
      const formatted = Array.isArray(value) ? value.join(', ') : String(value);
      console.log(`   ${key}: ${formatted}`);
    }
  } else {
    console.log(`\n⚙️  STEP 3 — PREFERENCES: Not required for this profile type`);
  }

  console.log('');
}

// ── Main ────────────────────────────────────────────────────

console.log('\n' + '█'.repeat(64));
console.log('  AFRICONNECT — SEED PROFILES REFERENCE');
console.log('  3 examples × 6 profile types = 18 profiles');
console.log('  Use these to manually create accounts through onboarding.');
console.log('█'.repeat(64));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  HOW TO USE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  1. Sign up with the email + password below');
console.log('  2. On Step 1, enter the Full Name');
console.log('  3. On Step 2, click "Create New Company Profile"');
console.log('     and fill every field exactly as listed');
console.log('  4. On Step 3, fill every preference field');
console.log('  5. Submit → Admin verifies → Profile is live');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Print all profiles
console.log('\n\n' + '▓'.repeat(64));
console.log('  SECTION 1: DEVELOPER PROFILES');
console.log('▓'.repeat(64));
DEVELOPER_PROFILES.forEach((p, i) => printProfile('DEVELOPER', p, i));

console.log('\n\n' + '▓'.repeat(64));
console.log('  SECTION 2: CAPITAL PARTNER / FINANCIER PROFILES');
console.log('▓'.repeat(64));
CAPITAL_PROFILES.forEach((p, i) => printProfile('CAPITAL PARTNER', p, i));

console.log('\n\n' + '▓'.repeat(64));
console.log('  SECTION 3: TECHNICAL PARTNER / EPC PROFILES');
console.log('▓'.repeat(64));
TECHNICAL_PROFILES.forEach((p, i) => printProfile('TECHNICAL PARTNER', p, i));

console.log('\n\n' + '▓'.repeat(64));
console.log('  SECTION 4: CONSULTANT PROFILES');
console.log('▓'.repeat(64));
CONSULTANT_PROFILES.forEach((p, i) => printProfile('CONSULTANT', p, i));

console.log('\n\n' + '▓'.repeat(64));
console.log('  SECTION 5: POWER TRADER PROFILES');
console.log('▓'.repeat(64));
POWER_TRADER_PROFILES.forEach((p, i) => printProfile('POWER TRADER', p, i));

console.log('\n\n' + '▓'.repeat(64));
console.log('  SECTION 6: GRANT PROVIDER PROFILES');
console.log('▓'.repeat(64));
GRANT_PROVIDER_PROFILES.forEach((p, i) => printProfile('GRANT PROVIDER', p, i));

console.log('\n' + '█'.repeat(64));
console.log('  QUICK REFERENCE — ALL EMAILS');
console.log('█'.repeat(64));
console.log('\n  DEVELOPERS:');
DEVELOPER_PROFILES.forEach(p => console.log(`    • ${p.auth.email}`));
console.log('\n  CAPITAL PARTNERS:');
CAPITAL_PROFILES.forEach(p => console.log(`    • ${p.auth.email}`));
console.log('\n  TECHNICAL PARTNERS:');
TECHNICAL_PROFILES.forEach(p => console.log(`    • ${p.auth.email}`));
console.log('\n  CONSULTANTS:');
CONSULTANT_PROFILES.forEach(p => console.log(`    • ${p.auth.email}`));
console.log('\n  POWER TRADERS:');
POWER_TRADER_PROFILES.forEach(p => console.log(`    • ${p.auth.email}`));
console.log('\n  GRANT PROVIDERS:');
GRANT_PROVIDER_PROFILES.forEach(p => console.log(`    • ${p.auth.email}`));
console.log('\n  Password for all: Admin1234!');
console.log('\n' + '█'.repeat(64));
console.log('  END OF SEED PROFILES');
console.log('█'.repeat(64) + '\n');
