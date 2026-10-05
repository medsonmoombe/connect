/**
 * Seed Projects — Manual Entry Reference
 * ========================================
 * 10 fully-specified projects spanning all 5 submission steps.
 * These are designed to be created through the developer submit flow:
 *   Step 1: Project Identity
 *   Step 2: Scale & Financials
 *   Step 3: Timeline & Status (AI-determined — shown for reference)
 *   Step 4: Technical Requirements
 *   Step 5: Narrative & Submission (governance, documents, submit)
 *
 * Each project references which developer should create it (by email).
 *
 * NOTE: Document uploads require actual files on disk. Descriptions below
 * tell you what file to prepare or use as placeholder (any PDF works).
 *
 * Password for all accounts: Admin1234!
 */

// ─────────────────────────────────────────────────────────────
//  PROJECTS
// ─────────────────────────────────────────────────────────────

const PROJECTS = [
  // ──────────────────────────────────────────────────────────
  //  PROJECT 1 — Large Solar Farm, PPA Ready, Lusaka
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'james.mwanza@solargen.co.zm',
    step1: {
      name: 'Lusaka South Solar II',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'Zambia',
      location_region: 'Lusaka',
      has_secured_land: true,
      land_title_status: 'Titled',
      // Proof needed: "LAND_TITLE_PROOF" — Upload a titled lease agreement PDF
      has_reached_financial_close: false,
      regulatory_approvals: ['ZEMA approval letter', 'Grid Connection Agreement'],
      // Proofs needed: "APPROVAL_PROOF_ZEMA" and "APPROVAL_PROOF_GRID" — upload ZEMA letter + grid agreement PDFs
    },
    step2: {
      project_size_mw: 25,
      capital_required: 350000000,
      capex: 320000000,
      opex: 4500000,
      funding_required: 200000000,
      capital_structure_type: 'EQUITY',
      description: 'A 25 MW utility-scale solar photovoltaic farm located on titled land in Lusaka Province. The project targets industrial and mining offtakers and has secured a ZEMA approval and grid connection agreement with ZESCO. Land title is registered. We are seeking equity partners to fund construction and reach financial close by Q2 2027.',
    },
    step3: {
      // AI will likely determine: PPA_READY or REGULATORY_APPROVAL
      target_financial_close_date: '2027-03-31',
      target_cod: '2027-12-31',
    },
    step4: {
      terrain_complexity: 'SIMPLE',
      grid_status: 'PENDING',
      budget_preference: 'FIXED',
      ppa_status: 'IN_PROGRESS',
      required_services: ['EPC_CONSTRUCTION', 'O_AND_M', 'FINANCIAL_ADVISORY'],
    },
    step5: {
      governance_terms: 'Investor to receive one board seat with voting rights. Quarterly reporting obligations. Tag-along/drag-along provisions apply after year 5.',
      exit_terms: 'Buyback option after year 7 at fair market value. Transfer restrictions for first 3 years. Right of first refusal for co-investors.',
      risk_disclosures: 'Grid connection pending final ZESCO approval. PPA negotiations ongoing with two mining companies. Currency risk on imported panels mitigated by forward contracts.',
      // Documents to upload:
      // - "Pitch Deck": SolarGen_Lusaka_South_II_PitchDeck.pdf
      // - "Financial Model": SolarGen_Lusaka_South_II_FinancialModel.xlsx
      // - "Feasibility Study": SolarGen_Lusaka_South_II_Feasibility.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 2 — Small Hydro, Concept Stage, Northern Province
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'fatima.banda@zamhydro.energy',
    step1: {
      name: 'Chambeshi Mini Hydro',
      technology_type: 'RUN_OF_RIVER',
      location_country: 'Zambia',
      location_region: 'Northern',
      has_secured_land: false,
      land_title_status: 'Not Applicable',
      has_reached_financial_close: false,
      regulatory_approvals: [],
    },
    step2: {
      project_size_mw: 3,
      capital_required: 45000000,
      capex: 40000000,
      opex: 1200000,
      funding_required: 45000000,
      capital_structure_type: 'PROFIT_SHARING',
      description: 'A 3 MW run-of-river hydropower project on the Chambeshi River in Northern Province. Early-stage concept with preliminary hydrology data. The project will serve rural electrification in Kasama district. We seek grant funding for feasibility studies and technical assistance to reach bankability.',
    },
    step3: {
      target_financial_close_date: '2028-06-30',
      target_cod: '2029-06-30',
    },
    step4: {
      terrain_complexity: 'MODERATE',
      grid_status: 'OFF_GRID',
      budget_preference: 'MILESTONE',
      ppa_status: 'NOT_STARTED',
      required_services: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'LEGAL_ADVISORY'],
    },
    step5: {
      governance_terms: 'Open to discussion. Grant providers may require milestone-based reporting and site visit access.',
      exit_terms: 'Not yet defined — early stage.',
      risk_disclosures: 'Hydrology data is preliminary (6-month flow gauge). Land tenure is traditional — community engagement required. No PPA or grid connection yet. Remote location increases logistics cost.',
      // Documents to upload:
      // - "Pitch Deck": ZamHydro_Chambeshi_PitchDeck.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 3 — Wind-Solar Hybrid, PPA Signed, Lusaka
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'chanda.k@windforce.co.zm',
    step1: {
      name: 'Kafue Wind-Solar Hybrid',
      technology_type: 'OTHER',
      location_country: 'Zambia',
      location_region: 'Lusaka',
      has_secured_land: true,
      land_title_status: 'Titled',
      has_reached_financial_close: false,
      regulatory_approvals: ['ZEMA approval letter', 'Power Purchase Agreement (PPA)', 'Construction Permit'],
    },
    step2: {
      project_size_mw: 15,
      capital_required: 220000000,
      capex: 200000000,
      opex: 3200000,
      funding_required: 150000000,
      capital_structure_type: 'DEBT',
      description: 'A 15 MW wind-solar hybrid project in Lusaka Province. Combines 8 MW onshore wind with 7 MW solar PV to maximize capacity factor. PPA signed with two mining companies for 12 years. ZEMA approved, construction permit issued. Seeking debt financing to complement equity already committed by founders.',
    },
    step3: {
      target_financial_close_date: '2026-12-31',
      target_cod: '2027-09-30',
    },
    step4: {
      terrain_complexity: 'MODERATE',
      grid_status: 'PENDING',
      budget_preference: 'FIXED',
      ppa_status: 'SECURED',
      required_services: ['EPC_CONSTRUCTION', 'O_AND_M', 'FINANCIAL_ADVISORY', 'LOGISTICS'],
    },
    step5: {
      governance_terms: 'Lender to receive observer seat on project board. Standard project finance covenants. Debt service reserve account required.',
      exit_terms: 'Debt to be repaid over 12-year PPA term. Equity buyback after debt maturity. No transfer restrictions post-financial close.',
      risk_disclosures: 'Hybrid technology is relatively new in Zambia — limited local track record. Wind resource data based on 12-month measurement campaign. Grid connection agreement pending final ZESCO approval. Two offtakers provide revenue diversification.',
      // Documents to upload:
      // - "Pitch Deck": WindForce_Kafue_Hybrid_PitchDeck.pdf
      // - "Financial Model": WindForce_Kafue_Hybrid_FinancialModel.xlsx
      // - "Feasibility Study": WindForce_Kafue_Hybrid_Feasibility.pdf
      // - "Environmental Audit": WindForce_Kafue_Hybrid_EIA.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 4 — Solar + Storage, Pre-Feasibility, Copperbelt
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'james.mwanza@solargen.co.zm',
    step1: {
      name: 'Kitwe Solar Storage Park',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'Zambia',
      location_region: 'Copperbelt',
      has_secured_land: false,
      land_title_status: 'Not Applicable',
      has_reached_financial_close: false,
      regulatory_approvals: [],
    },
    step2: {
      project_size_mw: 50,
      capital_required: 750000000,
      capex: 680000000,
      opex: 8500000,
      funding_required: 750000000,
      capital_structure_type: 'EQUITY',
      description: 'A 50 MW solar PV + 20 MWh lithium-ion battery storage project in the Copperbelt. Targets mining operations requiring reliable daytime and evening power. Pre-feasibility stage with wind/solar resource assessment underway. Seeking equity investment and technical partners for detailed design.',
    },
    step3: {
      target_financial_close_date: '2028-03-31',
      target_cod: '2029-03-31',
    },
    step4: {
      terrain_complexity: 'MODERATE',
      grid_status: 'PENDING',
      budget_preference: 'NEGOTIABLE',
      ppa_status: 'NOT_STARTED',
      required_services: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'EPC_CONSTRUCTION', 'FINANCIAL_ADVISORY', 'GRID_CONNECTION'],
    },
    step5: {
      governance_terms: 'Equity investor to receive board seat. Co-investment rights for follow-on rounds. Standard minority protections.',
      exit_terms: 'IPO or trade sale after year 7. Tag-along and drag-along rights. Pre-emption on new share issues.',
      risk_disclosures: 'Land not yet secured — traditional authority negotiations in progress. Battery storage adds technology risk. No PPA yet — merchant risk assumed. Mining offtaker interest is informal only.',
      // Documents to upload:
      // - "Pitch Deck": SolarGen_Kitwe_Storage_PitchDeck.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 5 — Biomass, Feasibility Stage, Southern Province
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'fatima.banda@zamhydro.energy',
    step1: {
      name: 'Choma Biomass Power Plant',
      technology_type: 'OTHER',
      location_country: 'Zambia',
      location_region: 'Southern',
      has_secured_land: true,
      land_title_status: 'Traditional',
      has_reached_financial_close: false,
      regulatory_approvals: ['ZEMA approval letter'],
    },
    step2: {
      project_size_mw: 8,
      capital_required: 120000000,
      capex: 105000000,
      opex: 3800000,
      funding_required: 80000000,
      capital_structure_type: 'EQUITY',
      description: 'An 8 MW biomass power plant using agricultural waste (maize stover and sugarcane bagasse) from the Choma farming district. Feasibility study completed with positive results. ZEMA approved. Land secured under traditional lease. Seeking equity and debt to fund construction and equipment procurement.',
    },
    step3: {
      target_financial_close_date: '2027-06-30',
      target_cod: '2028-03-31',
    },
    step4: {
      terrain_complexity: 'SIMPLE',
      grid_status: 'PENDING',
      budget_preference: 'FIXED',
      ppa_status: 'NOT_STARTED',
      required_services: ['EPC_CONSTRUCTION', 'O_AND_M', 'LEGAL_ADVISORY', 'FINANCIAL_ADVISORY'],
    },
    step5: {
      governance_terms: 'Equity investor to receive one board seat. Annual audit rights. Information rights quarterly.',
      exit_terms: 'Buyback after year 5 at book value + 15% premium. Transfer restrictions for first 3 years.',
      risk_disclosures: 'Biomass feedstock supply depends on agricultural cycles. Traditional land lease may need conversion to titled. No PPA yet — targeting C&I offtakers. Fuel quality variability risk.',
      // Documents to upload:
      // - "Pitch Deck": ZamHydro_Choma_Biomass_PitchDeck.pdf
      // - "Feasibility Study": ZamHydro_Choma_Biomass_Feasibility.pdf
      // - "Environmental Audit": ZamHydro_Choma_Biomass_EIA.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 6 — Large Solar, Financial Close, Lusaka
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'james.mwanza@solargen.co.zm',
    step1: {
      name: 'Kafue Gateway Solar Farm',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'Zambia',
      location_region: 'Lusaka',
      has_secured_land: true,
      land_title_status: 'Titled',
      has_reached_financial_close: true,
      // Proof needed: "FINANCIAL_CLOSE_PROOF" — upload signed facility agreement
      regulatory_approvals: ['ZEMA approval letter', 'Grid Connection Agreement', 'Power Purchase Agreement (PPA)', 'Construction Permit'],
    },
    step2: {
      project_size_mw: 100,
      capital_required: 1500000000,
      capex: 1350000000,
      opex: 15000000,
      funding_required: 0,
      capital_structure_type: 'EQUITY',
      description: 'A 100 MW utility-scale solar PV farm at financial close. Fully permitted with ZEMA, grid connection, PPA (20-year with ZESCO), and construction permit. Debt facility signed with two DFIs. Equity committed by two international investors. Now selecting EPC contractor for construction starting Q1 2027.',
    },
    step3: {
      target_financial_close_date: '2026-09-30',
      target_cod: '2027-09-30',
    },
    step4: {
      terrain_complexity: 'SIMPLE',
      grid_status: 'CONNECTED',
      budget_preference: 'FIXED',
      ppa_status: 'SECURED',
      required_services: ['EPC_CONSTRUCTION', 'O_AND_M', 'LOGISTICS'],
    },
    step5: {
      governance_terms: 'Standard project finance governance. Lender step-in rights. Independent engineer oversight during construction.',
      exit_terms: 'Equity returns via dividends over 20-year PPA. Refinancing option after year 5. No transfer restrictions post-COD.',
      risk_disclosures: 'Construction risk — EPC selection pending. Currency risk on imported equipment. Solar resource based on 24-month measurement campaign. PPA counterparty risk with ZESCO.',
      // Documents to upload:
      // - "Pitch Deck": SolarGen_Kafue_Gateway_PitchDeck.pdf
      // - "Financial Model": SolarGen_Kafue_Gateway_FinancialModel.xlsx
      // - "Feasibility Study": SolarGen_Kafue_Gateway_Feasibility.pdf
      // - "Environmental Audit": SolarGen_Kafue_Gateway_EIA.pdf
      // - "Land Title/Lease Agreement": SolarGen_Kafue_Gateway_LandTitle.pdf
      // - "Regulatory Approval Docs": SolarGen_Kafue_Gateway_Regulatory.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 7 — Off-Grid Solar + Storage, Concept, Western
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'chanda.k@windforce.co.zm',
    step1: {
      name: 'Mongu Off-Grid Solar Hub',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'Zambia',
      location_region: 'Western',
      has_secured_land: false,
      land_title_status: 'Not Applicable',
      has_reached_financial_close: false,
      regulatory_approvals: [],
    },
    step2: {
      project_size_mw: 2,
      capital_required: 30000000,
      capex: 25000000,
      opex: 800000,
      funding_required: 30000000,
      capital_structure_type: 'GRANT',
      description: 'A 2 MW off-grid solar PV + 5 MWh vanadium flow battery storage mini-grid serving Mongu town and surrounding communities. Concept stage with preliminary load assessment. Seeking grant funding for detailed feasibility and community engagement. Targets 15,000 households currently without reliable power.',
    },
    step3: {
      target_financial_close_date: '2028-12-31',
      target_cod: '2030-06-30',
    },
    step4: {
      terrain_complexity: 'COMPLEX',
      grid_status: 'OFF_GRID',
      budget_preference: 'MILESTONE',
      ppa_status: 'NOT_APPLICABLE',
      required_services: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'LEGAL_ADVISORY', 'FINANCIAL_ADVISORY'],
    },
    step5: {
      governance_terms: 'Grant provider reporting requirements. Community advisory board with 30% local representation.',
      exit_terms: 'Community ownership transfer after 15 years. No investor exit mechanism — grant-funded.',
      risk_disclosures: 'Very early stage — no formal studies completed. Flood-prone area (Barotse Floodplain). Community land tenure complexity. No PPA — tariff-based revenue model. Vanadium flow battery technology is emerging.',
      // Documents to upload:
      // - "Pitch Deck": WindForce_Mongu_OffGrid_PitchDeck.pdf
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 8 — Small Solar C&I, Regulatory Approval, Copperbelt
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'james.mwanza@solargen.co.zm',
    step1: {
      name: 'Ndola Industrial Solar Rooftop',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'Zambia',
      location_region: 'Copperbelt',
      has_secured_land: true,
      land_title_status: 'Titled',
      has_reached_financial_close: false,
      regulatory_approvals: ['ZEMA approval letter', 'Construction Permit'],
    },
    step2: {
      project_size_mw: 1.5,
      capital_required: 18000000,
      capex: 15000000,
      opex: 400000,
      funding_required: 10000000,
      capital_structure_type: 'LEASING',
      description: 'A 1.5 MW commercial & industrial rooftop solar installation across three factory buildings in Ndola. ZEMA approved and construction permit issued. Land (rooftop) secured under long-term lease with factory owner. Seeking leasing partner to fund equipment procurement. PPA with factory at $0.08/kWh for 10 years.',
    },
    step3: {
      target_financial_close_date: '2027-01-31',
      target_cod: '2027-06-30',
    },
    step4: {
      terrain_complexity: 'SIMPLE',
      grid_status: 'CONNECTED',
      budget_preference: 'FIXED',
      ppa_status: 'SECURED',
      required_services: ['EPC_CONSTRUCTION', 'O_AND_M'],
    },
    step5: {
      governance_terms: 'Leasing partner retains ownership of equipment. Operator (SolarGen) manages O&M under separate agreement.',
      exit_terms: 'Equipment ownership transfers to factory owner after lease term (10 years). No investor exit needed — leasing structure.',
      risk_disclosures: 'Small scale limits negotiating power with suppliers. Factory roof structural assessment pending. Single offtaker concentration risk. Leasing structure may not suit all investors.',
      // Documents to upload:
      // - "Pitch Deck": SolarGen_Ndola_Rooftop_PitchDeck.pdf
      // - "Financial Model": SolarGen_Ndola_Rooftop_FinancialModel.xlsx
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 9 — Wind Farm, Pre-Feasibility, Southern
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'chanda.k@windforce.co.zm',
    step1: {
      name: 'Livingstone Wind Corridor',
      technology_type: 'ONSHORE_WIND',
      location_country: 'Zambia',
      location_region: 'Southern',
      has_secured_land: false,
      land_title_status: 'Not Applicable',
      has_reached_financial_close: false,
      regulatory_approvals: [],
    },
    step2: {
      project_size_mw: 40,
      capital_required: 600000000,
      capex: 540000000,
      opex: 7200000,
      funding_required: 600000000,
      capital_structure_type: 'EQUITY',
      description: 'A 40 MW onshore wind farm along the Livingstone wind corridor near Victoria Falls. 12-month wind measurement campaign shows average wind speed of 7.2 m/s at 100m hub height. Pre-feasibility stage with preliminary energy yield assessment. Seeking equity investment and EPC partner for detailed design and permitting.',
    },
    step3: {
      target_financial_close_date: '2028-09-30',
      target_cod: '2029-12-31',
    },
    step4: {
      terrain_complexity: 'COMPLEX',
      grid_status: 'PENDING',
      budget_preference: 'NEGOTIABLE',
      ppa_status: 'NOT_STARTED',
      required_services: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'EPC_CONSTRUCTION', 'FINANCIAL_ADVISORY', 'GRID_CONNECTION'],
    },
    step5: {
      governance_terms: 'Equity investor to receive board seat. Co-investment rights. Standard minority protections and anti-dilution.',
      exit_terms: 'Trade sale or IPO after year 8. Tag-along and drag-along. Pre-emption rights.',
      risk_disclosures: 'Wind resource is preliminary — 12-month measurement. Remote terrain increases construction cost. No grid connection agreement yet. Tourism area near Victoria Falls may face environmental opposition. Wind technology less proven in Zambia than solar.',
      // Documents to upload:
      // - "Pitch Deck": WindForce_Livingstone_Wind_PitchDeck.pdf
      // - "Feasibility Study": WindForce_Livingstone_Wind_Feasibility.pdf (preliminary)
    },
  },

  // ──────────────────────────────────────────────────────────
  //  PROJECT 10 — Geothermal, Concept, Northern Province
  // ──────────────────────────────────────────────────────────
  {
    developer_email: 'fatima.banda@zamhydro.energy',
    step1: {
      name: 'Mpulungu Geothermal Exploration',
      technology_type: 'OTHER',
      location_country: 'Zambia',
      location_region: 'Northern',
      has_secured_land: false,
      land_title_status: 'Not Applicable',
      has_reached_financial_close: false,
      regulatory_approvals: [],
    },
    step2: {
      project_size_mw: 5,
      capital_required: 60000000,
      capex: 50000000,
      opex: 1500000,
      funding_required: 60000000,
      capital_structure_type: 'GRANT',
      description: 'A 5 MW geothermal power exploration project near Lake Tanganyika in Mpulungu. Hot springs identified with surface temperatures of 65-80°C. Concept stage with no formal resource assessment. Seeking grant funding for geothermal resource exploration, test drilling, and environmental baseline studies. First geothermal project in Zambia.',
    },
    step3: {
      target_financial_close_date: '2029-12-31',
      target_cod: '2031-12-31',
    },
    step4: {
      terrain_complexity: 'COMPLEX',
      grid_status: 'OFF_GRID',
      budget_preference: 'MILESTONE',
      ppa_status: 'NOT_APPLICABLE',
      required_services: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'LEGAL_ADVISORY'],
    },
    step5: {
      governance_terms: 'Grant provider to receive quarterly progress reports and site visit access. Technical advisory board with geothermal specialist.',
      exit_terms: 'No investor exit — grant-funded exploration. IP ownership to remain with ZamHydro.',
      risk_disclosures: 'Very high risk — no proven geothermal resource. Exploration drilling may not find viable resource. Remote location with limited infrastructure. No regulatory framework for geothermal in Zambia. Lake Tanganyika environmental sensitivity.',
      // Documents to upload:
      // - "Pitch Deck": ZamHydro_Mpulungu_Geo_PitchDeck.pdf
    },
  },
];

// ─────────────────────────────────────────────────────────────
//  PRINT GUIDE
// ─────────────────────────────────────────────────────────────

function printProject(project, index) {
  const s1 = project.step1;
  const s2 = project.step2;
  const s3 = project.step3;
  const s4 = project.step4;
  const s5 = project.step5;

  console.log(`\n${'═'.repeat(68)}`);
  console.log(`  PROJECT #${index + 1}: ${s1.name}`);
  console.log(`${'═'.repeat(68)}`);

  console.log(`\n👤 CREATE AS: ${project.developer_email}`);

  console.log(`\n📋 STEP 1 — PROJECT IDENTITY`);
  console.log(`   Project Name:        ${s1.name}`);
  console.log(`   Technology Type:     ${s1.technology_type}`);
  console.log(`   Country:             ${s1.location_country}`);
  console.log(`   Region:              ${s1.location_region}`);
  console.log(`   Secured Land:        ${s1.has_secured_land ? 'Yes' : 'No'}`);
  if (s1.has_secured_land) console.log(`   Land Title Status:   ${s1.land_title_status}`);
  console.log(`   Financial Close:     ${s1.has_reached_financial_close ? 'Yes' : 'No'}`);
  if (s1.regulatory_approvals.length > 0) {
    console.log(`   Regulatory Approvals:`);
    s1.regulatory_approvals.forEach(a => console.log(`     ☑ ${a}`));
  }

  console.log(`\n💰 STEP 2 — SCALE & FINANCIALS`);
  console.log(`   Project Size:        ${s2.project_size_mw} MW`);
  console.log(`   Capital Required:    ZMW ${(s2.capital_required / 1_000_000).toFixed(0)}M`);
  console.log(`   CAPEX:               ZMW ${(s2.capex / 1_000_000).toFixed(0)}M`);
  console.log(`   OPEX (annual):       ZMW ${(s2.opex / 1_000_000).toFixed(1)}M`);
  console.log(`   Funding Required:    ZMW ${(s2.funding_required / 1_000_000).toFixed(0)}M`);
  console.log(`   Capital Structure:   ${s2.capital_structure_type}`);
  console.log(`   Description:         ${s2.description}`);

  console.log(`\n📅 STEP 3 — TIMELINE & STATUS`);
  console.log(`   Target Financial Close: ${s3.target_financial_close_date}`);
  console.log(`   Target COD:             ${s3.target_cod}`);
  console.log(`   (Note: AI will determine the project stage automatically)`);

  console.log(`\n⚙️  STEP 4 — TECHNICAL REQUIREMENTS`);
  console.log(`   Terrain Complexity:  ${s4.terrain_complexity}`);
  console.log(`   Grid Status:         ${s4.grid_status}`);
  console.log(`   Budget Preference:   ${s4.budget_preference}`);
  console.log(`   PPA Status:          ${s4.ppa_status}`);
  console.log(`   Required Services:   ${s4.required_services.join(', ')}`);

  console.log(`\n📝 STEP 5 — NARRATIVE & SUBMISSION`);
  if (s5.governance_terms) console.log(`   Governance Terms:    ${s5.governance_terms}`);
  if (s5.exit_terms) console.log(`   Exit Terms:          ${s5.exit_terms}`);
  if (s5.risk_disclosures) console.log(`   Risk Disclosures:    ${s5.risk_disclosures}`);
  console.log(`   Documents Required:  See below`);

  // Collect document hints
  const docHints = [];
  if (s1.has_secured_land) docHints.push('  → LAND_TITLE_PROOF (land title / lease agreement)');
  if (s1.has_reached_financial_close) docHints.push('  → FINANCIAL_CLOSE_PROOF (signed facility agreement)');
  s1.regulatory_approvals.forEach(a => {
    if (a === 'ZEMA approval letter') docHints.push('  → APPROVAL_PROOF_ZEMA (ZEMA approval letter)');
    if (a === 'Grid Connection Agreement') docHints.push('  → APPROVAL_PROOF_GRID (grid connection agreement)');
    if (a === 'Power Purchase Agreement (PPA)') docHints.push('  → APPROVAL_PROOF_PPA (signed PPA)');
    if (a === 'Construction Permit') docHints.push('  → APPROVAL_PROOF_PERMIT (construction permit)');
  });
  if (docHints.length > 0) {
    console.log(`   Proof Documents (required):`);
    docHints.forEach(h => console.log(h));
  }

  console.log(`\n📄 DOCUMENTS TO UPLOAD:`);
  if (s2.project_size_mw >= 50) {
    console.log(`  • Pitch Deck (required)`);
    console.log(`  • Financial Model`);
    console.log(`  • Feasibility Study`);
    console.log(`  • Environmental Audit / EIA`);
  } else if (s2.project_size_mw >= 10) {
    console.log(`  • Pitch Deck (required)`);
    console.log(`  • Financial Model`);
    console.log(`  • Feasibility Study`);
  } else {
    console.log(`  • Pitch Deck (required)`);
  }

  console.log('');
}

// ── Main ────────────────────────────────────────────────────

console.log('\n' + '█'.repeat(68));
console.log('  AFRICONNECT — SEED PROJECTS REFERENCE');
console.log('  10 projects across all development stages');
console.log('  Use these to manually create projects through the submit flow.');
console.log('█'.repeat(68));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  HOW TO USE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  1. Log in as the developer listed for each project');
console.log('  2. Go to Developer → Submit Project');
console.log('  3. Fill Step 1 through Step 5 exactly as listed');
console.log('  4. For proof documents — upload any PDF placeholder file');
console.log('  5. For general documents — upload any PDF for the Pitch Deck');
console.log('  6. Submit → AI scores the project → It goes live');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Print all projects
PROJECTS.forEach((p, i) => printProject(p, i));

// Quick reference summary
console.log('\n' + '█'.repeat(68));
console.log('  QUICK REFERENCE — ALL PROJECTS');
console.log('█'.repeat(68));
console.log('');
console.log('  #  | Project Name                        | Developer                    | MW   | Capital (ZMW)  | Stage Target');
console.log('  ---|-------------------------------------|------------------------------|------|----------------|------------------');
PROJECTS.forEach((p, i) => {
  const num = String(i + 1).padStart(2);
  const name = p.step1.name.padEnd(35).substring(0, 35);
  const dev = p.developer_email.padEnd(28).substring(0, 28);
  const mw = String(p.step2.project_size_mw).padStart(4);
  const cap = `ZMW ${(p.step2.capital_required / 1_000_000).toFixed(0)}M`.padStart(14);
  const stage = p.step1.has_reached_financial_close ? 'Financial Close' :
    p.step1.regulatory_approvals.length >= 3 ? 'PPA Ready' :
    p.step1.regulatory_approvals.length >= 1 ? 'Regulatory' :
    p.step2.project_size_mw >= 10 ? 'Pre-Feasibility' : 'Concept';
  console.log(`  ${num} | ${name} | ${dev} | ${mw} | ${cap} | ${stage}`);
});

console.log('\n  Developer Accounts (Password: Admin1234!):');
const devs = [...new Set(PROJECTS.map(p => p.developer_email))];
devs.forEach(e => console.log(`    • ${e}`));
const devCounts = {};
PROJECTS.forEach(p => { devCounts[p.developer_email] = (devCounts[p.developer_email] || 0) + 1; });
console.log('\n  Projects per developer:');
Object.entries(devCounts).forEach(([e, c]) => console.log(`    • ${e}: ${c} project(s)`));

console.log('\n' + '█'.repeat(68));
console.log('  END OF SEED PROJECTS');
console.log('█'.repeat(68) + '\n');
