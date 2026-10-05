'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn, formatAuditDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { AuditLog } from '@/types';

// ── Action label map ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  PROJECT_CREATED: 'Project Created',
  PROJECT_UPDATED: 'Project Updated',
  PROJECT_DELETED: 'Project Deleted',
  PROJECT_SUBMITTED: 'Project Submitted',
  PROJECT_APPROVED: 'Project Approved',
  PROJECT_REJECTED: 'Project Rejected',
  PROJECT_ACTIVATED: 'Project Activated',
  PROJECT_DEACTIVATED: 'Project Deactivated',
  PROJECT_ARCHIVED: 'Project Archived',
  MATCHING_ENGINE_RUN: 'Matching Run',
  ENGAGEMENT_CREATED: 'Engagement Created',
  ENGAGEMENT_UPDATED: 'Engagement Updated',
  ENGAGEMENT_REVIVED: 'Engagement Revived',
  DOCUMENT_UPLOADED: 'Document Uploaded',
  DOCUMENT_DELETED: 'Document Deleted',
  ORG_INVITE_ISSUED: 'Invite Sent',
  ORG_INVITE_RESENT: 'Invite Resent',
  ORG_INVITE_CANCELLED: 'Invite Cancelled',
  ORG_MEMBER_ROLE_CHANGED: 'Role Changed',
  ORG_MEMBER_REMOVED: 'Member Removed',
  ORG_MEMBER_DEACTIVATED: 'Member Deactivated',
  ORG_MEMBER_REACTIVATED: 'Member Reactivated',
  ORG_MEMBER_PROFILE_UPDATED: 'Profile Updated',
  ORG_SETTINGS_UPDATED: 'Org Settings Changed',
  ORG_DELETED: 'Org Deleted',
  USER_PROVISIONED: 'User Provisioned',
  PLATFORM_SETTINGS_UPDATED: 'Platform Settings Changed',
  PROJECT_FORCE_ACTIVATED: 'Force-Activated',
  ADMIN_MANUALLY_MATCHED: 'Manual Match',
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

// ── Entity type labels ───────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  projects: 'Project',
  companies: 'Organisation',
  user_profiles: 'User',
  engagements: 'Engagement',
  project_documents: 'Document',
  project_scores: 'Score',
  messages: 'Message',
  company_members: 'Member',
  setup_invites: 'Invite',
  capital_partners: 'Financier',
  technical_partners: 'EPC / Operator',
  power_traders: 'Power Trader',
};

// ── Distinct action types to populate the filter dropdown ─────────────────────

const ACTION_TYPES = Object.keys(ACTION_LABELS).sort();

const ENTITY_TYPES = Object.keys(ENTITY_LABELS).sort();

// ── Paginated server-table (separate from DataTable's built-in pagination) ────

function ServerPagination({ page, total, pageSize, onPageChange }: {
  page: number; total: number; pageSize: number; onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
      <span className="text-xs text-slate-400 font-medium">
        {start + 1}–{Math.min(start + pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost" size="sm"
          className="h-8 px-2.5 rounded-none text-xs font-semibold"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icons.arrowLeft className="size-3.5 mr-1" /> Prev
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="size-8 flex items-center justify-center text-xs text-slate-300">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'size-8 rounded-none text-xs font-bold transition-colors',
                p === page ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="ghost" size="sm"
          className="h-8 px-2.5 rounded-none text-xs font-semibold"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <Icons.arrowRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Debounce hook ────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { user } = useAuth();

  // RBAC
  const isPlatformAdmin = user?.is_platform_admin ?? false;
  const isOrgAdmin = user?.is_org_admin ?? false;
  const hasAccess = isPlatformAdmin || isOrgAdmin;

  // Data
  const [logs, setLogs] = useState<(AuditLog & { actor?: { full_name: string | null; email: string | null } | null })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const pageRef = useRef(1); // mirrors page sync so fetchLogs always reads the current value
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorName, setActorName] = useState('');
  const pageSize = 20;

  const debouncedActionFilter = useDebounced(actionFilter, 200);
  const debouncedEntityFilter = useDebounced(entityFilter, 200);
  const debouncedActorName = useDebounced(actorName, 300);

  // Keep a synchronous ref mirroring the debounced filters so fetchLogs
  // doesn't need them in the dependency array either.
  const filtersRef = useRef({ action_type: '', entity_type: '', actor_name: '' });

  // Reset page SYNCHRONOUSLY (via ref) when filters change — eliminates the
  // race between setPage(1) and a stale-closure fetch.
  const prevFiltersRef = useRef({ debouncedActionFilter, debouncedEntityFilter, debouncedActorName });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      debouncedActionFilter !== prev.debouncedActionFilter ||
      debouncedEntityFilter !== prev.debouncedEntityFilter ||
      debouncedActorName !== prev.debouncedActorName
    ) {
      pageRef.current = 1;
      setPage(1);
      filtersRef.current = {
        action_type: debouncedActionFilter,
        entity_type: debouncedEntityFilter,
        actor_name: debouncedActorName,
      };
      prevFiltersRef.current = { debouncedActionFilter, debouncedEntityFilter, debouncedActorName };
    }
  }, [debouncedActionFilter, debouncedEntityFilter, debouncedActorName]);

  // Keep pageRef in sync with page state (must be BEFORE the fetch trigger effect)
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // ── Fetch — reads page from ref to avoid stale closures ────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const currentPage = pageRef.current;
      const f = filtersRef.current;
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String((currentPage - 1) * pageSize));
      if (f.action_type) params.set('action_type', f.action_type);
      if (f.entity_type) params.set('entity_type', f.entity_type);
      if (f.actor_name) params.set('actor_name', f.actor_name);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to load audit logs');
        return;
      }
      const json = await res.json();
      setLogs(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [pageSize]); // only depends on pageSize — reads page + filters from refs

  // Re-fetch whenever filters or page change (detected via refs)
  useEffect(() => {
    if (hasAccess) fetchLogs();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, debouncedActionFilter, debouncedEntityFilter, debouncedActorName, page, fetchLogs]);

  // ── Toggle expand detail ──────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // ── Format after_state for human reading ───────────────────────────────────
  function formatStateValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
      // Format large numbers with commas
      return value.toLocaleString();
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.map(v => formatStateValue(v)).join(', ') || '—';
      // Small nested objects — flatten inline
      const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined);
      if (entries.length === 0) return '—';
      return entries.map(([k, v]) => `${labelify(k)}: ${formatStateValue(v)}`).join(' · ');
    }
    return String(value);
  }

  function labelify(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatStateChanges(state: Record<string, unknown>): { label: string; value: string }[] {
    if (!state || Object.keys(state).length === 0) return [];

    // Known enum fields we can pretty-print
    const knownEnums: Record<string, Record<string, string>> = {
      status: {
        draft: 'Draft',
        scoring: 'Scoring',
        pending_live: 'Pending Live',
        live: 'Live',
        deactivated: 'Deactivated',
        archived: 'Archived',
        rejected: 'Rejected',
        returned: 'Returned',
        submitted: 'Submitted',
        pending_internal_review: 'Pending Review',
        under_review: 'Under Review',
      },
      role: {
        MEMBER: 'Member',
        ADMIN: 'Admin',
        OWNER: 'Owner',
      },
      project_stage: {
        early: 'Early Stage',
        development: 'Development',
        construction: 'Construction',
        operational: 'Operational',
      },
      project_submission_mode: {
        standard: 'Standard',
        internal_review: 'Internal Review',
      },
    };

    // Fields to skip (internal / not useful for display)
    const skipFields = new Set(['id', 'updated_at', 'deleted_at', 'created_by', 'developer_id']);

    const entries: { label: string; value: string }[] = [];

    for (const [key, raw] of Object.entries(state)) {
      if (skipFields.has(key)) continue;
      if (raw === null || raw === undefined) continue;

      const label = labelify(key);

      // Pretty-print known enums
      if (knownEnums[key] && typeof raw === 'string' && knownEnums[key][raw]) {
        entries.push({ label, value: knownEnums[key][raw] });
        continue;
      }

      // Monetary fields — format with currency symbol
      if (key.includes('capital') || key.includes('budget') || key === 'capital_required') {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (!isNaN(num)) {
          entries.push({ label, value: `$${num.toLocaleString()}` });
          continue;
        }
      }

      // MW fields
      if (key.includes('mw') || key === 'project_size_mw') {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (!isNaN(num)) {
          entries.push({ label, value: `${num.toLocaleString()} MW` });
          continue;
        }
      }

      // Percentage fields
      if (key.includes('percentage') || key.includes('rate') || key.includes('score')) {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (!isNaN(num) && raw !== 0) {
          entries.push({ label, value: `${num}%` });
          continue;
        }
      }

      // URL / email / phone fields
      if (key.includes('url') || key === 'website' || key === 'linkedin') {
        entries.push({ label, value: String(raw) });
        continue;
      }

      // Boolean → Yes/No
      if (typeof raw === 'boolean') {
        entries.push({ label, value: raw ? 'Yes' : 'No' });
        continue;
      }

      // Object — inline summary
      if (typeof raw === 'object') {
        const formatted = formatStateValue(raw as Record<string, unknown>);
        if (formatted !== '—') {
          entries.push({ label, value: formatted });
        }
        continue;
      }

      entries.push({ label, value: String(raw) });
    }

    return entries;
  }

  // ── Not authorised ────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="py-20 text-center">
        <div className="size-14 bg-slate-50 rounded-none flex items-center justify-center mx-auto mb-5">
          <Icons.lock className="size-7 text-slate-300" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Audit logs are available to organisation admins and platform administrators.
        </p>
      </div>
    );
  }

  const filterSelectClass = "h-9 px-3 pr-8 rounded-none border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors appearance-none cursor-pointer";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Activity Log</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Logs</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {isPlatformAdmin
              ? 'Browse all platform activity across organisations.'
              : 'Review activity within your organisation.'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{loading ? '—' : total}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {total === 1 ? 'Entry' : 'Entries'}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="dash-card">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          {/* Search (actor name / email) */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={actorName}
              onChange={e => setActorName(e.target.value)}
              placeholder="Search by actor name or email…"
              className="w-full h-9 pl-10 pr-4 rounded-none border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            {actorName && (
              <button onClick={() => setActorName('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <Icons.close className="size-3.5" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Action type filter */}
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className={filterSelectClass}
          >
            <option value="">All Actions</option>
            {ACTION_TYPES.map(t => (
              <option key={t} value={t}>{ACTION_LABELS[t] ?? t}</option>
            ))}
          </select>

          {/* Entity type filter */}
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className={filterSelectClass}
          >
            <option value="">All Entities</option>
            {ENTITY_TYPES.map(t => (
              <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
            ))}
          </select>

          {/* Clear filters */}
          {(actionFilter || entityFilter || actorName) && (
            <>
              <div className="h-6 w-px bg-slate-200" />
              <button
                onClick={() => { setActionFilter(''); setEntityFilter(''); setActorName(''); }}
                className="h-7 px-2.5 rounded-none bg-slate-100 text-[11px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 text-ink-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] border-b border-line">
                  <th className="px-4 py-3 min-w-[160px]">Action</th>
                  <th className="px-4 py-3 min-w-[140px]">Actor</th>
                  <th className="px-4 py-3 min-w-[120px]">Entity</th>
                  <th className="px-4 py-3 min-w-[140px]">Date & Time</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="size-5 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="size-12 bg-slate-50 rounded-none flex items-center justify-center mx-auto mb-4">
              <Icons.zap className="size-6 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">No audit logs found</h3>
            <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
              {actionFilter || entityFilter
                ? 'Try adjusting your filters to see more results.'
                : 'Activity will appear here as your organisation uses the platform.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 text-ink-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] border-b border-line">
                  <th className="px-4 py-3 min-w-[160px]">Action</th>
                  <th className="px-4 py-3 min-w-[140px]">Actor</th>
                  <th className="px-4 py-3 min-w-[120px]">Entity</th>
                  <th className="px-4 py-3 min-w-[140px]">Date &amp; Time</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <Fragment key={log.id}>
                    {/* Main row */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-none bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                            <Icons.zap className="size-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{getActionLabel(log.action_type)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        {log.actor ? (
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{log.actor.full_name || 'Unknown'}</p>
                            {log.actor.email && <p className="text-[10px] text-slate-400 truncate">{log.actor.email}</p>}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            {ENTITY_LABELS[log.entity_type] || log.entity_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]" title={log.entity_id}>
                            {log.entity_id.slice(0, 8)}…
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <span className="text-sm text-slate-500 whitespace-nowrap">{formatAuditDate(log.timestamp)}</span>
                      </td>
                      <td className="px-4 py-3 w-10 text-right">
                        {log.after_state && Object.keys(log.after_state).length > 0 && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="p-1 rounded-none text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="View details"
                          >
                            <Icons.chevronDown className={cn('size-3.5 transition-transform', expandedId === log.id && 'rotate-180')} />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded child row */}
                    {expandedId === log.id && log.after_state && Object.keys(log.after_state).length > 0 && (
                      <tr className="bg-slate-50/80 border-t-0">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="animate-in slide-in-from-top-1 fade-in duration-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                              Changes made
                            </p>
                            {(() => {
                              const changes = formatStateChanges(log.after_state as Record<string, unknown>);
                              if (changes.length === 0) return <p className="text-xs text-slate-400">No changes recorded</p>;
                              return (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2.5">
                                  {changes.map(({ label, value }, idx) => (
                                    <div key={`${label}-${idx}`} className="min-w-0">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                                      <p className="text-sm font-semibold text-slate-800 truncate" title={value}>{value}</p>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side pagination */}
        {!loading && (
          <ServerPagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
