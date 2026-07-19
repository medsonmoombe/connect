'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactDOM from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton, KpiBarSkeleton } from '@/components/ui/skeleton';
import { useAdminSuspendUser } from '@/hooks/queries';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  mfa_enabled: boolean;
  suspended_at: string | null;
  locked_until: string | null;
  lock_reason: string | null;
  created_at: string;
  company_members: {
    role: string;
    company_id: string;
    companies: { name: string; primary_role: string; is_platform_org?: boolean } | null;
  }[];
}

interface OrgOption {
  id: string;
  name: string;
}

interface PendingInvite {
  id: string;
  email: string | null;
  token: string;
  expires_at: string;
  created_at: string;
  membership_role: string | null;
  companies?: { name: string } | null;
}

type DrawerAction = 'suspend' | 'reactivate' | 'unlock' | 'edit' | null;

const ORG_TYPE_LABELS: Record<string, string> = {
  DEVELOPER: 'Developer',
  CAPITAL_PARTNER: 'Capital Partner',
  TECHNICAL_PARTNER: 'Technical Partner',
  POWER_TRADER: 'Power Trader',
  GRANT_PROVIDER: 'Grant Provider',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
] as const;

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Three-dot menu (portal-based) ────────────────────────────────────────────

function RowMenu({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[] }) {
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
          className="w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in duration-150"
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

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ suspended, locked }: { suspended: boolean; locked?: boolean }) {
  if (locked) return <Badge variant="orange">Locked</Badge>;
  return suspended ? <Badge variant="red">Suspended</Badge> : <Badge variant="green">Active</Badge>;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPageChange }: { page: number; total: number; pageSize: number; onPageChange: (p: number) => void }) {
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
          className="h-8 px-2.5 rounded-lg text-xs font-semibold"
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
                'size-8 rounded-lg text-xs font-bold transition-colors',
                p === page ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="ghost" size="sm"
          className="h-8 px-2.5 rounded-lg text-xs font-semibold"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <Icons.arrowRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  // Server data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalUsers: 0, totalActive: 0, totalSuspended: 0, totalLocked: 0 });
  const [orgTypes, setOrgTypes] = useState<string[]>([]);
  const [orgNames, setOrgNames] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state (debounced)
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const pageSize = 10;

  const debouncedSearch = useDebounced(search, 350);
  const debouncedTypeFilter = useDebounced(typeFilter, 100);
  const debouncedOrgFilter = useDebounced(orgFilter, 100);
  const debouncedSortBy = useDebounced(sortBy, 100);

  // Reset page when filters change
  const [prevFilters, setPrevFilters] = useState({ debouncedSearch, debouncedTypeFilter, debouncedOrgFilter, debouncedSortBy });
  useEffect(() => {
    if (debouncedSearch !== prevFilters.debouncedSearch || debouncedTypeFilter !== prevFilters.debouncedTypeFilter || debouncedOrgFilter !== prevFilters.debouncedOrgFilter || debouncedSortBy !== prevFilters.debouncedSortBy) {
      setPage(1);
      setPrevFilters({ debouncedSearch, debouncedTypeFilter, debouncedOrgFilter, debouncedSortBy });
    }
  }, [debouncedSearch, debouncedTypeFilter, debouncedOrgFilter, debouncedSortBy, prevFilters]);

  // Invites
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesDrawerOpen, setInvitesDrawerOpen] = useState(false);
  const [confirmRevokeInvite, setConfirmRevokeInvite] = useState<PendingInvite | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [inviting, setInviting] = useState(false);

  // Provision user
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provForm, setProvForm] = useState({ email: '', fullName: '', companyId: '', role: 'OWNER' });
  const [provisioning, setProvisioning] = useState(false);

  // Action drawer
  const [actionUser, setActionUser] = useState<UserProfile | null>(null);
  const [drawerAction, setDrawerAction] = useState<DrawerAction>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(false);

  const [editForm, setEditForm] = useState({ full_name: '', phone: '', job_title: '' });
  const [saving, setSaving] = useState(false);
  const [mfaLoadingId, setMfaLoadingId] = useState<string | null>(null);

  const { mutateAsync: suspendUser, isPending: suspending } = useAdminSuspendUser();

  // ── Fetch users (server-side) ──────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (debouncedTypeFilter !== 'all') params.set('typeFilter', debouncedTypeFilter);
      if (debouncedOrgFilter !== 'all') params.set('orgFilter', debouncedOrgFilter);
      params.set('sortBy', debouncedSortBy);

      const res = await fetch(`/api/admin/users?${params}`);
      const d = await res.json();
      setUsers(d.data ?? []);
      setTotal(d.total ?? 0);
      setStats(d.stats ?? { totalUsers: 0, totalActive: 0, totalSuspended: 0, totalLocked: 0 });
      setOrgTypes(d.orgTypes ?? []);
      setOrgNames(d.orgNames ?? []);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, debouncedTypeFilter, debouncedOrgFilter, debouncedSortBy]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Fetch invites ───────────────────────────────────────────────────────────
  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch('/api/auth/invite?pending=1');
      const d = await res.json();
      setInvites(d.data ?? []);
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const openInvitesDrawer = () => {
    setInvitesDrawerOpen(true);
    fetchInvites();
  };

  // ── RBAC helpers ────────────────────────────────────────────────────────────
  const canActOn = (u: UserProfile): boolean => {
    if (!currentUser) return false;
    if (u.id === currentUser.id) return false;
    const membership = u.company_members?.[0];
    const isPlatformOrg = membership?.companies?.is_platform_org === true;
    const role = membership?.role;
    if (isPlatformOrg && role === 'ADMIN') return false;
    if (role === 'OWNER') return false;
    return true;
  };

  // ── Drawer ──────────────────────────────────────────────────────────────────
  const openAction = (u: UserProfile, action: DrawerAction) => {
    setActionUser(u);
    setDrawerAction(action);
    setSuspendReason('');
    setConfirmAction(false);
    if (action === 'edit') {
      setEditForm({
        full_name: u.full_name || '',
        phone: u.phone || '',
        job_title: u.job_title || '',
      });
    }
  };

  const closeActionDrawer = () => {
    setActionUser(null);
    setDrawerAction(null);
    setSuspendReason('');
    setConfirmAction(false);
  };

  const handleExecuteAction = async () => {
    if (!actionUser || !drawerAction || drawerAction === 'edit') return;
    if (drawerAction === 'unlock') {
      await suspendUser(actionUser.id, 'unlock');
      toast.success('Account unlocked');
    } else {
      await suspendUser(actionUser.id, drawerAction, drawerAction === 'suspend' ? suspendReason || undefined : undefined);
      toast.success(drawerAction === 'suspend' ? 'Account suspended' : 'Account reactivated');
    }
    setConfirmAction(false);
    closeActionDrawer();
    fetchUsers();
  };

  const handleSaveEdit = async () => {
    if (!actionUser) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actionUser.id, ...editForm }),
      });
      if (res.ok) {
        closeActionDrawer();
        toast.success('User updated');
        fetchUsers();
      } else {
        toast.error('Failed to update user');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMfa = async (u: UserProfile) => {
    setMfaLoadingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_mfa', mfa_enabled: !u.mfa_enabled }),
      });
      if (res.ok) {
        toast.success(u.mfa_enabled ? 'MFA disabled' : 'MFA enabled');
        fetchUsers();
      } else {
        toast.error('Failed to toggle MFA');
      }
    } catch {
      toast.error('Failed to toggle MFA');
    } finally {
      setMfaLoadingId(null);
    }
  };

  // ── Send invite ─────────────────────────────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined, expiresInDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || data.error || 'Failed to send invite.');
      } else {
        toast.success(email ? `Invite sent to ${email}.` : 'Open invite link generated.');
        setEmail('');
        fetchInvites();
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!confirmRevokeInvite) return;
    setRevoking(true);
    try {
      await fetch(`/api/auth/invite/${confirmRevokeInvite.id}`, { method: 'DELETE' });
      setInvites(prev => prev.filter(i => i.id !== confirmRevokeInvite.id));
      setConfirmRevokeInvite(null);
      toast.success('Invite revoked');
    } finally {
      setRevoking(false);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisioning(true);
    try {
      const selectedOrg = orgNames.find(o => o.id === provForm.companyId);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: provForm.email,
          fullName: provForm.fullName || undefined,
          orgName: selectedOrg?.name || undefined,
          role: provForm.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.log("Provision error:", data);
        toast.error(data.error?.message || data.error || 'Failed to provision user.');
      } else {
        toast.success(`User provisioned${data.data.generated_password ? `. Password: ${data.data.generated_password}` : ''}`);
        setProvForm({ email: '', fullName: '', companyId: '', role: 'OWNER' });
        setProvisionOpen(false);
        fetchUsers();
      }
    } finally {
      setProvisioning(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const userColumns = [
    {
      key: 'user',
      header: 'User',
      render: (u: UserProfile) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
            {(u.full_name || u.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name || '—'}</p>
            <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'org',
      header: 'Organisation',
      render: (u: UserProfile) => {
        const m = u.company_members?.[0];
        const orgName = m?.companies?.name;
        const primaryRole = m?.companies?.primary_role;
        return (
          <div>
            <p className="text-sm text-slate-700">{orgName || <span className="text-slate-400">—</span>}</p>
            {primaryRole && <p className="text-[10px] text-slate-400">{ORG_TYPE_LABELS[primaryRole] ?? primaryRole}</p>}
          </div>
        );
      },
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (u: UserProfile) => (
        <span className="text-sm text-slate-500">
          {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u: UserProfile) => {
        const isLocked = !!u.locked_until && new Date(u.locked_until) > new Date();
        return <StatusBadge suspended={!!u.suspended_at} locked={isLocked} />;
      },
    },
    {
      key: 'mfa',
      header: 'MFA',
      render: (u: UserProfile) => {
        const isSelf = u.id === currentUser?.id;
        const membership = u.company_members?.[0];
        const isPlatformOrg = membership?.companies?.is_platform_org === true;
        const isOrgAdminUser = !isPlatformOrg && (membership?.role === 'OWNER' || membership?.role === 'ADMIN');
        const forcedOn = isOrgAdminUser;

        if (forcedOn) {
          return (
            <div className="flex items-center gap-1.5" title="Org admins always have MFA enabled">
              <div className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-primary opacity-60">
                <span className="pointer-events-none inline-block size-4 translate-x-4 transform rounded-full bg-white shadow ring-0" />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Required</span>
            </div>
          );
        }

        return (
          <button
            disabled={isSelf || mfaLoadingId === u.id}
            onClick={() => handleToggleMfa(u)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              u.mfa_enabled ? 'bg-primary' : 'bg-slate-200'
            } ${isSelf || mfaLoadingId === u.id ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={u.mfa_enabled ? 'MFA enabled' : 'MFA disabled'}
          >
            {mfaLoadingId === u.id ? (
              <Icons.spinner className="size-3 text-white animate-spin" />
            ) : (
              <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                u.mfa_enabled ? 'translate-x-4' : 'translate-x-0'
              }`} />
            )}
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      render: (u: UserProfile) => {
        const isSelf = u.id === currentUser?.id;
        const canAct = canActOn(u);
        const isSuspended = !!u.suspended_at;
        const isLocked = !!u.locked_until && new Date(u.locked_until) > new Date();

        if (isSelf) return <span className="text-[10px] text-slate-300 font-medium">You</span>;

        const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [];

        menuItems.push({
          label: 'Edit', icon: <Icons.pencil className="size-3.5" />,
          onClick: () => openAction(u, 'edit'),
        });

        if (isLocked) {
          menuItems.push({
            label: 'Unlock Account', icon: <Icons.lock className="size-3.5" />,
            disabled: !canAct, onClick: () => openAction(u, 'unlock'),
          });
        } else {
          menuItems.push({
            label: isSuspended ? 'Reactivate' : 'Suspend',
            icon: isSuspended ? <Icons.checkCircle2 className="size-3.5" /> : <Icons.lock className="size-3.5" />,
            danger: !isSuspended, disabled: !canAct,
            onClick: () => openAction(u, isSuspended ? 'reactivate' : 'suspend'),
          });
        }

        return <RowMenu items={menuItems} />;
      },
    },
  ];

  const inviteColumns = [
    {
      key: 'email', header: 'Email',
      render: (inv: PendingInvite) => (
        <span className="text-sm text-slate-700">{inv.email ?? <span className="text-slate-400 italic">Open invite</span>}</span>
      ),
    },
    {
      key: 'org', header: 'Organisation',
      render: (inv: PendingInvite) => (
        <span className="text-sm text-slate-500">{inv.companies?.name ?? <span className="text-slate-400">—</span>}</span>
      ),
    },
    {
      key: 'role', header: 'Role',
      render: (inv: PendingInvite) => (
        <span className="text-xs font-medium text-slate-500">{inv.membership_role ?? '—'}</span>
      ),
    },
    {
      key: 'expires', header: 'Expires',
      render: (inv: PendingInvite) => (
        <span className="text-sm text-slate-500">
          {new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions', header: '', className: 'w-10 text-right',
      render: (inv: PendingInvite) => (
        <RowMenu items={[
          { label: 'Copy link', icon: <Icons.copy className="size-3.5" />, onClick: () => navigator.clipboard.writeText(`${window.location.origin}/signup?token=${inv.token}`) },
          { label: 'Revoke', icon: <Icons.trash className="size-3.5" />, danger: true, onClick: () => setConfirmRevokeInvite(inv) },
        ]} />
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  const isEdit = drawerAction === 'edit';
  const selectClass = "h-9 px-3 pr-8 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors appearance-none cursor-pointer";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">User Management</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage platform users and invitations.</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" className="h-9 px-4 rounded-xl" onClick={openInvitesDrawer}>
            <Icons.mail className="size-4 mr-2" />
            Pending Invites
          </Button>
          <Button className="h-9 px-4 rounded-xl" onClick={() => setProvisionOpen(true)}>
            <Icons.plus className="size-4 mr-2" />
            Provision User
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {loading && users.length === 0 ? (
        <KpiBarSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.totalUsers} icon={Icons.shieldCheck} />
          <StatCard label="Active" value={stats.totalActive} icon={Icons.checkCircle2} valueClassName="text-green-700" />
          <StatCard label="Suspended" value={stats.totalSuspended} icon={Icons.lock} valueClassName="text-red-600" />
          <StatCard label="Locked" value={stats.totalLocked} icon={Icons.alertTriangle} valueClassName="text-amber-600" />
        </div>
      )}

      {/* Search + Filters */}
      <div className="dash-card">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full h-9 pl-10 pr-4 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <Icons.close className="size-3.5" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectClass}>
            <option value="all">All Org Types</option>
            {orgTypes.map(r => <option key={r} value={r}>{ORG_TYPE_LABELS[r] ?? r}</option>)}
          </select>

          <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className={cn(selectClass, 'max-w-[200px]')}>
            <option value="all">All Organisations</option>
            {orgNames.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <div className="h-6 w-px bg-slate-200" />

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {(typeFilter !== 'all' || orgFilter !== 'all') && (
            <>
              <div className="h-6 w-px bg-slate-200" />
              <button
                onClick={() => { setTypeFilter('all'); setOrgFilter('all'); }}
                className="h-7 px-2.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">All Users</h3>
          <span className="text-xs text-slate-400">{loading ? '—' : `${total} total`}</span>
        </div>
        {loading && users.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Organisation</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">MFA</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg shrink-0" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-36" /></div></div></td>
                      <td className="px-4 py-3"><div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-2.5 w-16" /></div></td>
                      <td className="px-4 py-3"><Skeleton className="h-3.5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-9 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="size-7 rounded-lg ml-auto" /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                    {userColumns.map(col => (
                      <th key={col.key} className={cn('px-4 py-3', (col as any).className)}>{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={userColumns.length} className="px-4 py-12 text-center">
                        <Icons.database className="size-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-400">No users found</p>
                        <p className="text-xs text-slate-400">Try a different filter</p>
                      </td>
                    </tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      {userColumns.map(col => (
                        <td key={col.key} className={cn('px-4 py-3', (col as any).className)}>
                          {col.render(u)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Action drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        open={!!actionUser && !!drawerAction}
        onClose={closeActionDrawer}
        title={
          isEdit ? 'Edit User'
          : drawerAction === 'unlock' ? 'Unlock Account'
          : drawerAction === 'suspend' ? 'Suspend User'
          : 'Reactivate User'
        }
        description={
          isEdit ? 'Update user profile information.'
          : drawerAction === 'unlock' ? 'This will immediately restore access.'
          : drawerAction === 'suspend' ? 'Suspended users cannot log in or access the platform.'
          : 'The user will regain full platform access.'
        }
        size={isEdit ? 'md' : 'sm'}
      >
        {actionUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="size-9 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                {(actionUser.full_name || actionUser.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{actionUser.full_name || '—'}</p>
                <p className="text-xs text-slate-400 truncate">{actionUser.email}</p>
              </div>
            </div>

            {isEdit && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Full Name</Label>
                  <Input value={editForm.full_name} onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))} className="h-10 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Job Title</Label>
                  <Input value={editForm.job_title} onChange={e => setEditForm(prev => ({ ...prev, job_title: e.target.value }))} className="h-10 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Phone</Label>
                  <Input value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="h-10 rounded-xl border-slate-200" />
                </div>
                <Button className="w-full h-11 rounded-xl font-bold" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <Icons.spinner className="size-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </div>
            )}

            {drawerAction === 'unlock' && actionUser.locked_until && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
                <p className="font-semibold mb-1">Account locked until:</p>
                <p>{new Date(actionUser.locked_until).toLocaleString()}</p>
                {actionUser.lock_reason && <p className="mt-1 text-amber-600">{actionUser.lock_reason}</p>}
              </div>
            )}

            {drawerAction === 'suspend' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Reason <span className="text-slate-400 font-normal">(optional)</span></Label>
                <textarea
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  placeholder="Briefly describe why this account is being suspended…"
                  className="w-full h-24 px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            )}

            {!isEdit && (
              <Button
                variant={drawerAction === 'suspend' ? 'danger' : 'default'}
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => setConfirmAction(true)}
              >
                {drawerAction === 'unlock' ? 'Unlock Account' : drawerAction === 'suspend' ? 'Suspend Account' : 'Reactivate Account'}
              </Button>
            )}
          </div>
        )}
      </Drawer>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmAction}
        onClose={() => setConfirmAction(false)}
        onConfirm={handleExecuteAction}
        title={
          drawerAction === 'unlock' ? 'Confirm Unlock'
          : drawerAction === 'suspend' ? 'Confirm Suspension'
          : 'Confirm Reactivation'
        }
        description={
          drawerAction === 'unlock'
            ? `Unlock ${actionUser?.full_name || actionUser?.email}? They will be able to log in immediately.`
            : drawerAction === 'suspend'
            ? `Suspend ${actionUser?.full_name || actionUser?.email}? They will immediately lose access to the platform.`
            : `Reactivate ${actionUser?.full_name || actionUser?.email}? They will regain full platform access.`
        }
        confirmLabel={drawerAction === 'unlock' ? 'Unlock' : drawerAction === 'suspend' ? 'Suspend' : 'Reactivate'}
        confirmVariant={drawerAction === 'suspend' ? 'danger' : 'default'}
        loading={suspending}
      />

      {/* Pending Invites drawer */}
      <Drawer
        open={invitesDrawerOpen}
        onClose={() => setInvitesDrawerOpen(false)}
        title="Pending Invites"
        description="Send and manage invitations."
        size="lg"
      >
        <div className="space-y-5">
          <form onSubmit={handleSendInvite} className="flex gap-3">
            <div className="relative flex-1">
              <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                type="email" placeholder="user@company.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10 h-10 rounded-xl border-slate-200"
              />
            </div>
            <div className="flex gap-1.5 shrink-0">
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d} type="button" onClick={() => setExpiresInDays(d)}
                  className={cn(
                    'px-2.5 h-10 rounded-xl text-xs font-bold border transition-all',
                    expiresInDays === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button type="submit" disabled={inviting} className="h-10 px-4 rounded-xl shrink-0">
              {inviting ? <Icons.spinner className="size-4 animate-spin" /> : 'Send'}
            </Button>
          </form>

          {invitesLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <Skeleton className="h-3.5 w-44 flex-1" />
                  <Skeleton className="h-3.5 w-14" />
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="size-7 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                    {inviteColumns.map(col => (
                      <th key={col.key} className={cn('px-4 py-3', (col as any).className)}>{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={inviteColumns.length} className="px-4 py-12 text-center">
                        <Icons.database className="size-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-400">No pending invites</p>
                        <p className="text-xs text-slate-400">All invites have been accepted or expired.</p>
                      </td>
                    </tr>
                  ) : invites.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      {inviteColumns.map(col => (
                        <td key={col.key} className={cn('px-4 py-3', (col as any).className)}>
                          {col.render(inv)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Drawer>

      {/* Confirm revoke invite */}
      <ConfirmDialog
        open={!!confirmRevokeInvite}
        onClose={() => setConfirmRevokeInvite(null)}
        onConfirm={handleRevokeInvite}
        title="Revoke Invite"
        description={`Revoke the invite${confirmRevokeInvite?.email ? ` for ${confirmRevokeInvite.email}` : ''}? The signup link will stop working immediately.`}
        confirmLabel="Revoke"
        confirmVariant="danger"
        loading={revoking}
      />

      {/* Provision User drawer */}
      <Drawer
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        title="Provision User"
        description="Create a new user account with optional organisation."
        size="md"
      >
        <form onSubmit={handleProvision} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Email</Label>
            <Input
              type="email" required value={provForm.email}
              onChange={e => setProvForm(prev => ({ ...prev, email: e.target.value }))}
              className="h-10 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Full Name <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              value={provForm.fullName}
              onChange={e => setProvForm(prev => ({ ...prev, fullName: e.target.value }))}
              className="h-10 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Organisation <span className="text-slate-400 font-normal">(optional)</span></Label>
            <select
              value={provForm.companyId}
              onChange={e => setProvForm(prev => ({ ...prev, companyId: e.target.value }))}
              className={cn(selectClass, 'w-full h-10')}
            >
              <option value="">No organisation</option>
              {orgNames.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Membership Role</Label>
            <select
              value={provForm.role}
              onChange={e => setProvForm(prev => ({ ...prev, role: e.target.value }))}
              className={cn(selectClass, 'w-full h-10')}
            >
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
            </select>
          </div>
          <Button type="submit" disabled={provisioning} className="w-full h-11 rounded-xl font-bold">
            {provisioning ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
            Provision User
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
