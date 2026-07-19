-- Migration 033: Add UNIQUE constraint on partner profile company_id + cleanup

-- Add UNIQUE constraints to prevent duplicate partner profiles per company
ALTER TABLE capital_partners ADD CONSTRAINT capital_partners_company_id_unique UNIQUE (company_id);
ALTER TABLE technical_partners ADD CONSTRAINT technical_partners_company_id_unique UNIQUE (company_id);
ALTER TABLE power_traders ADD CONSTRAINT power_traders_company_id_unique UNIQUE (company_id);
