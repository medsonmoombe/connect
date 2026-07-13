-- Migration 011: Create power_traders table for Power Trader role preferences
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS power_traders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  license_type                TEXT NOT NULL,
  max_offtake_capacity_mw     DECIMAL(10,2),
  preferred_technology_types  TEXT[],
  regions_of_interest         TEXT[],
  min_ppa_duration_years      INTEGER,
  credit_rating_equivalent    TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE power_traders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON power_traders FOR ALL USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_power_traders_company_id ON power_traders(company_id);
