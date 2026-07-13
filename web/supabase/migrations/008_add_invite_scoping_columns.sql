-- Migration 008: Add company scoping columns to setup_invites
-- Allows org-level invites tied to a specific company and membership role.

ALTER TABLE setup_invites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE setup_invites ADD COLUMN IF NOT EXISTS membership_role text DEFAULT 'MEMBER';
