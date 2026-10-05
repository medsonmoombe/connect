'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactDOM from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTeam, OrgMember } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/ui/icons';
import { DataTable, Column } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TeamTableSkeleton, InviteTableSkeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type DrawerAction = 'role' | 'edit' | null;

interface PendingInvite {
  id: string;
  email: string | null;
  token: string;
  expires_at: string;
  created_at: string;
  membership_role: string | null;
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<MemberRole, string> = {
  OWNER:  'bg-green-50 text-green-700 border-green-200',
  ADMIN:  'bg-blue-50 text-blue-700 border-blue-200',
  MEMBER: 'bg-slate-50 text-slate-600 border-slate-200',
};

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border', ROLE_COLORS[role])}>
      {role}
    </span>
  );
}

// ── Three-dot menu ────────────────────────────────────────────────────────────

function RowMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; origin: string }>({ top: 0, right: 0, origin: 'top' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
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
      setPos({ top: openUp ? rect.top - MENU_HEIGHT : rect.bottom + 4, right: window.innerWidth - rect.right, origin: openUp ? 'bottom' : 'top' });
    }
    setOpen(v => !v);
  };

  return (
    <>
      <button ref={triggerRef} onClick={toggle} className="p-1.5 rounded-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <Icons.moreVertical className="size-4" />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, transformOrigin: pos.origin }}
          className="w-44 bg-white border border-slate-200 rounded-none shadow-lg py-1 animate-in fade-in duration-150">
          {items.map((item, i) => (
            <button key={i} disabled={item.disabled} onClick={() => { setOpen(false); item.onClick(); }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                item.disabled ? 'text-slate-300 cursor-not-allowed' : item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50')}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { user } = useAuth();
  const { data: rawMembers, isLoading, refetch } = useOrgTeam();
  const members = rawMembers.filter(m => m.user_profiles && !m.is_invite);

  const isOwner = user?.org_member_role === 'OWNER';
  const isOrgAdmin = user?.is_org_admin ?? false;
  const userRole = user?.role;
  // Platform-side roles (regulator, platform admins) manage users in the admin portal instead
  const showInvitePowers = isOrgAdmin && !['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'AUTHORITY_REVIEWER', 'AUTHORITY_VIEWER'].includes(userRole ?? '');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pending invites
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<PendingInvite | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Member action drawer
  const [actionMember, setActionMember] = useState<OrgMember | null>(null);
  const [drawerAction, setDrawerAction] = useState<DrawerAction>(null);
  const [newRole, setNewRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [actionPending, setActionPending] = useState(false);

  // Confirm dialogs
  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [confirmRole, setConfirmRole] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<OrgMember | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<OrgMember | null>(null);

  // Edit profile form
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', job_title: '', email_verified: false });
  const [editSaving, setEditSaving] = useState(false);

  // ── RBAC ──
  const canActOn = (m: OrgMember): boolean => {
    if (!isOrgAdmin) return false;
    if (m.user_id === user?.id) return false;
    if (m.role === 'OWNER') return false;
    return true;
  };

  // ── Fetch pending invites ──
  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    try { const res = await fetch('/api/org/team/invites'); const d = await res.json(); setPendingInvites(d.data ?? []); }
    finally { setInvitesLoading(false); }
  }, []);

  const openInvitesDrawer = () => { setInvitesOpen(true); fetchInvites(); };

  // ── Send invite ──
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg(null);
    try {
      const res = await fetch('/api/org/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, membershipRole: inviteRole }) });
      const data = await res.json();
      if (!res.ok) { setInviteMsg({ type: 'error', text: data.error || 'Failed.' }); toast.error(data.error || 'Failed'); }
      else { setInviteMsg({ type: 'success', text: `Invite sent to ${inviteEmail}.` }); toast.success(`Invite sent to ${inviteEmail}`); setInviteEmail(''); refetch(); }
    } finally { setInviting(false); }
  };

  const handleCancelInvite = async () => {
    if (!confirmCancelInvite) return;
    setCancellingInvite(true);
    try { await fetch(`/api/org/team/invites/${confirmCancelInvite.id}`, { method: 'DELETE' }); setPendingInvites(prev => prev.filter(i => i.id !== confirmCancelInvite.id)); toast.success('Invite cancelled'); setConfirmCancelInvite(null); }
    finally { setCancellingInvite(false); }
  };

  const handleResendInvite = async (inv: PendingInvite) => {
    setResendingId(inv.id);
    try {
      const res = await fetch(`/api/org/team/invites/${inv.id}`, { method: 'POST' });
      if (res.ok) { const data = await res.json(); setPendingInvites(prev => prev.map(i => i.id === inv.id ? { ...i, expires_at: data.expires_at } : i)); toast.success('Invite resent'); }
      else toast.error('Failed to resend');
    } finally { setResendingId(null); }
  };

  const openAction = (m: OrgMember, action: DrawerAction) => {
    setActionMember(m); setDrawerAction(action);
    if (action === 'role') setNewRole(m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN');
  };

  const closeDrawer = () => { setActionMember(null); setDrawerAction(null); setConfirmRole(false); setEditForm({ full_name: '', phone: '', job_title: '', email_verified: false }); };

  const handleRoleChange = async () => {
    if (!actionMember) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${actionMember.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }) }); toast.success(`${actionMember.user_profiles?.full_name || 'Member'} ${newRole === 'ADMIN' ? 'promoted' : 'demoted'}`); refetch(); setConfirmRole(false); closeDrawer(); }
    finally { setActionPending(false); }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${confirmRemove.user_id}`, { method: 'DELETE' }); toast.success(`${confirmRemove.user_profiles?.full_name || 'Member'} removed`); setConfirmRemove(null); closeDrawer(); refetch(); }
    finally { setActionPending(false); }
  };

  const openEditDrawer = (m: OrgMember) => {
    setActionMember(m); setDrawerAction('edit');
    setEditForm({ full_name: m.user_profiles?.full_name ?? '', phone: m.user_profiles?.phone ?? '', job_title: m.user_profiles?.job_title ?? '', email_verified: !!m.user_profiles?.email_verified_at });
  };

  const handleSaveProfile = async () => {
    if (!actionMember || !editForm.full_name.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/org/team/${actionMember.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_profile', full_name: editForm.full_name, phone: editForm.phone || null, job_title: editForm.job_title || null, email_verified: editForm.email_verified }) });
      if (res.ok) { toast.success('Profile updated'); refetch(); } else { const d = await res.json(); toast.error(d.error || 'Failed'); }
      closeDrawer();
    } finally { setEditSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${confirmDeactivate.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'suspend' }) }); toast.success(`${confirmDeactivate.user_profiles?.full_name || 'Member'} deactivated`); refetch(); setConfirmDeactivate(null); }
    finally { setActionPending(false); }
  };

  const handleReactivate = async () => {
    if (!confirmReactivate) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${confirmReactivate.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reactivate' }) }); toast.success(`${confirmReactivate.user_profiles?.full_name || 'Member'} reactivated`); refetch(); setConfirmReactivate(null); }
    finally { setActionPending(false); }
  };

  // ── Member table columns ──
  const memberColumns: Column<OrgMember>[] = [
    {
      key: 'member', header: 'Member',
      render: (m) => {
        const profile = m.user_profiles;
        const isSelf = m.user_id === user?.id;
        return (
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-none bg-[#0b3b24] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {profile?.full_name || '—'}
                {isSelf && <span className="text-slate-400 font-normal ml-1 text-xs">(you)</span>}
              </p>
              <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'role', header: 'Role', render: (m) => <RoleBadge role={m.role} /> },
    {
      key: 'status', header: 'Status',
      render: (m) => {
        const suspended = !!m.user_profiles?.suspended_at;
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border', suspended ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200')}>
            {suspended ? 'Suspended' : 'Active'}
          </span>
        );
      },
    },
    {
      key: 'joined', header: 'Joined',
      render: (m) => <span className="text-xs font-medium text-slate-500">{m.user_profiles?.created_at ? new Date(m.user_profiles.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>,
    },
    {
      key: 'actions', header: '', className: 'w-10 text-right',
      render: (m) => {
        const isSelf = m.user_id === user?.id;
        if (isSelf) return <span className="text-[10px] text-slate-300 font-medium">You</span>;
        if (!canActOn(m)) return null;
        const suspended = !!m.user_profiles?.suspended_at;
        return (
          <RowMenu items={[
            { label: 'Edit profile', icon: <Icons.user className="size-3.5" />, onClick: () => openEditDrawer(m) },
            ...(isOwner ? [{ label: m.role === 'ADMIN' ? 'Demote to Member' : 'Promote to Admin', icon: <Icons.shieldCheck className="size-3.5" />, onClick: () => openAction(m, 'role') }] : []),
            { label: suspended ? 'Activate' : 'Deactivate', icon: suspended ? <Icons.check className="size-3.5" /> : <Icons.alertTriangle className="size-3.5" />, danger: !suspended, onClick: () => suspended ? setConfirmReactivate(m) : setConfirmDeactivate(m) },
            { label: 'Remove from team', icon: <Icons.trash className="size-3.5" />, danger: true, onClick: () => { setActionMember(m); setConfirmRemove(m); } },
          ]} />
        );
      },
    },
  ];

  const inviteColumns: Column<PendingInvite>[] = [
    { key: 'email', header: 'Email', render: (inv) => <span className="text-sm text-slate-700">{inv.email ?? <span className="italic text-slate-400">Open invite</span>}</span> },
    { key: 'role', header: 'Role', render: (inv) => <span className="text-xs font-medium text-slate-500 uppercase">{inv.membership_role ?? '—'}</span> },
    { key: 'expires', header: 'Expires', render: (inv) => <span className="text-sm text-slate-500">{new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span> },
    {
      key: 'actions', header: '', className: 'w-10 text-right',
      render: (inv) => (
        <RowMenu items={[
          { label: 'Resend invite', icon: resendingId === inv.id ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.refreshCw className="size-3.5" />, onClick: () => handleResendInvite(inv), disabled: resendingId === inv.id },
          { label: 'Copy link', icon: <Icons.copy className="size-3.5" />, onClick: () => navigator.clipboard.writeText(`${window.location.origin}/signup?token=${inv.token}`) },
          { label: 'Cancel invite', icon: <Icons.x className="size-3.5" />, danger: true, onClick: () => setConfirmCancelInvite(inv) },
        ]} />
      ),
    },
  ];

  if (isLoading && members.length === 0) {
    return <div className="flex h-64 items-center justify-center"><Icons.spinner className="size-5 animate-spin text-[#0b3b24]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="bg-[#0b3b24] px-6 py-6 relative overflow-hidden flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/settings?tab=profile" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200/50 hover:text-emerald-200 uppercase tracking-widest transition-colors mb-2">
              <Icons.arrowLeft className="size-3" />
              Settings
            </Link>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Team Management</p>
            <h1 className="text-xl font-bold text-white tracking-tight">Team Members</h1>
            <p className="text-[11px] text-emerald-200/60 mt-1">
              {isOrgAdmin ? `${members.length} member${members.length !== 1 ? 's' : ''} · Manage roles, invite colleagues, and control access` : `${members.length} member${members.length !== 1 ? 's' : ''} in your organisation`}
            </p>
          </div>
          {showInvitePowers && (
            <Button variant="outline" className="h-9 px-4 rounded-none bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-bold tracking-wider" onClick={openInvitesDrawer} icon={<Icons.mail className="size-3.5" />}>
              Pending Invites
            </Button>
          )}
        </div>
      </div>

      {/* ── Invite Form ── */}
      {showInvitePowers && (
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Invite</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Invite a Team Member</h3>
          </div>
          <form onSubmit={handleInvite} className="p-5 space-y-4">
            {inviteMsg && (
              <p className={cn('text-sm font-medium', inviteMsg.type === 'success' ? 'text-green-700' : 'text-red-600')}>{inviteMsg.text}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className="pl-10 h-10 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]" required />
              </div>
              {isOwner && (
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'MEMBER' | 'ADMIN')}
                  className="h-10 px-3 rounded-none border border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]">
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              )}
              <Button type="submit" disabled={inviting} className="h-10 px-5 rounded-none bg-[#0b3b24] hover:bg-[#0d4a2e] text-white text-[11px] font-bold tracking-wider shrink-0">
                {inviting ? <Icons.spinner className="size-4 animate-spin" /> : <><Icons.plus className="size-4 mr-2" />Send Invite</>}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Members Table ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Team</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Team Members</h3>
          </div>
          <span className="text-[11px] font-semibold text-ink-3">{members.length} total</span>
        </div>
        {isLoading ? (
          <TeamTableSkeleton rows={5} />
        ) : (
          <DataTable columns={memberColumns} data={members} rowKey={m => m.user_id} emptyTitle="No team members yet" />
        )}
      </div>

      {/* ── Drawers & Confirm Dialogs (same as before) ── */}
      <Drawer open={drawerAction === 'role' && !!actionMember} onClose={closeDrawer} title={newRole === 'ADMIN' ? 'Promote to Admin' : 'Demote to Member'} description={newRole === 'ADMIN' ? 'Admins can invite members and edit the company profile.' : 'This member will lose admin privileges.'} size="sm">
        {actionMember && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-none border border-slate-200">
              <div className="size-9 rounded-none bg-[#0b3b24] flex items-center justify-center text-xs font-bold text-white shrink-0">{(actionMember.user_profiles?.full_name || actionMember.user_profiles?.email || 'U').slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{actionMember.user_profiles?.full_name || '—'}</p><p className="text-xs text-slate-400 truncate">{actionMember.user_profiles?.email}</p></div>
              <RoleBadge role={actionMember.role} />
            </div>
            <p className="text-sm text-slate-600">{newRole === 'ADMIN' ? `${actionMember.user_profiles?.full_name || 'This member'} will be promoted to Admin.` : `${actionMember.user_profiles?.full_name || 'This member'} will be demoted to Member.`}</p>
            <Button className="w-full h-10 rounded-none bg-[#0b3b24] hover:bg-[#0d4a2e]" onClick={() => setConfirmRole(true)}>{newRole === 'ADMIN' ? 'Promote to Admin' : 'Demote to Member'}</Button>
          </div>
        )}
      </Drawer>

      <Drawer open={drawerAction === 'edit' && !!actionMember} onClose={closeDrawer} title="Edit Member Profile" description="Update this member's information." size="lg">
        {actionMember && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-none border border-slate-200">
              <div className="size-9 rounded-none bg-[#0b3b24] flex items-center justify-center text-xs font-bold text-white shrink-0">{(actionMember.user_profiles?.full_name || actionMember.user_profiles?.email || 'U').slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 truncate">{actionMember.user_profiles?.full_name || '—'}</p><p className="text-xs text-slate-400 truncate">{actionMember.user_profiles?.email}</p></div>
              <RoleBadge role={actionMember.role} />
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name <span className="text-red-400">*</span></Label><Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="h-10 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</Label><Input value={actionMember.user_profiles?.email ?? ''} disabled className="h-10 rounded-none border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="h-10 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]" type="tel" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Job Title</Label><Input value={editForm.job_title} onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))} className="h-10 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]" /></div>
            <Button className="w-full h-10 rounded-none bg-[#0b3b24] hover:bg-[#0d4a2e]" disabled={editSaving || !editForm.full_name.trim()} onClick={handleSaveProfile}>
              {editSaving ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.check className="size-4 mr-2" />}Save Changes
            </Button>
          </div>
        )}
      </Drawer>

      <Drawer open={invitesOpen} onClose={() => setInvitesOpen(false)} title="Pending Invites" description="Invites sent but not yet accepted." size="lg">
        {invitesLoading ? <InviteTableSkeleton rows={4} /> : <DataTable columns={inviteColumns} data={pendingInvites} rowKey={inv => inv.id} emptyTitle="No pending invites" emptyDescription="All invites have been accepted or expired." />}
      </Drawer>

      <ConfirmDialog open={confirmRole} onClose={() => setConfirmRole(false)} onConfirm={handleRoleChange} title={newRole === 'ADMIN' ? 'Promote to Admin' : 'Demote to Member'} description={newRole === 'ADMIN' ? `Promote ${actionMember?.user_profiles?.full_name || 'this member'}?` : `Demote ${actionMember?.user_profiles?.full_name || 'this member'}?`} confirmLabel={newRole === 'ADMIN' ? 'Promote' : 'Demote'} loading={actionPending} />
      <ConfirmDialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)} onConfirm={handleRemove} title="Remove Team Member" description={`Remove ${confirmRemove?.user_profiles?.full_name || 'this member'}? They will lose access immediately.`} confirmLabel="Remove" confirmVariant="danger" loading={actionPending} />
      <ConfirmDialog open={!!confirmCancelInvite} onClose={() => setConfirmCancelInvite(null)} onConfirm={handleCancelInvite} title="Cancel Invite" description={`Cancel the invite${confirmCancelInvite?.email ? ` for ${confirmCancelInvite.email}` : ''}?`} confirmLabel="Cancel Invite" confirmVariant="danger" loading={cancellingInvite} />
      <ConfirmDialog open={!!confirmDeactivate} onClose={() => setConfirmDeactivate(null)} onConfirm={handleDeactivate} title="Deactivate Member" description={`Deactivate ${confirmDeactivate?.user_profiles?.full_name || 'this member'}?`} confirmLabel="Deactivate" confirmVariant="danger" loading={actionPending} />
      <ConfirmDialog open={!!confirmReactivate} onClose={() => setConfirmReactivate(null)} onConfirm={handleReactivate} title="Activate Member" description={`Reactivate ${confirmReactivate?.user_profiles?.full_name || 'this member'}?`} confirmLabel="Activate" loading={actionPending} />
    </div>
  );
}
