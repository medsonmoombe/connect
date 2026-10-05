'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getRoleLabel } from '@/lib/role-labels';
import PageTitle from '@/components/PageTitle';
import {
  Hero, HeroGhostButton, SearchInput, Select, EmptyState,
  TH_CLASS, TD_CLASS, StatusPill, Badge, RowMenu, type Tone,
} from '@/components/ui/kit';

type Org = {
  id: string;
  name: string;
  primary_role: string;
  status: string;
  country?: string | null;
  website?: string | null;
  description?: string | null;
  is_platform_org?: boolean | null;
  is_authority_org?: boolean | null;
  company_members?: { role: string; user_id: string }[] | null;
  created_at?: string | null;
};

const ROLE_OPTIONS = ['ALL', 'DEVELOPER', 'CAPITAL_PARTNER', 'TECHNICAL_PARTNER', 'CONSULTANT', 'POWER_TRADER', 'GRANT_PROVIDER'];
const STATUS_OPTIONS = ['ALL', 'pending_verification', 'verified', 'needs_update', 'rejected', 'deactivated'];

/** Org role → badge tone. */
const ROLE_TONE: Record<string, Tone> = {
  DEVELOPER: 'blue',
  CAPITAL_PARTNER: 'green',
  TECHNICAL_PARTNER: 'violet',
  CONSULTANT: 'amber',
  POWER_TRADER: 'copper',
  GRANT_PROVIDER: 'red',
};

export default function AuthorityOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  // Debounce search — avoid an API call per keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role, status });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/authority/organizations?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load profiles');
      setOrgs(json.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Could not load profiles');
    } finally {
      setLoading(false);
    }
  }, [role, status, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    total: orgs.length,
    verified: orgs.filter(o => o.status === 'verified').length,
    pending: orgs.filter(o => o.status === 'pending_verification').length,
    rejected: orgs.filter(o => o.status === 'rejected').length,
  }), [orgs]);

  const refresh = () => load();

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <PageTitle title="Organisations" />

      <Hero
        eyebrow="Governance · Directory"
        icon={Icons.building}
        title="Organisations"
        description="Browse developers, financiers, EPCs, consultants, and grant providers."
        actions={
          <HeroGhostButton onClick={refresh} className="px-3">
            <Icons.refreshCw className={cn('size-4', loading && 'animate-spin')} /> Refresh
          </HeroGhostButton>
        }
        stats={[
          { value: counts.total, label: 'Total organisations' },
          { value: counts.verified, label: 'Verified' },
          { value: counts.pending, label: 'Pending verification' },
          { value: counts.rejected, label: 'Rejected' },
        ].map(s => ({
          ...s,
          value: loading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/20" /> : s.value,
        }))}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search organisations…" className="lg:w-72" />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Select
            value={role}
            onChange={setRole}
            ariaLabel="Filter by role"
            options={ROLE_OPTIONS.map(r => ({ value: r, label: r === 'ALL' ? 'All Roles' : getRoleLabel(r) }))}
            className="w-44"
          />
          <Select
            value={status}
            onChange={setStatus}
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS.map(s => ({ value: s, label: s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ') }))}
            className="w-44"
          />
        </div>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-[22px] py-[17px]">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-ink">Directory <span className="rounded-full border border-line bg-surface-2 px-[9px] py-px align-[2px] text-[11px] font-bold text-ink-2">{orgs.length}</span></div>
            <div className="text-[12.5px] text-ink-3">Verified and pending market participants</div>
          </div>
          <span className="text-[11px] font-semibold text-ink-3">{loading ? '…' : `${orgs.length} total`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className={TH_CLASS}>Organisation</th>
                <th className={TH_CLASS}>Type</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Members</th>
                <th className={TH_CLASS}>Country</th>
                <th className={cn(TH_CLASS, 'w-16')} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-12 text-center">
                    <Icons.spinner className="mx-auto size-5 animate-spin text-ink-3/50" />
                    <p className="mt-2 text-[13px] font-semibold text-ink-3">Loading organisations…</p>
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="building" title="No organisations found" sub="Try a different filter or search term." />
                  </td>
                </tr>
              ) : (
                orgs.map(org => {
                  const memberCount = org.company_members?.length ?? 0;
                  return (
                    <tr key={org.id} className="transition-colors hover:bg-surface-2">
                      <td className={TD_CLASS}>
                        <Link href={`/authority/organizations/${org.id}`} className="group flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-none bg-brand-soft text-[11px] font-extrabold text-brand-text">
                            {org.name.substring(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-semibold text-ink transition-colors group-hover:text-brand-text">{org.name}</span>
                            <span className="mt-px block text-xs text-ink-3">{org.website || '—'}</span>
                          </span>
                        </Link>
                      </td>
                      <td className={TD_CLASS}>
                        <Badge tone={ROLE_TONE[org.primary_role] ?? 'slate'}>{getRoleLabel(org.primary_role)}</Badge>
                      </td>
                      <td className={TD_CLASS}>
                        <StatusPill status={org.status} />
                      </td>
                      <td className={TD_CLASS}>
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                          <Icons.users className="size-3.5 text-ink-3" />
                          {memberCount}
                        </span>
                      </td>
                      <td className={TD_CLASS}>
                        <span className="text-[13px] text-ink-2">{org.country || '—'}</span>
                      </td>
                      <td className={TD_CLASS}>
                        <OrgRowMenu org={org} onRefresh={refresh} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── Three-dot menu (kit RowMenu) ────────────────────────────────────────

function OrgRowMenu({ org, onRefresh }: { org: Org; onRefresh: () => void }) {
  const handleDeactivate = async () => {
    try {
      const res = await fetch(`/api/admin/authority-orgs/${org.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deactivate' }) });
      if (res.ok) { toast.success('Organisation deactivated'); onRefresh(); } else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    } catch { toast.error('Failed'); }
  };

  const handleActivate = async () => {
    try {
      const res = await fetch(`/api/admin/authority-orgs/${org.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'activate' }) });
      if (res.ok) { toast.success('Organisation activated'); onRefresh(); } else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    } catch { toast.error('Failed'); }
  };

  return (
    <RowMenu
      trigger={({ open, toggle }) => (
        <button
          onClick={toggle}
          aria-label={`Actions for ${org.name}`}
          className={cn(
            'grid size-8 place-items-center rounded-none transition-colors',
            open ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
          )}
        >
          <Icons.moreVertical className="size-4" />
        </button>
      )}
      items={[
        {
          label: 'View details',
          icon: Icons.eye,
          onClick: () => { window.location.href = `/authority/organizations/${org.id}`; },
        },
        org.status === 'deactivated'
          ? { label: 'Activate', icon: Icons.check, onClick: handleActivate }
          : { label: 'Deactivate', icon: Icons.pause, danger: true, onClick: handleDeactivate },
      ]}
    />
  );
}
