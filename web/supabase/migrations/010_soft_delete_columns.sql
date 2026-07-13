-- Migration 010: Add deleted_at soft-delete columns to all major tables
-- Run this in Supabase Dashboard → SQL Editor

-- Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;

-- Project documents
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_project_documents_deleted_at ON project_documents(deleted_at) WHERE deleted_at IS NULL;

-- Companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at) WHERE deleted_at IS NULL;

-- Company members
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_deleted_at ON company_members(deleted_at) WHERE deleted_at IS NULL;

-- Setup invites
ALTER TABLE setup_invites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_setup_invites_deleted_at ON setup_invites(deleted_at) WHERE deleted_at IS NULL;

-- Notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NULL;
