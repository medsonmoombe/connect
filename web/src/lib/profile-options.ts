/**
 * profile-options.ts — Canonical option sets for organisation / partner profiles.
 *
 * These lists are the single source of truth for every place a user picks a
 * sector, service, licence type, grant type, region, etc. Before this module
 * existed, onboarding, the standalone profile editors (trader/grant/consultant/
 * technical) and the admin console each re-declared their own copy with subtly
 * different values — so a choice made during onboarding would not appear in the
 * editor that later renders the same record. Keep all copies importing from here.
 */

export interface ProfileOption {
  value: string;
  label: string;
}

export const SECTORS: ProfileOption[] = [
  { value: 'SOLAR', label: 'Solar' },
  { value: 'WIND', label: 'Wind' },
  { value: 'HYDRO', label: 'Hydro' },
  { value: 'BIOMASS', label: 'Biomass' },
  { value: 'GEOTHERMAL', label: 'Geothermal' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'GRID_INFRA', label: 'Grid Infrastructure' },
];

export const SERVICE_CATEGORIES: ProfileOption[] = [
  { value: 'EPC', label: 'EPC (Engineering, Procurement, Construction)' },
  { value: 'O_M', label: 'O&M (Operations & Maintenance)' },
  { value: 'FEASIBILITY_STUDY', label: 'Feasibility Study' },
  { value: 'ENVIRONMENTAL_IMPACT', label: 'Environmental Impact Assessment' },
  { value: 'LEGAL_ADVISORY', label: 'Legal Advisory' },
  { value: 'FINANCIAL_ADVISORY', label: 'Financial Advisory' },
];

export const CAPITAL_STRUCTURES: ProfileOption[] = [
  { value: 'DEBT', label: 'Debt' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'PROFIT_SHARING', label: 'Profit Sharing' },
  { value: 'LEASING', label: 'Leasing' },
  { value: 'GRANT', label: 'Grant' },
];

export const PROJECT_STAGES: ProfileOption[] = [
  { value: 'CONCEPT', label: 'Concept' },
  { value: 'PRE_FEASIBILITY', label: 'Pre-Feasibility' },
  { value: 'FULL_FEASIBILITY', label: 'Full Feasibility' },
  { value: 'REGULATORY_APPROVAL', label: 'Regulatory Approval' },
  { value: 'PPA_READY', label: 'PPA Ready' },
  { value: 'FINANCIAL_CLOSE', label: 'Financial Close' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'OPERATION', label: 'Operation' },
];

export const RISK_LEVELS: ProfileOption[] = [
  { value: 'LOW', label: 'Low Risk (Proven tech, signed PPA)' },
  { value: 'MEDIUM', label: 'Medium Risk (Proven tech, merchant risk)' },
  { value: 'HIGH', label: 'High Risk (Emerging tech or frontier market)' },
];

export const GOVERNANCE_PREFERENCES: ProfileOption[] = [
  { value: 'PASSIVE', label: 'Passive (No intervention)' },
  { value: 'BOARD_SEAT', label: 'Board Seat' },
  { value: 'ACTIVE_ROLE', label: 'Active Role' },
];

export const DELIVERY_MODELS: ProfileOption[] = [
  { value: 'FIXED_PRICE', label: 'Fixed Price' },
  { value: 'TIME_MATERIALS', label: 'Time & Materials' },
  { value: 'COST_PLUS', label: 'Cost Plus' },
  { value: 'BOOT', label: 'BOOT (Build-Own-Operate-Transfer)' },
  { value: 'BOO', label: 'BOO (Build-Own-Operate)' },
];

export const OWNERSHIP_STRUCTURES: ProfileOption[] = [
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'PRIVATE_LIMITED', label: 'Private Limited Company' },
  { value: 'PUBLIC_LIMITED', label: 'Public Limited Company' },
  { value: 'NON_PROFIT', label: 'Non-Profit / NGO' },
  { value: 'GOVERNMENT', label: 'Government Entity' },
  { value: 'JV', label: 'Joint Venture' },
  { value: 'OTHER', label: 'Other' },
];

export const ZAMBIAN_PROVINCES: string[] = [
  'Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka',
  'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western',
];

export const LICENSE_TYPES: ProfileOption[] = [
  { value: 'GENERATION', label: 'Generation License' },
  { value: 'TRADING', label: 'Trading License' },
  { value: 'DISTRIBUTION', label: 'Distribution License' },
  { value: 'TRANSMISSION', label: 'Transmission License' },
  { value: 'SUPPLIER', label: 'Supplier License' },
  // Legacy values written by an earlier trader profile editor. Kept so existing
  // rows still render in the dropdown instead of silently falling back.
  { value: 'BROKERAGE', label: 'Brokerage License (legacy)' },
  { value: 'MARKET_MAKER', label: 'Market Maker License (legacy)' },
];

export const GRANT_TYPES: ProfileOption[] = [
  { value: 'TECHNICAL_ASSISTANCE', label: 'Technical Assistance' },
  { value: 'FEASIBILITY_STUDY', label: 'Feasibility Study Support' },
  { value: 'PROJECT_PREPARATION', label: 'Project Preparation Facility' },
  { value: 'CAPACITY_BUILDING', label: 'Capacity Building' },
  { value: 'INNOVATION', label: 'Innovation / Piloting' },
  { value: 'BLENDED_FINANCE', label: 'Blended Finance' },
];

export const CERTIFICATIONS: ProfileOption[] = [
  { value: 'PMP', label: 'PMP (Project Management Professional)' },
  { value: 'PRINCE2', label: 'PRINCE2' },
  { value: 'CFA', label: 'CFA Charterholder' },
  { value: 'ACCA', label: 'ACCA' },
  { value: 'ENVIRONMENTAL', label: 'Environmental Assessment Certification' },
  { value: 'LEGAL', label: 'Legal Practitioner Licence' },
  { value: 'ENGINEERING', label: 'Professional Engineering Licence' },
];
