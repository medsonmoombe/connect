// User Roles
export type UserRole = 'DEVELOPER' | 'CAPITAL_PARTNER' | 'TECHNICAL_PARTNER' | 'GRANT_PROVIDER' | 'ADMIN';

// Company Types
export type CompanyType = 'DEVELOPER' | 'CAPITAL' | 'TECHNICAL' | 'GRANT';

// Project Stages
export type ProjectStage = 'FEASIBILITY' | 'PRE_CONSTRUCTION' | 'READY_TO_BUILD' | 'UNDER_CONSTRUCTION' | 'OPERATIONAL';

// Capital Structure Types (No debt instruments allowed)
export type CapitalStructureType = 'EQUITY' | 'PROFIT_SHARING' | 'LEASING' | 'GRANT';

// Risk Tolerance
export type RiskTolerance = 'LOW' | 'MEDIUM' | 'HIGH';

// Governance Preference
export type GovernancePreference = 'PASSIVE' | 'BOARD_SEAT' | 'ACTIVE_ROLE';

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
}

// Project Type
export interface Project {
  id: string;
  developer_id: string;
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
  target_financial_close_date?: string;
  target_cod?: string;
  created_at: string;
  updated_at?: string;
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
  risk_flags: string[];
  recommendations: string[];
  summary?: string;
  created_at: string;
}

// Capital Partner
export interface CapitalPartner {
  id: string;
  company_id: string;
  preferred_structures: CapitalStructureType[];
  min_ticket_size: number;
  max_ticket_size: number;
  risk_tolerance: RiskTolerance;
  governance_preference: GovernancePreference;
  geographic_focus: string[];
  sector_focus: string[];
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
  // Related data
  technical_partner?: TechnicalPartner;
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
  // Related data
  sender?: User;
}

// Audit Log
export interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
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
