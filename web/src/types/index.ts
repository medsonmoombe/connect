// User Roles (derived from org.primary_role or org membership role)
export type UserRole = 'DEVELOPER' | 'CAPITAL_PARTNER' | 'TECHNICAL_PARTNER' | 'ADMIN' | 'POWER_TRADER' | 'GRANT_PROVIDER';

// Organization membership roles (organization_members.role)
export type OrgMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

// Platform Admin vs Org Admin distinction:
// - Platform Admin: membership.role === 'ADMIN' (internal staff, full system access)
// - Org Admin: membership.role !== 'ADMIN' but user.role is derived from org.primary_role
//   (manages their own org's users/projects/settings)

// Company Types
export type CompanyType = 'DEVELOPER' | 'CAPITAL' | 'TECHNICAL' | 'POWER_TRADER';

// Project Stages
export type ProjectStage = 'CONCEPT' | 'FEASIBILITY' | 'PERMITTING' | 'FINANCIAL_CLOSE' | 'CONSTRUCTION' | 'OPERATIONS';

// Capital Structure Types (No debt instruments allowed)
export type CapitalStructureType = 'EQUITY' | 'PROFIT_SHARING' | 'LEASING' | 'GRANT';

// Risk Tolerance
export type RiskTolerance = 'LOW' | 'MEDIUM' | 'HIGH';

// Governance Preference
export type GovernancePreference = 'PASSIVE' | 'BOARD_SEAT' | 'ACTIVE_ROLE';

export interface PowerTrader {
  id: string;
  company_id: string;
  license_type: string;
  max_offtake_capacity_mw: number;
  preferred_technology_types: string[];
  regions_of_interest: string[];
  min_ppa_duration_years: number;
  credit_rating_equivalent?: string;
  company?: Company;
}

// Engagement Status
export type EngagementStatus = 'INTRO_SENT' | 'INTRO_ACCEPTED' | 'NDA_SIGNED' | 'DUE_DILIGENCE' | 'TERM_SHEET' | 'CLOSED' | 'DROPPED' | 'CONTRACT_SIGNED' | 'CAPITAL_COMMITTED';

// Counterparty Type
export type CounterpartyType = 'CAPITAL' | 'TECHNICAL';

// User Type
export interface User {
  id: string;
  email: string;
  role: UserRole;
  company_id?: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  created_at: string;
  full_name?: string;
  avatar_url?: string;
}

// Company Type
export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  country: string;
  years_operating: number;
  team_size: number;
  website?: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  is_new_company_with_experienced_team?: boolean;
  management_team_experience?: any;
  project_submission_mode?: 'internal_review' | 'direct';
  internal_reviewer_id?: string | null;
  is_platform_org?: boolean;
}

// Project Type
export interface Project {
  id: string;
  developer_id: string;
  created_by?: string;
  name: string;
  technology_type: string;
  location_country: string;
  location_region?: string;
  project_size_mw: number;
  capital_required: number;
  capital_structure_type: CapitalStructureType;
  governance_terms?: string;
  exit_terms?: string;
  risk_disclosures?: string;
  project_stage: ProjectStage;
  status?: 'draft' | 'scoring' | 'pending_live' | 'live' | 'deactivated' | 'archived';
  is_visible_to_investors?: boolean;
  scores_visible_at?: string | null;
  rejection_reason?: string | null;
  target_financial_close_date?: string;
  target_cod?: string;
  created_at: string;
  updated_at?: string;
  // Checklist Fields
  has_secured_land?: boolean;
  land_title_status?: 'Traditional' | 'Titled' | 'Not Applicable';
  has_reached_financial_close?: boolean;
  regulatory_approvals?: string[];
  // Related data
  developer?: Company;
  documents?: ProjectDocument[];
  scores?: ProjectScore;
  tech_requirements?: ProjectTechRequirements;
}

// Project Document
export interface ProjectDocument {
  id: string;
  project_id: string;
  document_type: string;
  file_url: string;
  storage_path?: string;
  file_hash?: string;
  classification?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  uploaded_at: string;
}

// Project Technical Requirements
export interface ProjectTechRequirements {
  project_id: string;
  required_services: string[];
  terrain_complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  grid_status: 'CONNECTED' | 'PENDING' | 'OFF_GRID';
  budget_preference: 'FIXED' | 'MILESTONE' | 'NEGOTIABLE';
}

// Project Scores
export interface ProjectScore {
  id: string;
  project_id: string;
  capital_readiness_score: number;
  technical_readiness_score: number;
  documentation_score: number;
  governance_score: number;
  financial_transparency_score: number;
  regulatory_score?: number;
  financial_score?: number;
  developer_score?: number;
  breakdown?: any;
  risk_flags: string[];
  recommendations: string[];
  summary?: string;
  created_at: string;
}

// Capital Partner
export interface CapitalPartner {
  id: string;
  company_id: string;
  min_ticket_size: number;
  max_ticket_size: number;
  risk_tolerance: RiskTolerance;
  governance_preference: GovernancePreference;
  geographic_focus: string[];
  sector_focus: string[];
  preferred_project_stage?: ProjectStage[];
  expected_return_profile?: string;
  preferred_capital_structure?: CapitalStructureType[];
  // Related data
  company?: Company;
}

// Technical Partner
export interface TechnicalPartner {
  id: string;
  company_id: string;
  service_categories: string[];
  sector_experience: string[];
  min_mw_capacity: number;
  max_mw_capacity: number;
  regions_operated: string[];
  annual_delivery_capacity_mw: number;
  total_mw_delivered: number;
  largest_project_mw: number;
  average_delivery_time_months: number;
  bonding_capacity: number;
  delivery_models: string[];
  payment_terms?: string;
  project_type_experience?: string[];
  min_ticket_size_zmw?: number;
  max_ticket_size_zmw?: number;
  years_of_experience?: number;
  company_experience_doc_url?: string;
  // Related data
  company?: Company;
}

// Capital Match Result
export interface CapitalMatchResult {
  id: string;
  project_id: string;
  capital_partner_id: string;
  compatibility_score: number;
  score_breakdown: Record<string, unknown>;
  created_at: string;
  // Related data
  capital_partner?: CapitalPartner;
  project?: Project;
}

// Technical Match Result
export interface TechnicalMatchResult {
  id: string;
  project_id: string;
  technical_partner_id: string;
  compatibility_score: number;
  score_breakdown: Record<string, unknown>;
  created_at: string;
  status?: 'active' | 'inactive';
  // Related data
  technical_partner?: TechnicalPartner;
}

export interface PowerTrader {
  id: string;
  company_id: string;
  license_type: string;
  max_offtake_capacity_mw: number;
  preferred_technology_types: string[];
  regions_of_interest: string[];
  min_ppa_duration_years: number;
  credit_rating_equivalent?: string;
  company?: Company;
}

// Engagement
export interface Engagement {
  id: string;
  project_id: string;
  counterparty_id: string;
  counterparty_type: CounterpartyType;
  status: EngagementStatus;
  created_at: string;
  updated_at: string;
  // Related data
  project?: Project;
  messages?: Message[];
}

// Message
export interface Message {
  id: string;
  engagement_id: string;
  sender_id: string;
  message_body: string;
  created_at: string;
  // Soft-delete tombstone (PRD §11.1 — own messages within 5 min)
  deleted_at?: string | null;
  deleted_by?: string | null;
  // Related data
  sender?: User;
}

// Engagement (data-room) document — PRD §E
export interface EngagementDocument {
  id: string;
  engagement_id: string;
  project_document_id?: string | null;
  document_type: 'NDA' | 'TERM_SHEET' | 'CONTRACT' | 'SUPPORTING';
  file_name: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  uploaded_by?: string | null;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  created_at: string;
  deleted_at?: string | null;
}

// Project Bookmark
export interface ProjectBookmark {
  id: string;
  user_id: string;
  project_id: string;
  created_at: string;
  project?: Project;
}

// Audit Log
export interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  // Related data
  user?: User;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


