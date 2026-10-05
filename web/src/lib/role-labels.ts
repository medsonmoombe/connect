/**
 * role-labels.ts â€” SINGLE SOURCE OF TRUTH for all user-facing role labels.
 *
 * Every UI component, admin panel, email template, and onboarding screen
 * MUST import from here. NEVER hardcode "Capital Partner" or "Financier"
 * anywhere else â€” if the naming changes again, edit only this file.
 *
 * KISS + DRY: one map, one lookup function, zero repetition.
 */

// â”€â”€ Public-facing labels (User Guide terminology) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const ROLE_LABELS: Record<string, string> = {
  DEVELOPER:         'Developer',
  CAPITAL_PARTNER:   'Financier',
  TECHNICAL_PARTNER: 'EPC / Operator',
  CONSULTANT:        'Consultant',
  POWER_TRADER:      'Power Trader',
  GRANT_PROVIDER:    'Grant Provider',
  ADMIN:             'Admin',
  AUTHORITY_ADMIN:   'Regulator Admin',
  AUTHORITY_REVIEWER:'Regulator Reviewer',
  AUTHORITY_VIEWER:  'Regulator Viewer',
} as const;

/** Plural variants for dashboard headers, stats, etc. */
export const ROLE_LABELS_PLURAL: Record<string, string> = {
  DEVELOPER:         'Developers',
  CAPITAL_PARTNER:   'Financiers',
  TECHNICAL_PARTNER: 'EPC / Operators',
  CONSULTANT:        'Consultants',
  POWER_TRADER:      'Power Traders',
  GRANT_PROVIDER:    'Grant Providers',
  ADMIN:             'Admins',
  AUTHORITY_ADMIN:   'Regulator Admins',
  AUTHORITY_REVIEWER:'Regulator Reviewers',
  AUTHORITY_VIEWER:  'Regulator Viewers',
} as const;

/** Portal sidebar labels per role. */
export const PORTAL_LABELS: Record<string, string> = {
  DEVELOPER:         'Developer Portal',
  CAPITAL_PARTNER:   'Financier Portal',
  TECHNICAL_PARTNER: 'EPC & Advisory Portal',
  CONSULTANT:        'Consulting Portal',
  POWER_TRADER:      'Trading Portal',
  GRANT_PROVIDER:    'Grant Portal',
  ADMIN:             'Admin Command',
  AUTHORITY_ADMIN:   'Regulator Management',
  AUTHORITY_REVIEWER:'Regulator Management',
  AUTHORITY_VIEWER:  'Regulator Management',
} as const;

/** Dashboard welcome header descriptions per role. */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  DEVELOPER:         'Here is your project pipeline and readiness overview.',
  CAPITAL_PARTNER:   'Discover and fund tomorrow\'s energy infrastructure.',
  TECHNICAL_PARTNER: 'Find projects that match your expertise and capacity.',
  CONSULTANT:        'Find projects where your advisory expertise adds the most value.',
  POWER_TRADER:      'Secure offtake agreements for your portfolio.',
  GRANT_PROVIDER:    'Deploy grant capital to high-impact energy projects.',
  ADMIN:             'Platform oversight and system management.',
  AUTHORITY_ADMIN:   'Review projects, manage profiles, and oversee governance workflows.',
  AUTHORITY_REVIEWER:'Review project submissions and verify evidence.',
  AUTHORITY_VIEWER:  'View project governance data and platform profiles.',
} as const;

/**
 * Map an internal role key to a portal label.
 * Falls back to a formatted version of the key if unknown.
 */
export function getPortalLabel(role?: string): string {
  if (!role) return 'Portal';
  return PORTAL_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Portal';
}

/**
 * Map an internal role key to a user-facing display label.
 */
export function getRoleLabel(role?: string): string {
  if (!role) return 'User';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Plural form of a role label.
 */
export function getRoleLabelPlural(role?: string): string {
  if (!role) return 'Users';
  return ROLE_LABELS_PLURAL[role] ?? getRoleLabel(role) + 's';
}

/**
 * Counterparty type label (CAPITAL â†’ "Financier", TECHNICAL â†’ "EPC / Operator").
 */
export function getCounterpartyLabel(type?: 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'GRANT_PROVIDER' | 'POWER_TRADER' | string): string {
  if (type === 'CAPITAL') return 'Financier';
  if (type === 'TECHNICAL') return 'EPC / Operator';
  if (type === 'CONSULTANT') return 'Consultant';
  if (type === 'GRANT_PROVIDER') return 'Grant Provider';
  if (type === 'POWER_TRADER') return 'Power Trader';
  return type ?? 'Partner';
}

/** "A Financier…" / "An EPC / Operator…" — correct indefinite article for a label. */
export function withIndefiniteArticle(label: string): string {
  return /^[aeiou]/i.test(label.trim()) ? `An ${label}` : `A ${label}`;
}
