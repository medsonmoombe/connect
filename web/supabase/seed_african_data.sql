-- Seed Data for Afri Connect (Sub-Saharan African Context)

-- 1. Companies
INSERT INTO companies (id, name, type, country, years_operating, team_size, website, description)
VALUES 
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Zambia Power Dev', 'DEVELOPER', 'Zambia', 12, 45, 'https://zambiapower.com', 'Leading renewable energy developer in the Copperbelt region.'),
  ('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Nairobi Energy Systems', 'DEVELOPER', 'Kenya', 8, 30, 'https://nairobienergy.ke', 'Focused on small-to-medium scale hydro and solar implementations.'),
  ('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'Lagos Wind Ventures', 'DEVELOPER', 'Nigeria', 15, 60, 'https://lagoswind.com', 'Pioneering offshore and coastal wind projects in West Africa.'),
  ('d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8g', 'GreenGrowth Capital', 'CAPITAL', 'South Africa', 20, 150, 'https://greengrowth.cap', 'Institutional infrastructure fund focused on ESG-compliant energy projects.'),
  ('e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8g9h', 'Sahara Impact Fund', 'CAPITAL', 'Mauritius', 10, 25, 'https://saharainpact.io', 'Venture capital firm targeting high-growth utility-scale solar in Sub-Saharan Africa.'),
  ('f6a7b8c9-d0e1-4fa0-3b4c-5d6e7f8g9h0i', 'Global EPC Solutions', 'TECHNICAL', 'Zambia', 25, 500, 'https://globalepc.com', 'Tier 1 EPC contractor for power generation and transmission lines.'),
  ('g7b8c9d0-e1f2-4fb1-4c5d-6e7f8g9h0i1j', 'EcoTech Engineering', 'TECHNICAL', 'Kenya', 15, 120, 'https://ecotech.eng', 'Specialized in hydro-mechanical engineering and O&M services.')
ON CONFLICT (id) DO NOTHING;

-- 2. Capital Partners
INSERT INTO capital_partners (company_id, preferred_structures, min_ticket_size, max_ticket_size, risk_tolerance, governance_preference, geographic_focus, sector_focus)
VALUES 
  ('d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8g', ARRAY['EQUITY', 'PROFIT_SHARING']::capital_structure_type[], 10000000, 100000000, 'LOW', 'PASSIVE', ARRAY['Zambia', 'South Africa', 'Kenya'], ARRAY['Solar', 'Wind']),
  ('e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8g9h', ARRAY['EQUITY', 'GRANT']::capital_structure_type[], 500000, 5000000, 'HIGH', 'ACTIVE_ROLE', ARRAY['Nigeria', 'Ghana', 'Kenya'], ARRAY['Solar', 'BESS'])
ON CONFLICT (id) DO NOTHING;

-- 3. Technical Partners
INSERT INTO technical_partners (company_id, service_categories, sector_experience, min_mw_capacity, max_mw_capacity, regions_operated, annual_delivery_capacity_mw, total_mw_delivered, bonding_capacity)
VALUES 
  ('f6a7b8c9-d0e1-4fa0-3b4c-5d6e7f8g9h0i', ARRAY['EPC', 'Engineering Design'], ARRAY['Solar PV', 'Wind', 'Transmission'], 10, 500, ARRAY['Zambia', 'DRC', 'Angola'], 250, 1500, 100000000),
  ('g7b8c9d0-e1f2-4fb1-4c5d-6e7f8g9h0i1j', ARRAY['O&M', 'Advisory'], ARRAY['Small Hydro', 'Solar PV'], 1, 50, ARRAY['Kenya', 'Uganda', 'Tanzania'], 50, 200, 10000000)
ON CONFLICT (id) DO NOTHING;

-- 4. Projects
INSERT INTO projects (id, developer_id, name, technology_type, location_country, project_size_mw, capital_required, capital_structure_type, project_stage, status)
VALUES 
  ('p1-solar-zambia', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Solana West Phase II', 'Solar PV', 'Zambia', 40.00, 35000000, 'EQUITY', 'FINANCIAL_CLOSE', 'live'),
  ('p2-hydro-kenya', 'b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Rift Valley Small Hydro', 'Small Hydro', 'Kenya', 12.50, 18000000, 'PROFIT_SHARING', 'FEASIBILITY', 'live'),
  ('p3-wind-nigeria', 'c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'Lagos Coastal Wind', 'Wind', 'Nigeria', 150.00, 120000000, 'EQUITY', 'PERMITTING', 'live'),
  ('p4-bess-kenya', 'b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Nairobi Industrial BESS', 'BESS', 'Kenya', 5.00, 4500000, 'LEASING', 'FINANCIAL_CLOSE', 'live'),
  ('p5-solar-zambia', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Copperbelt Mining Solar', 'Solar PV', 'Zambia', 20.00, 15000000, 'EQUITY', 'OPERATIONS', 'live')
ON CONFLICT (id) DO NOTHING;

-- 5. Project Scores
INSERT INTO project_scores (project_id, capital_readiness_score, regulatory_score, financial_score, developer_score, summary)
VALUES 
  ('p1-solar-zambia', 92, 38, 32, 22, 'Exceptional utility-scale solar project with all land rights secured and Grid Impact Study approved by ZESCO.'),
  ('p2-hydro-kenya', 68, 25, 20, 23, 'Promising small hydro project. Regulatory permits for water abstraction pending final NEMA clearance.'),
  ('p3-wind-nigeria', 75, 30, 25, 20, 'First-of-its-kind coastal wind in Lagos. Feasibility studies complete, looking for anchor equity partner.'),
  ('p4-bess-kenya', 88, 35, 30, 23, 'Ready-to-build storage solution for industrial park stability. Highly bankable IRR with immediate deployment.'),
  ('p5-solar-zambia', 100, 40, 35, 25, 'Fully operational asset. Looking for secondary market equity exit.')
ON CONFLICT (project_id) DO NOTHING;

-- 6. Audit Logs (Recent activity)
INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id)
VALUES 
  (NULL, 'PROJECT_VIEW', 'PROJECT', 'p1-solar-zambia'),
  (NULL, 'PROJECT_VIEW', 'PROJECT', 'p2-hydro-kenya'),
  (NULL, 'PROJECT_VIEW', 'PROJECT', 'p3-wind-nigeria'),
  (NULL, 'PROJECT_VIEW', 'PROJECT', 'p1-solar-zambia'),
  (NULL, 'DATAROOM_ACCESS', 'PROJECT', 'p1-solar-zambia')
ON CONFLICT (id) DO NOTHING;
