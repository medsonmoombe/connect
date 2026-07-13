'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactDOM from 'react-dom';
import { DataTable, Column } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { Badge, BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

type OrgStatus = 'pending_verification' | 'verified' | 'rejected' | 'needs_update' | 'deactivated';

interface OrgMember {
  role: string;
  user_id: string;
  user_profiles: { id: string; full_name: string; email: string; avatar_url?: string; created_at?: string; job_title?: string } | null;
}

interface OrgProject {
  id: string;
  title: string;
  sector: string;
  status: string;
  country?: string;
  created_at: string;
}

interface OrgRecord {
  id: string;
  name: string;
  primary_role: string;
  country: string;
  status: OrgStatus;
  created_at: string;
  admin_note?: string;
  description?: string;
  website?: string;
  location?: string;
  size?: number;
  logo_url?: string;
  company_members: OrgMember[];
  preferences?: Record<string, any> | null;
  projects?: OrgProject[];
}

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  pending_verification: { variant: 'yellow', label: 'Pending' },
  verified:             { variant: 'green',  label: 'Verified' },
  rejected:             { variant: 'red',    label: 'Rejected' },
  needs_update:         { variant: 'orange', label: 'Needs Update' },
  deactivated:          { variant: 'slate',  label: 'Deactivated' },
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER:         'Developer',
  CAPITAL_PARTNER:   'Capital Partner',
  TECHNICAL_PARTNER: 'Technical Partner',
  GRANT_PROVIDER:    'Grant Provider',
  POWER_TRADER:      'Power Trader',
};

const STATUS_TABS: { value: OrgStatus | 'all'; label: string }[] = [
  { value: 'all',                  label: 'All' },
  { value: 'verified',             label: 'Verified' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'needs_update',         label: 'Needs Update' },
  { value: 'rejected',             label: 'Rejected' },
  { value: 'deactivated',          label: 'Deactivated' },
];

const MANAGEMENT_TABS = ['Overview', 'Members', 'Projects', 'Preferences'] as const;
type MgmtTab = typeof MANAGEMENT_TABS[number];

// ── Portal-based RowMenu ──────────────────────────────────────────────────

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
      ) setOpen(false);
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
      <button ref={triggerRef} onClick={toggle} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
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
                item.disabled ? 'text-slate-300 cursor-not-allowed'
                  : item.danger ? 'text-red-600 hover:bg-red-50'
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

// ── Info card helper ──────────────────────────────────────────────────────

function InfoCard({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      {children ?? <p className="text-sm font-bold text-slate-900">{value ?? '—'}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminCompaniesPage() {
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrgStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrgRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mgmtTab, setMgmtTab] = useState<MgmtTab>('Overview');

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState<OrgStatus | null>(null);

  // Loading states
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingDeactivate, setLoadingDeactivate] = useState(false);
  const [loadingReactivate, setLoadingReactivate] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Edit details state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', website: '', location: '', size: '' });
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Invite member state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [loadingInvite, setLoadingInvite] = useState(false);

  // Status note
  const [statusNote, setStatusNote] = useState('');

  // Fetch orgs
  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/organizations?${params}`);
      const { data } = await res.json();
      setOrgs(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  // Refetch a single org's full data
  const refetchOrg = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/organizations/${id}`);
    const { data } = await res.json();
    if (data) {
      setSelected(data);
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    }
  }, []);

  // Open drawer
  const openDrawer = (org: OrgRecord) => {
    setSelected(org);
    setMgmtTab('Overview');
    setEditMode(false);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('MEMBER');
    setStatusNote('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setEditMode(false);
    setInviteOpen(false);
    setConfirmDelete(false);
    setConfirmDeactivate(false);
    setConfirmReactivate(false);
    setConfirmStatusChange(null);
    setStatusNote('');
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selected) return;
    setLoadingDelete(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, { method: 'DELETE' });
      if (res.ok) {
        setOrgs(prev => prev.filter(o => o.id !== selected.id));
        closeDrawer();
      }
    } finally { setLoadingDelete(false); }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setLoadingDeactivate(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', reason: statusNote || undefined }),
      });
      if (res.ok) {
        await refetchOrg(selected.id);
        fetchOrgs();
        setConfirmDeactivate(false);
        setStatusNote('');
      }
    } finally { setLoadingDeactivate(false); }
  };

  const handleReactivate = async () => {
    if (!selected) return;
    setLoadingReactivate(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate', status: 'verified', note: statusNote || undefined }),
      });
      if (res.ok) {
        await refetchOrg(selected.id);
        fetchOrgs();
        setConfirmReactivate(false);
        setStatusNote('');
      }
    } finally { setLoadingReactivate(false); }
  };

  const handleStatusChange = async () => {
    if (!selected || !confirmStatusChange) return;
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: confirmStatusChange, note: statusNote || undefined }),
      });
      if (res.ok) {
        await refetchOrg(selected.id);
        fetchOrgs();
        setConfirmStatusChange(null);
        setStatusNote('');
      }
    } finally { setLoadingStatus(false); }
  };

  const handleEditSave = async () => {
    if (!selected) return;
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          name: editForm.name,
          description: editForm.description,
          website: editForm.website,
          location: editForm.location,
          size: editForm.size ? parseInt(editForm.size) : undefined,
        }),
      });
      if (res.ok) {
        await refetchOrg(selected.id);
        setEditMode(false);
      }
    } finally { setLoadingEdit(false); }
  };

  const handleInvite = async () => {
    if (!selected || !inviteEmail) return;
    setLoadingInvite(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, membershipRole: inviteRole }),
      });
      if (res.ok) {
        setInviteOpen(false);
        setInviteEmail('');
        setInviteRole('MEMBER');
        await refetchOrg(selected.id);
      }
    } finally { setLoadingInvite(false); }
  };

  // ── Filtered list ─────────────────────────────────────────────────────

  const filteredOrgs = orgs.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.country?.toLowerCase().includes(q) || ROLE_LABELS[o.primary_role]?.toLowerCase().includes(q);
  });

  // ── Table columns ─────────────────────────────────────────────────────

  const columns: Column<OrgRecord>[] = [
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
      key: 'type',
      header: 'Type',
      render: (row) => <span className="text-sm text-slate-600">{ROLE_LABELS[row.primary_role] ?? row.primary_role}</span>,
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
      key: 'location',
      header: 'Location',
      render: (row) => <span className="text-sm text-slate-600">{row.country ?? row.location ?? '—'}</span>,
    },
    {
      key: 'members',
      header: 'Members',
      className: 'text-center',
      render: (row) => <span className="text-sm font-bold text-slate-900">{row.company_members?.length ?? 0}</span>,
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
        const isDeactivated = row.status === 'deactivated';
        const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [
          {
            label: 'Open organisation',
            icon: <Icons.eye className="size-3.5" />,
            onClick: () => openDrawer(row),
          },
        ];

        if (isDeactivated) {
          menuItems.push({
            label: 'Reactivate',
            icon: <Icons.refreshCw className="size-3.5" />,
            onClick: () => { setSelected(row); setConfirmReactivate(true); },
          });
        } else {
          menuItems.push({
            label: 'Deactivate',
            icon: <Icons.lock className="size-3.5" />,
            onClick: () => { setSelected(row); setConfirmDeactivate(true); },
          });
        }

        menuItems.push({
          label: 'Delete',
          icon: <Icons.trash className="size-3.5" />,
          danger: true,
          onClick: () => { setSelected(row); setConfirmDelete(true); },
        });

        return <RowMenu items={menuItems} />;
      },
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Organisations</h2>
          <p className="text-slate-500 mt-1 text-sm">Manage all organisations on the platform.</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit flex-wrap">
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

      {/* Search + table */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, country, type..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-800/20"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">{loading ? '—' : `${filteredOrgs.length} total`}</span>
        </div>
        <DataTable
          columns={columns}
          data={filteredOrgs}
          loading={loading}
          rowKey={(r) => r.id}
          emptyTitle="No organisations found"
          emptyDescription="Try a different filter"
          pageSize={8}
        />
      </div>

      {/* ── Management Drawer ──────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selected?.name ?? ''}
        description={ROLE_LABELS[selected?.primary_role ?? ''] ?? selected?.primary_role}
        size="xl"
      >
        {selected && (
          <div className="space-y-6">
            {/* Drawer header actions */}
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_BADGE[selected.status]?.variant ?? 'slate'}>
                {STATUS_BADGE[selected.status]?.label ?? selected.status}
              </Badge>
              <div className="flex gap-2">
                {selected.status === 'deactivated' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => setConfirmReactivate(true)}
                  >
                    <Icons.refreshCw className="size-3 mr-1" />
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => setConfirmDeactivate(true)}
                  >
                    <Icons.lock className="size-3 mr-1" />
                    Deactivate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg text-xs font-bold border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icons.trash className="size-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {MANAGEMENT_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => { setMgmtTab(tab); setEditMode(false); setInviteOpen(false); }}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                    mgmtTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ──────────────────────────────────── */}
            {mgmtTab === 'Overview' && (
              <div className="space-y-6">
                {editMode ? (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Edit Details</h4>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Name</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Description</label>
                      <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Website</label>
                        <input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Location</label>
                        <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Team Size</label>
                      <input type="number" value={editForm.size} onChange={e => setEditForm(f => ({ ...f, size: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button className="flex-1 h-10 rounded-xl font-bold" onClick={handleEditSave} loading={loadingEdit}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organisation Details</h4>
                        <button
                          onClick={() => {
                            setEditForm({
                              name: selected.name ?? '',
                              description: selected.description ?? '',
                              website: selected.website ?? '',
                              location: selected.location ?? selected.country ?? '',
                              size: selected.size?.toString() ?? '',
                            });
                            setEditMode(true);
                          }}
                          className="text-xs font-bold text-green-700 hover:text-green-800"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoCard label="Status">
                          <Badge variant={STATUS_BADGE[selected.status]?.variant ?? 'slate'}>
                            {STATUS_BADGE[selected.status]?.label ?? selected.status}
                          </Badge>
                        </InfoCard>
                        <InfoCard label="Type" value={ROLE_LABELS[selected.primary_role] ?? selected.primary_role} />
                        <InfoCard label="Country" value={selected.country} />
                        <InfoCard label="Location" value={selected.location} />
                        <InfoCard label="Team Size" value={selected.size ? `${selected.size} people` : '—'} />
                        <InfoCard label="Created" value={new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                      </div>
                    </section>

                    {selected.logo_url && (
                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Logo</h4>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                          <img src={selected.logo_url} alt="" className="size-16 rounded-xl object-cover" />
                          <a href={selected.logo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-700 hover:underline">View full size</a>
                        </div>
                      </section>
                    )}

                    {selected.description && (
                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Description</h4>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                        </div>
                      </section>
                    )}

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

                    {selected.admin_note && (
                      <section>
                        <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Admin Note</h4>
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                          <p className="text-sm text-amber-800 leading-relaxed">{selected.admin_note}</p>
                        </div>
                      </section>
                    )}

                    {/* Owner */}
                    {(() => {
                      const owner = selected.company_members?.find(m => m.role === 'OWNER');
                      if (!owner?.user_profiles) return null;
                      return (
                        <section>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Owner</h4>
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                            <div className="size-10 rounded-xl bg-green-800 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-white">
                                {(owner.user_profiles.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">{owner.user_profiles.full_name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{owner.user_profiles.email}</p>
                            </div>
                          </div>
                        </section>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Members ───────────────────────────────────── */}
            {mgmtTab === 'Members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Team Members ({selected.company_members?.length ?? 0})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold"
                    onClick={() => setInviteOpen(!inviteOpen)}
                  >
                    <Icons.plus className="size-3 mr-1" />
                    Invite
                  </Button>
                </div>

                {/* Invite form */}
                {inviteOpen && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100 space-y-3">
                    <p className="text-xs font-bold text-green-800">Invite a new member</p>
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      type="email"
                      className="w-full h-10 px-4 rounded-xl border border-green-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl border border-green-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20 appearance-none"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Owner</option>
                    </select>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs font-bold" onClick={() => { setInviteOpen(false); setInviteEmail(''); }}>Cancel</Button>
                      <Button className="flex-1 h-9 rounded-xl text-xs font-bold" onClick={handleInvite} loading={loadingInvite} disabled={!inviteEmail}>Send Invite</Button>
                    </div>
                  </div>
                )}

                {/* Members list */}
                <div className="space-y-2">
                  {(selected.company_members ?? []).map((m, i) => (
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
                      <Badge variant={m.role === 'OWNER' ? 'green' : m.role === 'ADMIN' ? 'blue' : 'slate'}>
                        {m.role}
                      </Badge>
                    </div>
                  ))}
                  {(!selected.company_members || selected.company_members.length === 0) && (
                    <p className="text-sm text-slate-400 text-center py-6">No members found.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Projects ─────────────────────────────────── */}
            {mgmtTab === 'Projects' && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Projects ({selected.projects?.length ?? 0})
                </h4>
                {selected.projects && selected.projects.length > 0 ? (
                  <div className="space-y-2">
                    {selected.projects.map(p => (
                      <div key={p.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{p.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{p.sector?.replace(/_/g, ' ')} {p.country ? `· ${p.country}` : ''}</p>
                        </div>
                        <Badge variant={p.status === 'ACTIVE' ? 'green' : p.status === 'DRAFT' ? 'slate' : 'blue'}>
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-6">No projects yet.</p>
                )}
              </div>
            )}

            {/* ── Tab: Preferences ──────────────────────────────── */}
            {mgmtTab === 'Preferences' && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {ROLE_LABELS[selected.primary_role] ?? selected.primary_role} Preferences
                </h4>
                {selected.preferences && Object.keys(selected.preferences).length > 2 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    {Object.entries(selected.preferences).map(([key, value]) => {
                      if (key === 'id' || key === 'company_id' || key === 'created_at' || key === 'updated_at') return null;
                      if (value === null || value === undefined || value === '') return null;
                      const displayValue = Array.isArray(value)
                        ? value.length > 0 ? value.join(', ') : '—'
                        : typeof value === 'object' ? JSON.stringify(value) : String(value);
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
                ) : (
                  <p className="text-sm text-slate-400 text-center py-6">No preferences recorded.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Confirm: Delete ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Organisation"
        description={`Permanently delete "${selected?.name}"? All members, projects, and data will be removed. This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={loadingDelete}
      />

      {/* ── Confirm: Deactivate ──────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => { setConfirmDeactivate(false); setStatusNote(''); }}
        onConfirm={handleDeactivate}
        title="Deactivate Organisation"
        description={`Deactivate "${selected?.name}"? All members will be blocked from accessing the site until reactivated.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={loadingDeactivate}
      >
        <div className="mt-3">
          <textarea
            value={statusNote}
            onChange={e => setStatusNote(e.target.value)}
            placeholder="Reason (optional, sent to members)..."
            className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20"
          />
        </div>
      </ConfirmDialog>

      {/* ── Confirm: Reactivate ──────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmReactivate}
        onClose={() => { setConfirmReactivate(false); setStatusNote(''); }}
        onConfirm={handleReactivate}
        title="Reactivate Organisation"
        description={`Reactivate "${selected?.name}"? Members will regain access to the platform.`}
        confirmLabel="Reactivate"
        confirmVariant="default"
        loading={loadingReactivate}
      />

      {/* ── Confirm: Status Change ───────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmStatusChange}
        onClose={() => { setConfirmStatusChange(null); setStatusNote(''); }}
        onConfirm={handleStatusChange}
        title={`Change Status to ${STATUS_BADGE[confirmStatusChange ?? '']?.label ?? confirmStatusChange}`}
        description={`Update "${selected?.name}" status to ${STATUS_BADGE[confirmStatusChange ?? '']?.label ?? confirmStatusChange}?`}
        confirmLabel="Update Status"
        confirmVariant={confirmStatusChange === 'rejected' ? 'danger' : 'default'}
        loading={loadingStatus}
      >
        <div className="mt-3">
          <textarea
            value={statusNote}
            onChange={e => setStatusNote(e.target.value)}
            placeholder="Note (optional, sent via email)..."
            className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
