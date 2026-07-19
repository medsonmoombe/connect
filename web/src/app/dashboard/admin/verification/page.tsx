'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactDOM from 'react-dom';
import { DataTable, Column } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { Badge, BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { StatCard } from '@/components/ui/stat-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type OrgStatus = 'pending_verification' | 'verified' | 'rejected' | 'needs_update';

interface PendingOrg {
  id: string;
  name: string;
  primary_role: string;
  country: string;
  status: OrgStatus;
  created_at: string;
  admin_note?: string;
  description?: string;
  website?: string;
  team_size?: number;
  years_operating?: number;
  logo_url?: string;
  is_new_company_with_experienced_team?: boolean;
  management_team_experience?: Record<string, any>;
  preferences?: Record<string, any> | null;
  company_members: {
    role: string;
    user_id: string;
    user_profiles: { id: string; full_name: string; email: string; avatar_url?: string; created_at?: string } | null;
  }[];
}

const STATUS_BADGE: Record<OrgStatus, { variant: BadgeVariant; label: string }> = {
  pending_verification: { variant: 'yellow', label: 'Pending' },
  verified:             { variant: 'green',  label: 'Verified' },
  rejected:             { variant: 'red',    label: 'Rejected' },
  needs_update:         { variant: 'orange', label: 'Needs Update' },
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER:        'Developer',
  CAPITAL_PARTNER:  'Capital Partner',
  TECHNICAL_PARTNER:'Technical Partner',
  GRANT_PROVIDER:   'Grant Provider',
  POWER_TRADER:     'Power Trader',
};

const STATUS_TABS: { value: OrgStatus; label: string }[] = [
  { value: 'pending_verification', label: 'Pending' },
  { value: 'needs_update',         label: 'Needs Update' },
  { value: 'verified',             label: 'Verified' },
  { value: 'rejected',             label: 'Rejected' },
];

// ── Three-dot menu (portal-based) ──────────────────────────────────────────

function RowMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[]
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; origin: string }>({ top: 0, right: 0, origin: 'top' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const MENU_HEIGHT = items.length * 36 + 8;

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < MENU_HEIGHT;
      setPos({
        top: openUp ? rect.top - MENU_HEIGHT : rect.bottom + 4,
        right: window.innerWidth - rect.right,
        origin: openUp ? 'bottom' : 'top',
      });
    }
    setOpen(v => !v);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Icons.moreVertical className="size-4" />
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, transformOrigin: pos.origin }}
          className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in duration-150"
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                item.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function VerificationQueuePage() {
  const [orgs, setOrgs] = useState<PendingOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrgStatus>('pending_verification');
  const [selected, setSelected] = useState<PendingOrg | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [stats, setStats] = useState<Record<OrgStatus, number>>({
    pending_verification: 0,
    needs_update: 0,
    verified: 0,
    rejected: 0,
  });

  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [loadingRequestInfo, setLoadingRequestInfo] = useState(false);

  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmRequestInfo, setConfirmRequestInfo] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations?status=${statusFilter}`);
      const { data } = await res.json();
      setOrgs(data ?? []);
      
      // Fetch stats for all statuses
      const statuses: OrgStatus[] = ['pending_verification', 'needs_update', 'verified', 'rejected'];
      const statsPromises = statuses.map(s => 
        fetch(`/api/admin/organizations?status=${s}`).then(r => r.json())
      );
      const results = await Promise.all(statsPromises);
      const newStats: Record<OrgStatus, number> = {
        pending_verification: results[0].data?.length ?? 0,
        needs_update: results[1].data?.length ?? 0,
        verified: results[2].data?.length ?? 0,
        rejected: results[3].data?.length ?? 0,
      };
      setStats(newStats);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const openViewDrawer = (org: PendingOrg) => {
    setSelected(org);
    setNote('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setNote('');
    setConfirmReject(false);
    setConfirmRequestInfo(false);
    setConfirmApprove(false);
  };

  const handleAction = async (status: 'verified' | 'rejected' | 'needs_update') => {
    if (!selected) return;

    const setLoading =
      status === 'verified' ? setLoadingApprove :
      status === 'rejected' ? setLoadingReject :
      setLoadingRequestInfo;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status, note: note || undefined }),
      });

      if (res.ok) {
        const statusLabel = STATUS_BADGE[status]?.label ?? status;
        toast.success(`Organisation ${statusLabel.toLowerCase()}`, {
          description: `"${selected.name}" has been ${statusLabel.toLowerCase()}.`,
        });
        closeDrawer();
        fetchOrgs();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update status');
      }
    } catch {
      toast.error('An error occurred while updating status');
    } finally {
      setLoading(false);
    }
  };

  const owner = selected?.company_members?.find(m => m.role === 'OWNER')?.user_profiles;
  const members = selected?.company_members ?? [];
  const canAct = statusFilter === 'pending_verification' || statusFilter === 'needs_update';

  const columns: Column<PendingOrg>[] = [
    {
      key: 'name',
      header: 'Organisation',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.logo_url ? (
            <img src={row.logo_url} alt="" className="size-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
              {row.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-bold text-slate-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Type',
      render: (row) => (
        <span className="text-sm text-slate-600">{ROLE_LABELS[row.primary_role] ?? row.primary_role}</span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => {
        const o = row.company_members?.find(m => m.role === 'OWNER')?.user_profiles;
        return <span className="text-sm text-slate-600">{o?.full_name ?? '—'}</span>;
      },
    },
    {
      key: 'country',
      header: 'Country',
      render: (row) => <span className="text-sm text-slate-600">{row.country ?? '—'}</span>,
    },
    {
      key: 'applied',
      header: 'Applied',
      render: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const s = STATUS_BADGE[row.status] ?? { variant: 'slate' as BadgeVariant, label: row.status };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      render: (row) => {
        const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [
          {
            label: 'View details',
            icon: <Icons.eye className="size-3.5" />,
            onClick: () => openViewDrawer(row),
          },
        ];

        if (canAct) {
          menuItems.push(
            {
              label: 'Approve',
              icon: <Icons.checkCircle2 className="size-3.5" />,
              onClick: () => { setSelected(row); setNote(''); setConfirmApprove(true); },
            },
            {
              label: 'Request info',
              icon: <Icons.info className="size-3.5" />,
              onClick: () => { setSelected(row); setNote(''); setConfirmRequestInfo(true); },
            },
            {
              label: 'Reject',
              icon: <Icons.x className="size-3.5" />,
              danger: true,
              onClick: () => { setSelected(row); setNote(''); setConfirmReject(true); },
            },
          );
        }

        return <RowMenu items={menuItems} />;
      },
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Admin Verification</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Verification Queue</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Review and verify organisations applying to the platform.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending"
          value={stats.pending_verification}
          icon={Icons.info}
          valueClassName="text-amber-600"
        />
        <StatCard
          label="Needs Update"
          value={stats.needs_update}
          icon={Icons.alertTriangle}
          valueClassName="text-blue-600"
        />
        <StatCard
          label="Verified"
          value={stats.verified}
          icon={Icons.checkCircle2}
          valueClassName="text-green-600"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          icon={Icons.x}
          valueClassName="text-red-600"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-5 py-2 rounded-xl text-xs font-bold transition-all',
              statusFilter === tab.value
                ? 'bg-green-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="dash-section-label mb-0.5">{STATUS_BADGE[statusFilter]?.label} Organisations</p>
            <h3 className="text-sm font-semibold text-slate-900">Queue</h3>
          </div>
          <span className="text-xs text-slate-400">{loading ? '—' : `${orgs.length} total`}</span>
        </div>
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="size-8 rounded-lg bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded-full w-40" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-24" />
                </div>
                <div className="h-3 bg-slate-100 rounded-full w-20" />
                <div className="h-3 bg-slate-100 rounded-full w-16" />
                <div className="h-3 bg-slate-100 rounded-full w-20" />
                <div className="h-5 bg-slate-100 rounded-full w-14" />
                <div className="size-6 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={orgs}
            loading={false}
            rowKey={(r) => r.id}
            emptyTitle="No organisations in this queue"
            emptyDescription="Check another status tab above"
          />
        )}
      </div>

      {/* ── View Drawer ──────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selected?.name ?? ''}
        description={ROLE_LABELS[selected?.primary_role ?? ''] ?? selected?.primary_role}
        size="xl"
      >
        {selected && (
          <div className="space-y-8">
            {/* ── Organisation Overview ─────────────────────── */}
            <section>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Organisation Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Status">
                  <Badge variant={STATUS_BADGE[selected.status]?.variant ?? 'slate'}>
                    {STATUS_BADGE[selected.status]?.label ?? selected.status}
                  </Badge>
                </InfoCard>
                <InfoCard label="Type" value={ROLE_LABELS[selected.primary_role] ?? selected.primary_role} />
                <InfoCard label="Country" value={selected.country ?? '—'} />
                <InfoCard label="Team Size" value={selected.team_size ? `${selected.team_size} people` : '—'} />
                <InfoCard label="Years Operating" value={selected.years_operating ? `${selected.years_operating} years` : '—'} />
                <InfoCard label="Applied" value={new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              </div>
            </section>

            {/* ── Logo ──────────────────────────────────────── */}
            {selected.logo_url && (
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Logo</h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                  <img src={selected.logo_url} alt={`${selected.name} logo`} className="size-16 rounded-xl object-cover" />
                  <a href={selected.logo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-700 hover:underline">
                    View full size
                  </a>
                </div>
              </section>
            )}

            {/* ── Description ──────────────────────────────── */}
            {selected.description && (
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Description</h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>
              </section>
            )}

            {/* ── Website ──────────────────────────────────── */}
            {selected.website && (
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Website</h4>
                <a
                  href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 underline underline-offset-2"
                >
                  {selected.website}
                  <Icons.arrowUpRight className="size-3.5" />
                </a>
              </section>
            )}

            {/* ── Team Experience ──────────────────────────── */}
            {selected.management_team_experience && Object.keys(selected.management_team_experience).length > 0 && (
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Management Team Experience</h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  {Object.entries(selected.management_team_experience).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-start gap-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm text-slate-700 text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))}
                </div>
                {selected.is_new_company_with_experienced_team && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="blue">New Company, Experienced Team</Badge>
                  </div>
                )}
              </section>
            )}

            {/* ── Role-Specific Preferences ──────────────── */}
            {selected.preferences && Object.keys(selected.preferences).length > 2 && (
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  {ROLE_LABELS[selected.primary_role] ?? selected.primary_role} Preferences
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  {Object.entries(selected.preferences).map(([key, value]) => {
                    if (key === 'id' || key === 'company_id' || key === 'created_at' || key === 'updated_at') return null;
                    if (value === null || value === undefined || value === '') return null;
                    const displayValue = Array.isArray(value)
                      ? value.length > 0 ? value.join(', ') : '—'
                      : typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value);
                    if (displayValue === '—' || displayValue === '0' || displayValue === 'false') return null;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div key={key} className="flex justify-between items-start gap-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">{label}</span>
                        <span className="text-sm text-slate-700 text-right">{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Owner ────────────────────────────────────── */}
            <section>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Owner</h4>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                <div className="size-10 rounded-xl bg-green-800 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">
                    {(owner?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{owner?.full_name ?? '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{owner?.email ?? '—'}</p>
                </div>
              </div>
            </section>

            {/* ── Members ──────────────────────────────────── */}
            {members.length > 0 && (
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Team Members ({members.length})</h4>
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-500">
                          {(m.user_profiles?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{m.user_profiles?.full_name ?? '—'}</p>
                        <p className="text-[10px] text-slate-400">{m.user_profiles?.email ?? '—'}</p>
                      </div>
                      <Badge variant={m.role === 'OWNER' ? 'green' : 'slate'}>{m.role}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Previous Admin Note ──────────────────────── */}
            {selected.admin_note && (
              <section>
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Previous Admin Note</h4>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-sm text-amber-800 leading-relaxed">{selected.admin_note}</p>
                </div>
              </section>
            )}

            {/* ── Action Buttons (direct in drawer for View) ── */}
            {canAct && (
              <section className="pt-2 border-t border-slate-100">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-red-200 text-red-600 font-bold hover:bg-red-50"
                    onClick={() => setConfirmReject(true)}
                    loading={loadingReject}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-amber-200 text-amber-600 font-bold hover:bg-amber-50"
                    onClick={() => setConfirmRequestInfo(true)}
                    loading={loadingRequestInfo}
                  >
                    Request Info
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20"
                    onClick={() => setConfirmApprove(true)}
                    loading={loadingApprove}
                  >
                    Approve
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Confirm: Approve ─────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={() => handleAction('verified')}
        title="Approve Organisation"
        description={`Approve "${selected?.name}"? They will be notified by email and gain full access to the platform.${note ? ' A note will be included in the email.' : ''}`}
        confirmLabel="Approve"
        confirmVariant="default"
        loading={loadingApprove}
      />

      {/* ── Note Drawer: Reject / Request Info ───────────────────── */}
      <Drawer
        open={confirmRequestInfo || confirmReject}
        onClose={() => { setConfirmRequestInfo(false); setConfirmReject(false); setNote(''); }}
        title={confirmReject ? 'Reject Organisation' : 'Request Information'}
        description={
          confirmReject
            ? `Provide a reason for rejecting "${selected?.name}" (will be shown to the organisation).`
            : `What information do you need from "${selected?.name}"? (will be shown to the organisation).`
        }
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
              {confirmReject ? 'Rejection Reason' : 'Additional Information Needed'} *
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={confirmReject ? 'Explain why this organisation is being rejected...' : 'Describe what information is needed...'}
              className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20 transition-shadow"
            />
            {!note.trim() && (
              <p className="text-xs text-amber-600">A comment is required so the organisation understands what to do next.</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl border-slate-200 font-bold"
              onClick={() => { setConfirmRequestInfo(false); setConfirmReject(false); setNote(''); }}
            >
              Cancel
            </Button>
            <Button
              variant={confirmReject ? 'danger' : 'default'}
              className="flex-1 h-11 rounded-xl font-bold"
              disabled={!note.trim()}
              onClick={() => {
                if (confirmReject) handleAction('rejected');
                else handleAction('needs_update');
                setConfirmRequestInfo(false);
                setConfirmReject(false);
              }}
              loading={confirmReject ? loadingReject : loadingRequestInfo}
            >
              {confirmReject ? 'Reject' : 'Send Request'}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

// ── Info card helper ──────────────────────────────────────────────────────

function InfoCard({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      {children ?? <p className="text-sm font-bold text-slate-900">{value}</p>}
    </div>
  );
}
