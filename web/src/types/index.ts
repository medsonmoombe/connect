// User Roles (derived from org.primary_role or org membership role)
export type UserRole = 'DEVELOPER' | 'CAPITAL_PARTNER' | 'TECHNICAL_PARTNER' | 'ADMIN' | 'POWER_TRADER' | 'GRANT_PROVIDER' | 'CONSULTANT' | 'AUTHORITY_ADMIN' | 'AUTHORITY_REVIEWER' | 'AUTHORITY_VIEWER';

// Project Status â€” re-exported from the single source of truth
// (web/src/lib/project-state-machine.ts). Never redefine statuses here; edit
// the state machine and add the literal to the DB CHECK (migration) instead.
export type { ProjectStatus, TransitionActor } from '@/lib/project-state-machine';


// Organization membership roles (organization_members.role)
export type OrgMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

// Platform Admin vs Org Admin distinction:
// - Platform Admin: membership.role === 'ADMIN' (internal staff, full system access)
// - Org Admin: membership.role !== 'ADMIN' but user.role is derived from org.primary_role
//   (manages their own org's users/projects/settings)

// Company Types
export type CompanyType = 'DEVELOPER' | 'CAPITAL' | 'TECHNICAL' | 'POWER_TRADER' | 'CONSULTANT' | 'GRANT_PROVIDER' | 'AUTHORITY';

// Project Stages â€” 8-stage development taxonomy (AI-determined after form completion)
export type ProjectStage =
  | 'CONCEPT'
  | 'PRE_FEASIBILITY'
  | 'FULL_FEASIBILITY'
  | 'REGULATORY_APPROVAL'
  | 'PPA_READY'
  | 'FINANCIAL_CLOSE'
  | 'CONSTRUCTION'
  | 'OPERATION';

// Capital Structure Types (Debt, Equity, Lease, Sharing, Grant)
export type CapitalStructureType = 'DEBT' | 'EQUITY' | 'PROFIT_SHARING' | 'LEASING' | 'GRANT';

// Risk Tolerance
export type RiskTolerance = 'LOW' | 'MEDIUM' | 'HIGH';

// Governance Preference
export type GovernancePreference = 'PASSIVE' | 'BOARD_SEAT' | 'ACTIVE_ROLE';

// Engagement Status
export type EngagementStatus = 'INTRO_SENT' | 'INTRO_ACCEPTED' | 'NDA_SIGNED' | 'DUE_DILIGENCE' | 'TERM_SHEET' | 'CLOSED' | 'DROPPED' | 'CONTRACT_SIGNED' | 'CAPITAL_COMMITTED';

// Counterparty Type
export type CounterpartyType = 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'GRANT_PROVIDER' | 'POWER_TRADER';

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
  is_authority_org?: boolean;
  registration_number?: string;
  ownership_structure?: string;
  ownership_details?: string;
  contact_email?: string;
  contact_phone?: string;
  management_experience_summary?: string;
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
  status?: 'draft' | 'scoring' | 'scoring_retry' | 'under_review' | 'pending_live' | 'live' | 'deactivated' | 'archived';
  is_visible_to_investors?: boolean;
  scores_visible_at?: string | null;
  rejection_reason?: string | null;
  target_financial_close_date?: string;
  target_cod?: string;
  created_at: string;
  updated_at?: string;
  // Financial breakdown
  capex?: number;
  opex?: number;
  funding_required?: number;
  description?: string;
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
  mime_type?: string;
  classification?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  version?: number;
  replaced_by?: string | null;
  replaced_at?: string | null;
  uploaded_at: string;
}

// Project Technical Requirements
export interface ProjectTechRequirements {
  project_id: string;
  required_services: string[];
  terrain_complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  grid_status: 'CONNECTED' | 'PENDING' | 'OFF_GRID';
  budget_preference: 'FIXED' | 'MILESTONE' | 'NEGOTIABLE';
  ppa_status?: 'SECURED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'NOT_APPLICABLE';
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
  /** AI-determined project development stage (8-stage taxonomy). */
  determined_stage?: string;
  /** AI reasoning for the determined stage. */
  stage_rationale?: string;
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

// â”€â”€ Extra Data (JSONB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type ExtraData = Record<string, unknown>;

// â”€â”€ Partner Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type PartnerRequestType = 'quote' | 'meeting' | 'introduction';
export type PartnerRequestStatus = 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export interface PartnerRequest {
  id: string;
  project_id: string;
  partner_company_id: string;
  request_type: PartnerRequestType;
  gaps_to_fill: string[];
  requested_service?: string;
  message?: string;
  status: PartnerRequestStatus;
  project_summary: ExtraData;
  engagement_id?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  // Related
  partner?: Company;
  project?: Project;
}

// â”€â”€ Consultant Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface ConsultantProfile {
  id: string;
  company_id: string;
  service_categories: string[];
  sector_experience: string[];
  specializations: string[];
  years_of_experience: number;
  total_projects_completed: number;
  largest_project_mw: number;
  regions_operated: string[];
  certifications: string[];
  key_team_members: ExtraData[];
  references_data: ExtraData[];
  availability: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
  hourly_rate_range: string;
  project_rate_range: string;
  company_experience_doc_url?: string;
  portfolio_doc_url?: string;
  created_at: string;
  updated_at: string;
  company?: Company;
}

// â”€â”€ Grant Provider Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface GrantProvider {
  id: string;
  company_id: string;
  grant_types: string[];
  min_grant_size: number;
  max_grant_size: number;
  focus_sectors: string[];
  geographic_focus: string[];
  eligibility_criteria?: string;
  application_process?: string;
  typical_timeline_months?: number;
  created_at: string;
  updated_at: string;
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

// Consultant Match Result
export interface ConsultantMatchResult {
  id: string;
  project_id: string;
  consultant_id: string;
  compatibility_score: number;
  score_breakdown: Record<string, unknown>;
  created_at: string;
  status?: 'active' | 'inactive';
  // Related data
  consultant?: ConsultantProfile;
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

// Power Trader Match Result
export interface PowerTraderMatchResult {
  id: string;
  project_id: string;
  power_trader_id: string;
  compatibility_score: number;
  score_breakdown: Record<string, unknown>;
  created_at: string;
  status?: 'active' | 'inactive';
  power_trader?: PowerTrader;
}
// Engagement
export interface Engagement {
  id: string;
  project_id: string;
  counterparty_id: string;
  counterparty_type: CounterpartyType;
  status: EngagementStatus;
  /** Who initiated the introduction request. NULL = legacy row (treated as partner-initiated). */
  intro_origin?: 'developer' | 'partner' | null;
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
  // Soft-delete tombstone (PRD Â§11.1 â€” own messages within 5 min)
  deleted_at?: string | null;
  deleted_by?: string | null;
  // Related data
  sender?: User;
}

// Engagement (data-room) document â€” PRD Â§E
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

// â”€â”€ Gap Analysis Types (Phase B â€” Developer Gap Matrix) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type GapSeverity = 'critical' | 'high' | 'medium' | 'low';
export type GapStatus = 'complete' | 'partial' | 'missing';

export interface PartnerRecommendation {
  partnerType: string;
  service: string;
  description: string;
  counterpartyType: 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'GRANT_PROVIDER' | 'POWER_TRADER';
}

export interface GapItem {
  id: string;
  category: string;
  label: string;
  detail: string;
  status: GapStatus;
  severity: GapSeverity;
  recommendation: PartnerRecommendation;
  actionLabel?: string;
}

export interface GapAnalysisResult {
  projectId: string;
  overallReadiness: number;
  categoryBreakdown: Record<string, { complete: number; total: number }>;
  gaps: GapItem[];
  summary: string;
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

// Interest Signals (Feature: Business Value #2)
export type InterestSignalType =
  | 'express_interest' | 'bookmark' | 'view' | 'dataroom_open'
  | 'document_download' | 'message_sent' | 'engagement_created';

export interface InterestSignal {
  id: string;
  project_id: string;
  user_id: string;
  signal_type: InterestSignalType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InvestorInterestIndex {
  projectId: string;
  score: number;             // 0â€“100 composite index
  breakdown: {
    express_interest: number; // count of unique investors who expressed interest
    bookmarks: number;
    views: number;
    dataroom_opens: number;
    document_downloads: number;
    messages: number;
    engagements: number;
  };
  trend: { date: string; score: number }[]; // 7-day trend
  updatedAt: string;
}

// Matching Digests
export type DigestFrequency = 'daily' | 'weekly' | 'monthly' | 'off';

export interface MatchingDigest {
  id: string;
  user_id: string;
  frequency: DigestFrequency;
  last_sent_at: string | null;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

// Platform Analytics (Admin)
export interface PlatformAnalytics {
  overview: {
    totalUsers: number;
    totalProjects: number;
    totalCompanies: number;
    totalCapital: number;
    totalEngagements: number;
  };
  trends: {
    date: string;
    users: number;
    projects: number;
    engagements: number;
    matches: number;
  }[];
  matchDistribution: {
    range: string;
    count: number;
  }[];
  engagementFunnel: {
    stage: string;
    count: number;
    conversionRate: number;
  }[];
  sectorBreakdown: {
    sector: string;
    count: number;
    capital: number;
  }[];
  avgTimeToClose: number; // days
}



