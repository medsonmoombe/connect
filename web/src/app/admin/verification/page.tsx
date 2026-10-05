'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import * as ReactDOM from 'react-dom';
import { Badge, BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer } from '@/components/ui/drawer';
import { PageHero } from '@/components/ui/PageHero';
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
  company_members: {
    role: string;
    user_id: string;
    user_profiles: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  }[];
}

const STATUS_META: Record<OrgStatus, { variant: BadgeVariant; label: string; dot: string }> = {
  pending_verification: { variant: 'yellow', label: 'Pending',      dot: 'bg-amber-400' },
  verified:             { variant: 'green',  label: 'Verified',     dot: 'bg-green-500' },
  rejected:             { variant: 'red',    label: 'Rejected',     dot: 'bg-red-500' },
  needs_update:         { variant: 'orange', label: 'Needs Update', dot: 'bg-orange-400' },
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER:         'Developer',
  CAPITAL_PARTNER:   'Financier',
  TECHNICAL_PARTNER: 'EPC / Operator',
  GRANT_PROVIDER:    'Grant Provider',
  POWER_TRADER:      'Power Trader',
  CONSULTANT:        'Consultant',
};

const ROLE_TONE_SOFT: Record<string, string> = {
  DEVELOPER:         'bg-green-50 text-green-700',
  CAPITAL_PARTNER:   'bg-blue-50 text-blue-700',
  TECHNICAL_PARTNER: 'bg-violet-50 text-violet-700',
  GRANT_PROVIDER:    'bg-amber-50 text-amber-700',
  POWER_TRADER:      'bg-pink-50 text-pink-700',
  CONSULTANT:        'bg-surface-2 text-ink-2',
};

const STATUS_TABS: { value: OrgStatus; label: string }[] = [
  { value: 'pending_verification', label: 'Pending' },
  { value: 'needs_update',         label: 'Needs Update' },
  { value: 'verified',             label: 'Verified' },
  { value: 'rejected',             label: 'Rejected' },
];

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Row menu ──────────────────────────────────────────────────────────────

function RowMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[]
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(v => !v);
  };

  return (
    <>
      <button ref={triggerRef} onClick={toggle}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <Icons.moreVertical className="size-4" />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-48 bg-white border border-slate-200 shadow-lg py-1">
          {items.map((item, i) => (
            <button key={i} onClick={() => { setOpen(false); item.onClick(); }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50')}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Org Card ──────────────────────────────────────────────────────────────

function OrgCard({ org, canAct, onView, onApprove, onRequestInfo, onReject }: {
  org: PendingOrg;
  canAct: boolean;
  onView: () => void;
  onApprove: () => void;
  onRequestInfo: () => void;
  onReject: () => void;
}) {
  const owner  = org.company_members?.find(m => m.role === 'OWNER')?.user_profiles;
  const meta   = STATUS_META[org.status];
  const initials = org.name.substring(0, 2).toUpperCase();

  const menuItems = [
    { label: 'Full review', icon: <Icons.eye className="size-3.5" />, onClick: () => window.location.href = `/admin/verification/${org.id}` },
    { label: 'Quick view',  icon: <Icons.info className="size-3.5" />, onClick: onView },
    ...(canAct ? [
      { label: 'Approve',      icon: <Icons.checkCircle2 className="size-3.5" />, onClick: onApprove },
      { label: 'Request info', icon: <Icons.info className="size-3.5" />,         onClick: onRequestInfo },
      { label: 'Reject',       icon: <Icons.x className="size-3.5" />,            onClick: onReject, danger: true },
    ] : []),
  ];

  return (
    <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold tracking-[0.02em]', ROLE_TONE_SOFT[org.primary_role] ?? 'bg-surface-2 text-ink-2')}>
          {ROLE_LABELS[org.primary_role] ?? org.primary_role}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn('size-[7px] rounded-full', meta.dot)} />
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">{meta.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="size-10 shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
            {org.logo_url
              ? <img src={org.logo_url} alt="" className="size-full object-cover" />
              : <span className="text-sm font-bold text-slate-400">{initials}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">{org.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{org.country}</p>
          </div>
          <RowMenu items={menuItems} />
        </div>

        {/* Meta rows */}
        <div className="space-y-1.5 text-[11px]">
          {owner && (
            <div className="flex items-center gap-2">
              <Icons.user className="size-3 text-slate-300 shrink-0" />
              <span className="text-slate-500 truncate">{owner.full_name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400 truncate">{owner.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Icons.clock className="size-3 text-slate-300 shrink-0" />
            <span className="text-slate-400">Applied {timeAgo(org.created_at)}</span>
            {org.team_size && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{org.team_size} members</span>
              </>
            )}
          </div>
        </div>

        {/* Description snippet */}
        {org.description && (
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 border-t border-slate-50 pt-2">
            {org.description}
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between gap-2">
        <Link href={`/admin/verification/${org.id}`}
          className="text-[11px] font-bold text-[#0b3b24] hover:underline flex items-center gap-1">
          Full Review <Icons.arrowUpRight className="size-3" />
        </Link>
        {canAct && (
          <div className="flex gap-1.5">
            <button onClick={onReject}
              className="px-2.5 py-1 text-[11px] font-bold text-red-600 border border-red-100 hover:bg-red-50 transition-colors">
              Reject
            </button>
            <button onClick={onApprove}
              className="px-2.5 py-1 text-[11px] font-bold text-white bg-brand hover:bg-brand-hover transition-colors">
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI strip ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent }: {
  label: string; value: number; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">{label}</span>
        <Icon className="size-3.5 text-ink-3/50" />
      </div>
      <div className="px-4 py-3">
        <p className={cn('text-2xl font-bold tracking-tight', accent ?? 'text-slate-900')}>{value}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function VerificationQueuePage() {
  const [orgs, setOrgs]               = useState<PendingOrg[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrgStatus>('pending_verification');
  const [search, setSearch]           = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stats, setStats]             = useState<Record<OrgStatus, number>>({
    pending_verification: 0, needs_update: 0, verified: 0, rejected: 0,
  });

  const [selected, setSelected]       = useState<PendingOrg | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [note, setNote]               = useState('');
  const [confirmApprove, setConfirmApprove]       = useState(false);
  const [confirmReject, setConfirmReject]         = useState(false);
  const [confirmRequestInfo, setConfirmRequestInfo] = useState(false);
  const [loadingApprove, setLoadingApprove]       = useState(false);
  const [loadingReject, setLoadingReject]         = useState(false);
  const [loadingRequestInfo, setLoadingRequestInfo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/organizations?${params}`);
      const { data } = await res.json();
      setOrgs(data ?? []);

      const statuses: OrgStatus[] = ['pending_verification', 'needs_update', 'verified', 'rejected'];
      const results = await Promise.all(statuses.map(s => {
        const p = new URLSearchParams({ status: s });
        if (debouncedSearch) p.set('search', debouncedSearch);
        return fetch(`/api/admin/organizations?${p}`).then(r => r.json());
      }));
      setStats({
        pending_verification: results[0].data?.length ?? 0,
        needs_update:         results[1].data?.length ?? 0,
        verified:             results[2].data?.length ?? 0,
        rejected:             results[3].data?.length ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const openView = (org: PendingOrg) => { setSelected(org); setNote(''); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setSelected(null); setNote(''); };

  const triggerAction = (org: PendingOrg, action: 'approve' | 'reject' | 'info') => {
    setSelected(org); setNote('');
    if (action === 'approve')  setConfirmApprove(true);
    if (action === 'reject')   setConfirmReject(true);
    if (action === 'info')     setConfirmRequestInfo(true);
  };

  const handleAction = async (status: 'verified' | 'rejected' | 'needs_update') => {
    if (!selected) return;
    const setLoader = status === 'verified' ? setLoadingApprove : status === 'rejected' ? setLoadingReject : setLoadingRequestInfo;
    setLoader(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status, note: note || undefined }),
      });
      if (res.ok) {
        toast.success(`Organisation ${STATUS_META[status].label.toLowerCase()}`, {
          description: `"${selected.name}" has been updated.`,
        });
        setConfirmApprove(false); setConfirmReject(false); setConfirmRequestInfo(false);
        closeDrawer(); fetchOrgs();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update status');
      }
    } catch { toast.error('An error occurred'); }
    finally { setLoader(false); }
  };

  const canAct = statusFilter === 'pending_verification' || statusFilter === 'needs_update';
  const owner  = selected?.company_members?.find(m => m.role === 'OWNER')?.user_profiles;

  return (
    <div className="space-y-7">

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHero
        eyebrow="Admin · Verification"
        title="Verification Queue"
        description="Review and verify organisations applying to the platform."
      />

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pending"      value={stats.pending_verification} icon={Icons.clock}        accent="text-amber-600" />
        <KpiCard label="Needs Update" value={stats.needs_update}         icon={Icons.alertTriangle} accent="text-orange-500" />
        <KpiCard label="Verified"     value={stats.verified}             icon={Icons.checkCircle2}  accent="text-green-700" />
        <KpiCard label="Rejected"     value={stats.rejected}             icon={Icons.x}             accent="text-red-600" />
      </div>

      {/* ── Search + Filter tabs ────────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div className="flex items-center gap-2">
            <Icons.search className="size-3.5 text-g-600" />
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Filter &amp; Search</p>
          </div>
          <span className="text-[11px] font-semibold text-g-600">
            {loading ? '—' : `${orgs.length} result${orgs.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="p-5 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search organisations by name or country..."
              className="w-full h-9 pl-10 pr-4 rounded-none border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <Icons.close className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex border-t border-slate-100">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-bold border-b-2 transition-colors',
                statusFilter === tab.value
                  ? 'border-green-800 text-green-800 bg-green-800/[0.03]'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              )}>
              {tab.label}
              <span className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded-none min-w-[20px] text-center',
                statusFilter === tab.value ? 'bg-green-800 text-white' : 'bg-slate-100 text-slate-500'
              )}>
                {stats[tab.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Card Grid ──────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-slate-200 bg-white overflow-hidden animate-pulse">
              <div className="h-9 bg-slate-100" />
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="size-10 bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded w-full" />
                <div className="h-2.5 bg-slate-100 rounded w-2/3" />
              </div>
              <div className="h-10 bg-slate-50 border-t border-slate-100" />
            </div>
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <div className="border border-slate-200 bg-white p-16 text-center">
          <Icons.checkCircle2 className="size-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No organisations in this queue</p>
          <p className="text-xs text-slate-400 mt-1">Check another status tab above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orgs.map(org => (
            <OrgCard
              key={org.id}
              org={org}
              canAct={canAct}
              onView={() => openView(org)}
              onApprove={() => triggerAction(org, 'approve')}
              onRequestInfo={() => triggerAction(org, 'info')}
              onReject={() => triggerAction(org, 'reject')}
            />
          ))}
        </div>
      )}

      {/* ── Quick View Drawer ──────────────────────────────────── */}
      <Drawer open={drawerOpen} onClose={closeDrawer}
        title={selected?.name ?? ''} description={ROLE_LABELS[selected?.primary_role ?? ''] ?? ''} size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_META[selected.status].variant}>{STATUS_META[selected.status].label}</Badge>
              <Link href={`/admin/verification/${selected.id}`}
                className="text-xs font-bold text-[#0b3b24] hover:underline flex items-center gap-1">
                Open full review <Icons.arrowUpRight className="size-3" />
              </Link>
            </div>

            {selected.description && (
              <div className="border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selected.description}</p>
              </div>
            )}

            {owner && (
              <div className="border border-slate-100 bg-slate-50 p-4 flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-none bg-brand-soft text-brand-text shrink-0">
                  <span className="text-xs font-bold text-white">
                    {(owner.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{owner.full_name}</p>
                  <p className="text-xs text-slate-500">{owner.email}</p>
                </div>
              </div>
            )}

            {selected.admin_note && (
              <div className="border border-amber-100 bg-amber-50 p-4">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Previous Admin Note</p>
                <p className="text-sm text-amber-800">{selected.admin_note}</p>
              </div>
            )}

            {canAct && (
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <Button variant="outline" className="flex-1 h-10 border-red-200 text-red-600 hover:bg-red-50 font-bold"
                  onClick={() => setConfirmReject(true)} loading={loadingReject}>Reject</Button>
                <Button variant="outline" className="flex-1 h-10 border-amber-200 text-amber-600 hover:bg-amber-50 font-bold"
                  onClick={() => setConfirmRequestInfo(true)} loading={loadingRequestInfo}>Request Info</Button>
                <Button className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white font-bold"
                  onClick={() => setConfirmApprove(true)} loading={loadingApprove}>Approve</Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Confirm Approve ────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmApprove} onClose={() => setConfirmApprove(false)}
        onConfirm={() => handleAction('verified')}
        title="Approve Organisation"
        description={`Approve "${selected?.name}"? They will be notified and gain full platform access.`}
        confirmLabel="Approve" confirmVariant="default" loading={loadingApprove}
      />

      {/* ── Note Drawer: Reject / Request Info ─────────────────── */}
      <Drawer
        open={confirmReject || confirmRequestInfo}
        onClose={() => { setConfirmReject(false); setConfirmRequestInfo(false); setNote(''); }}
        title={confirmReject ? 'Reject Organisation' : 'Request Information'}
        description={confirmReject
          ? `Provide a reason for rejecting "${selected?.name}".`
          : `What information do you need from "${selected?.name}"?`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {confirmReject ? 'Rejection Reason' : 'Information Needed'} *
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder={confirmReject ? 'Explain why this organisation is being rejected...' : 'Describe what information is needed...'}
              className="w-full h-24 px-4 py-3 border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/20"
            />
            {!note.trim() && (
              <p className="text-xs text-amber-600">A comment is required.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-10 font-bold"
              onClick={() => { setConfirmReject(false); setConfirmRequestInfo(false); setNote(''); }}>
              Cancel
            </Button>
            <Button variant={confirmReject ? 'danger' : 'default'} className="flex-1 h-10 font-bold"
              disabled={!note.trim()}
              onClick={() => {
                if (confirmReject) handleAction('rejected');
                else handleAction('needs_update');
                setConfirmReject(false); setConfirmRequestInfo(false);
              }}
              loading={confirmReject ? loadingReject : loadingRequestInfo}>
              {confirmReject ? 'Reject' : 'Send Request'}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
