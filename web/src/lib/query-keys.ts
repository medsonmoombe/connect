/**
 * Centralised query key factory.
 * Every useQuery / useMutation in the app references keys from here.
 * This makes invalidation surgical and refactoring safe.
 *
 * Convention:
 *   queryKeys.domain.all()          → ['domain']
 *   queryKeys.domain.lists()        → ['domain', 'list']
 *   queryKeys.domain.list(filters)  → ['domain', 'list', filters]
 *   queryKeys.domain.detail(id)     → ['domain', 'detail', id]
 */

export const queryKeys = {
  // ── Companies ──────────────────────────────────────────────
  companies: {
    all:    ()              => ['companies']                    as const,
    lists:  ()              => ['companies', 'list']            as const,
    list:   (f?: object)    => ['companies', 'list', f ?? {}]   as const,
    detail: (id: string)    => ['companies', 'detail', id]      as const,
  },

  // ── Projects ───────────────────────────────────────────────
  projects: {
    all:      ()            => ['projects']                     as const,
    lists:    ()            => ['projects', 'list']             as const,
    list:     (f?: object)  => ['projects', 'list', f ?? {}]    as const,
    detail:   (id: string)  => ['projects', 'detail', id]       as const,
    analytics:(id: string)  => ['projects', 'analytics', id]    as const,
    matches:  (id: string)  => ['projects', 'matches', id]      as const,
  },

  // ── Partners ───────────────────────────────────────────────
  partners: {
    capital:   ()           => ['partners', 'capital']          as const,
    technical: ()           => ['partners', 'technical']        as const,
    detail:    (id: string) => ['partners', 'detail', id]       as const,
  },

  // ── Engagements ────────────────────────────────────────────
  engagements: {
    all:    ()              => ['engagements']                   as const,
    lists:  ()              => ['engagements', 'list']           as const,
    list:   (f?: object)    => ['engagements', 'list', f ?? {}]  as const,
    detail: (id: string)    => ['engagements', 'detail', id]     as const,
  },

  // ── Messages ───────────────────────────────────────────────
  messages: {
    byEngagement: (id: string) => ['messages', id]              as const,
  },

  // ── Admin ──────────────────────────────────────────────────
  admin: {
    auditLogs:   ()         => ['admin', 'audit-logs']          as const,
    users:       ()         => ['admin', 'users']               as const,
    pendingVerifications: () => ['admin', 'users', 'pending']   as const,
    health:      ()         => ['admin', 'health']              as const,
  },

  // ── AI Analysis ────────────────────────────────────────────
  aiAnalysis: {
    history: ()             => ['ai-analysis', 'history']       as const,
    detail:  (id: string)   => ['ai-analysis', 'detail', id]    as const,
  },

  // ── Interest Index ────────────────────────────────────────
  interest: {
    project: (id: string)   => ['projects', 'detail', id, 'interest'] as const,
  },

  // ── Digests ───────────────────────────────────────────────
  digests: {
    all:         ()         => ['digests']                       as const,
    preferences: ()         => ['digests', 'preferences']       as const,
  },

  // ── Platform Analytics ────────────────────────────────────
  analytics: {
    platform:    ()         => ['analytics', 'platform']         as const,
  },
} as const;
