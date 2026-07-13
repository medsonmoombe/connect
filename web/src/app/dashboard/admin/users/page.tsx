'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactDOM from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DataTable, Column } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAdminSuspendUser } from '@/hooks/queries';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  suspended_at: string | null;
  created_at: string;
  company_members: { role: string; companies: { name: string; primary_role: string; is_platform_org?: boolean } | null }[];
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

type DrawerAction = 'suspend' | 'reactivate' | null;

// ── Three-dot menu (portal-based so it renders above overflow containers) ────

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

function StatusBadge({ suspended }: { suspended: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
      suspended
        ? 'bg-red-50 text-red-600 border border-red-100'
        : 'bg-green-50 text-green-700 border border-green-100'
    )}>
      {suspended ? 'Suspended' : 'Active'}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Invites
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesDrawerOpen, setInvitesDrawerOpen] = useState(false);
  const [confirmRevokeInvite, setConfirmRevokeInvite] = useState<PendingInvite | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Invite form
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Action drawer
  const [actionUser, setActionUser] = useState<UserProfile | null>(null);
  const [drawerAction, setDrawerAction] = useState<DrawerAction>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(false);

  const { mutateAsync: suspendUser, isPending: suspending } = useAdminSuspendUser();

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const d = await res.json();
      setUsers(d.data ?? []);
    } finally {
      setUsersLoading(false);
    }
  }, []);

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
    // Cannot act on yourself
    if (u.id === currentUser.id) return false;
    const membership = u.company_members?.[0];
    const isPlatformOrg = membership?.companies?.is_platform_org === true;
    const role = membership?.role;
    // Cannot act on root admin (platform org ADMIN) or OWNER
    if (isPlatformOrg && role === 'ADMIN') return false;
    if (role === 'OWNER') return false;
    return true;
  };

  // ── Open action drawer ──────────────────────────────────────────────────────
  const openAction = (u: UserProfile, action: DrawerAction) => {
    setActionUser(u);
    setDrawerAction(action);
    setSuspendReason('');
    setConfirmAction(false);
  };

  const closeActionDrawer = () => {
    setActionUser(null);
    setDrawerAction(null);
    setSuspendReason('');
    setConfirmAction(false);
  };

  // ── Execute suspend / reactivate ────────────────────────────────────────────
  const handleExecuteAction = async () => {
    if (!actionUser || !drawerAction) return;
    await suspendUser(actionUser.id, drawerAction, drawerAction === 'suspend' ? suspendReason || undefined : undefined);
    setUsers(prev => prev.map(u =>
      u.id === actionUser.id
        ? { ...u, suspended_at: drawerAction === 'suspend' ? new Date().toISOString() : null }
        : u
    ));
    setConfirmAction(false);
    closeActionDrawer();
  };

  // ── Send invite ─────────────────────────────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined, expiresInDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg({ type: 'error', text: data.error?.message || data.error || 'Failed to send invite.' });
      } else {
        setInviteMsg({ type: 'success', text: email ? `Invite sent to ${email}.` : 'Open invite link generated.' });
        setEmail('');
      }
    } finally {
      setInviting(false);
    }
  };

  // ── Revoke invite ───────────────────────────────────────────────────────────
  const handleRevokeInvite = async () => {
    if (!confirmRevokeInvite) return;
    setRevoking(true);
    try {
      await fetch(`/api/auth/invite/${confirmRevokeInvite.id}`, { method: 'DELETE' });
      setInvites(prev => prev.filter(i => i.id !== confirmRevokeInvite.id));
      setConfirmRevokeInvite(null);
    } finally {
      setRevoking(false);
    }
  };

  // ── User table columns ──────────────────────────────────────────────────────
  const userColumns: Column<UserProfile>[] = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
            {(u.full_name || u.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name || '—'}</p>
            <p className="text-xs text-slate-400 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'org',
      header: 'Organisation',
      render: (u) => {
        const m = u.company_members?.[0];
        return (
          <div>
            <p className="text-sm text-slate-700">{m?.companies?.name ?? <span className="text-slate-400">—</span>}</p>
            <p className="text-xs text-slate-400">{m?.role ?? '—'}</p>
          </div>
        );
      },
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (u) => (
        <span className="text-sm text-slate-500">
          {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge suspended={!!u.suspended_at} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      render: (u) => {
        const isSelf = u.id === currentUser?.id;
        const canAct = canActOn(u);
        const isSuspended = !!u.suspended_at;

        if (isSelf) {
          return <span className="text-[10px] text-slate-300 font-medium">You</span>;
        }

        return (
          <RowMenu
            items={[
              {
                label: isSuspended ? 'Reactivate' : 'Suspend',
                icon: isSuspended
                  ? <Icons.checkCircle2 className="size-3.5" />
                  : <Icons.lock className="size-3.5" />,
                danger: !isSuspended,
                disabled: !canAct,
                onClick: () => openAction(u, isSuspended ? 'reactivate' : 'suspend'),
              },
            ]}
          />
        );
      },
    },
  ];

  // ── Invite table columns ────────────────────────────────────────────────────
  const inviteColumns: Column<PendingInvite>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (inv) => (
        <span className="text-sm text-slate-700">{inv.email ?? <span className="text-slate-400 italic">Open invite</span>}</span>
      ),
    },
    {
      key: 'org',
      header: 'Organisation',
      render: (inv) => (
        <span className="text-sm text-slate-500">{inv.companies?.name ?? <span className="text-slate-400">—</span>}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (inv) => (
        <span className="text-xs font-medium text-slate-500">{inv.membership_role ?? '—'}</span>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (inv) => (
        <span className="text-sm text-slate-500">
          {new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      render: (inv) => (
        <RowMenu
          items={[
            {
              label: 'Copy link',
              icon: <Icons.copy className="size-3.5" />,
              onClick: () => navigator.clipboard.writeText(`${window.location.origin}/signup?token=${inv.token}`),
            },
            {
              label: 'Revoke',
              icon: <Icons.trash className="size-3.5" />,
              danger: true,
              onClick: () => setConfirmRevokeInvite(inv),
            },
          ]}
        />
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Users</h2>
          <p className="text-slate-500 mt-1 text-sm">Manage platform users and invitations.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl font-semibold border-slate-200 shrink-0"
          onClick={openInvitesDrawer}
        >
          <Icons.mail className="size-4 mr-2" />
          Pending Invites
        </Button>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Send Invite</h3>
          <p className="text-xs text-slate-400 mt-0.5">Leave email blank to generate a generic link.</p>
        </div>
        <form onSubmit={handleSendInvite} className="p-6 space-y-5">
          {inviteMsg && (
            <p className={cn('text-sm font-medium', inviteMsg.type === 'success' ? 'text-green-700' : 'text-red-600')}>
              {inviteMsg.text}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10 h-11 rounded-xl border-slate-200"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiresInDays(d)}
                  className={cn(
                    'px-3 h-11 rounded-xl text-xs font-bold border transition-all',
                    expiresInDays === d
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button type="submit" disabled={inviting} className="h-11 px-6 rounded-xl shrink-0">
              {inviting ? <Icons.spinner className="size-4 animate-spin" /> : email ? 'Send Invite' : 'Generate Link'}
            </Button>
          </div>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">All Users</h3>
          <span className="text-xs text-slate-400">{users.length} total</span>
        </div>
        <DataTable
          columns={userColumns}
          data={users}
          loading={usersLoading}
          rowKey={u => u.id}
          emptyTitle="No users found"
        />
      </div>

      {/* ── Action drawer (suspend / reactivate) ─────────────────────────────── */}
      <Drawer
        open={!!actionUser && !!drawerAction}
        onClose={closeActionDrawer}
        title={drawerAction === 'suspend' ? 'Suspend User' : 'Reactivate User'}
        description={
          drawerAction === 'suspend'
            ? 'Suspended users cannot log in or access the platform.'
            : 'The user will regain full platform access.'
        }
        size="sm"
      >
        {actionUser && (
          <div className="space-y-5">
            {/* User summary */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="size-9 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                {(actionUser.full_name || actionUser.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{actionUser.full_name || '—'}</p>
                <p className="text-xs text-slate-400 truncate">{actionUser.email}</p>
              </div>
            </div>

            {/* Reason (suspend only) */}
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

            <Button
              variant={drawerAction === 'suspend' ? 'danger' : 'default'}
              className="w-full h-11 rounded-xl font-bold"
              onClick={() => setConfirmAction(true)}
            >
              {drawerAction === 'suspend' ? 'Suspend Account' : 'Reactivate Account'}
            </Button>
          </div>
        )}
      </Drawer>

      {/* Confirm suspend / reactivate */}
      <ConfirmDialog
        open={confirmAction}
        onClose={() => setConfirmAction(false)}
        onConfirm={handleExecuteAction}
        title={drawerAction === 'suspend' ? 'Confirm Suspension' : 'Confirm Reactivation'}
        description={
          drawerAction === 'suspend'
            ? `Suspend ${actionUser?.full_name || actionUser?.email}? They will immediately lose access to the platform.`
            : `Reactivate ${actionUser?.full_name || actionUser?.email}? They will regain full platform access.`
        }
        confirmLabel={drawerAction === 'suspend' ? 'Suspend' : 'Reactivate'}
        confirmVariant={drawerAction === 'suspend' ? 'danger' : 'default'}
        loading={suspending}
      />

      {/* ── Pending Invites drawer ────────────────────────────────────────────── */}
      <Drawer
        open={invitesDrawerOpen}
        onClose={() => setInvitesDrawerOpen(false)}
        title="Pending Invites"
        description="Invites that have been sent but not yet accepted."
        size="lg"
      >
        <DataTable
          columns={inviteColumns}
          data={invites}
          loading={invitesLoading}
          rowKey={inv => inv.id}
          emptyTitle="No pending invites"
          emptyDescription="All invites have been accepted or have expired."
        />
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
    </div>
  );
}
