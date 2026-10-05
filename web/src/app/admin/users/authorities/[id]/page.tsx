'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/ui/icons';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthorityMember {
  role: string;
  user_id: string;
  created_at: string;
  user_profiles: {
    id?: string;
    full_name: string;
    email: string;
    phone?: string | null;
    job_title?: string | null;
    mfa_enabled?: boolean;
    suspended_at?: string | null;
    created_at?: string;
  } | null;
}

interface AuthorityInvite {
  id: string;
  email: string | null;
  token: string;
  expires_at: string;
  created_at: string;
  membership_role: string | null;
}

interface OrgDetail {
  id: string;
  name: string;
  country: string | null;
  status: string;
  created_at: string;
  members: AuthorityMember[];
  invites: AuthorityInvite[];
}

type AddMode = 'invite' | 'provision';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthorityOrgDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-user
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('provision');
  const [addForm, setAddForm] = useState({ email: '', fullName: '', role: 'MEMBER' });
  const [adding, setAdding] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null);

  // Actions
  const [confirmRemove, setConfirmRemove] = useState<AuthorityMember | null>(null);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<AuthorityInvite | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<'activate' | 'deactivate' | null>(null);
  const [pending, setPending] = useState(false);

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/authority-orgs/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load organisation');
        return;
      }
      setOrg(data.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setAdding(true);
    try {
      if (addMode === 'invite') {
        const res = await fetch('/api/auth/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: addForm.email, expiresInDays: 7, companyId: org.id }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || 'Failed to send invite'); return; }
        toast.success(`Invite sent to ${addForm.email}`);
        setAddOpen(false);
        setAddForm({ email: '', fullName: '', role: 'MEMBER' });
        fetchOrg();
      } else {
        const res = await fetch(`/api/admin/authority-orgs/${org.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addForm),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to add user');
          return;
        }
        setNewCredentials({ email: data.data.user.email, password: data.data.user.generated_password });
        setAddForm({ email: '', fullName: '', role: 'MEMBER' });
        fetchOrg();
      }
    } finally {
      setAdding(false);
    }
  };

  const executeAction = async () => {
    setPending(true);
    try {
      if (confirmToggle) {
        const res = await fetch(`/api/admin/authority-orgs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: confirmToggle }),
        });
        const data = await res.json();
        if (!res.ok) toast.error(data.error || `Failed to ${confirmToggle}`);
        else { toast.success(data.message); fetchOrg(); }
        setConfirmToggle(null);
      }
      if (confirmCancelInvite) {
        const res = await fetch(`/api/auth/invite/${confirmCancelInvite.id}`, { method: 'DELETE' });
        if (!res.ok) toast.error('Failed to revoke invite');
        else { toast.success('Invite revoked'); fetchOrg(); }
        setConfirmCancelInvite(null);
      }
    } finally {
      setPending(false);
    }
  };

  const resendInvite = async (inv: AuthorityInvite) => {
    try {
      const res = await fetch(`/api/auth/invite/${inv.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || 'Failed to resend invite');
      else toast.success(data.message || `Invite resent to ${inv.email}`);
    } catch { toast.error('Failed to resend invite'); }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/signup?token=${token}`);
    toast.success('Signup link copied');
  };

  const suspendMember = async () => {
    if (!confirmRemove?.user_profiles) return;
    const isSuspended = !!confirmRemove.user_profiles.suspended_at;
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${confirmRemove.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isSuspended ? 'reactivate' : 'suspend' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Action failed'); return; }
      toast.success(isSuspended ? 'Account restored' : 'Account suspended');
      fetchOrg();
      setConfirmRemove(null);
    } finally {
      setPending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const deactivated = org?.status === 'deactivated';
  const activeMembers = (org?.members ?? []).filter(m => !!m.user_profiles && !m.user_profiles.suspended_at);
  const suspendedMembers = (org?.members ?? []).filter(m => !!m.user_profiles && m.user_profiles.suspended_at);
  const totalMembers = activeMembers.length + suspendedMembers.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Link href="/admin/users" className="mt-1 p-2 rounded-none hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <Icons.arrowLeft className="size-4" />
        </Link>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-72" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Regulator Organisations</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{org?.name}</h1>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
                deactivated ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
              )}>
                {deactivated ? 'Deactivated' : 'Active'}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {org?.country || '—'} · Created {org ? new Date(org.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            </p>
          </div>
        )}
        {!loading && (
          <div className="ml-auto flex gap-2.5 shrink-0">
            <Button
              variant="outline"
              className="h-9 px-4 rounded-none border-slate-200 text-sm font-semibold"
              onClick={() => setConfirmToggle(deactivated ? 'activate' : 'deactivate')}
            >
              {deactivated ? <Icons.checkCircle2 className="size-4 mr-2" /> : <Icons.lock className="size-4 mr-2" />}
              {deactivated ? 'Activate Org' : 'Deactivate Org'}
            </Button>
            <Button
              className="h-9 px-4 rounded-none bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-sm"
              onClick={() => { setNewCredentials(null); setAddOpen(true); }}
            >
              <Icons.plus className="size-4 mr-2" />
              Add User
            </Button>
          </div>
        )}
      </div>

      {/* ── KPI Tiles ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-slate-200 bg-white p-5">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5 hover:border-slate-300 hover:shadow-md transition-all">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Members</p>
            <p className="text-2xl font-bold text-slate-950 tracking-tight mt-1">{totalMembers}</p>
          </div>
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5 hover:border-slate-300 hover:shadow-md transition-all">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Invites</p>
            <p className="text-2xl font-bold text-slate-950 tracking-tight mt-1">{org?.invites.length ?? 0}</p>
          </div>
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5 hover:border-slate-300 hover:shadow-md transition-all">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suspended</p>
            <p className={cn('text-2xl font-bold tracking-tight mt-1', suspendedMembers.length > 0 ? 'text-red-600' : 'text-slate-950')}>{suspendedMembers.length}</p>
          </div>
        </div>
      )}

      {/* ── Members Table ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Team</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Members</h3>
          </div>
          <button onClick={fetchOrg} className="text-[10px] text-emerald-200/50 hover:text-emerald-200 font-bold uppercase tracking-widest transition-colors">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 text-ink-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] border-b border-line">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">MFA</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(org?.members ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="size-10 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-2">
                      <Icons.users className="size-5 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">No members yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">Use "Add User" to invite or provision the first member.</p>
                  </td>
                </tr>
              ) : org!.members.map(m => {
                const p = m.user_profiles;
                return (
                  <tr key={m.user_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-none bg-gradient-to-br from-[#0b3b24] to-emerald-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(p?.full_name || p?.email || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{p?.full_name || '—'}</p>
                          <p className="text-[11px] text-slate-400 font-medium truncate">{p?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={m.role === 'OWNER' ? 'green' : m.role === 'ADMIN' ? 'blue' : 'slate'}>{m.role}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {p?.mfa_enabled
                        ? <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">On</span>
                        : <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Off</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {p?.suspended_at ? <Badge variant="red">Suspended</Badge> : <Badge variant="green">Active</Badge>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setConfirmRemove(m)}
                        disabled={pending}
                        className={cn(
                          'p-1.5 rounded-none transition-colors',
                          m.user_profiles?.suspended_at
                            ? 'text-slate-400 hover:text-green-700 hover:bg-green-50'
                            : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                        )}
                        title={m.user_profiles?.suspended_at ? 'Restore account' : 'Suspend account'}
                      >
                        {m.user_profiles?.suspended_at ? <Icons.checkCircle2 className="size-3.5" /> : <Icons.lock className="size-3.5" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pending Invites ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Outreach</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Pending Invites</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {(org?.invites ?? []).length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="size-10 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-2">
                <Icons.mail className="size-5 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-400">No pending invites</p>
              <p className="text-xs text-slate-400 mt-0.5">All invites have been accepted or expired.</p>
            </div>
          ) : org!.invites.map(inv => (
            <div key={inv.id} className="px-5 py-3.5 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-bold text-slate-700">{inv.email ?? 'Open invite'}</p>
                <p className="text-[11px] text-slate-400 font-medium">Role: {inv.membership_role ?? '—'} · Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => copyLink(inv.token)} className="h-8 px-3 rounded-none border border-slate-200 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors inline-flex items-center gap-1.5">
                  <Icons.copy className="size-3.5" /> Copy link
                </button>
                {inv.email && (
                  <button onClick={() => resendInvite(inv)} className="h-8 px-3 rounded-none border border-slate-200 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors inline-flex items-center gap-1.5">
                    <Icons.refreshCw className="size-3.5" /> Resend
                  </button>
                )}
                <button onClick={() => setConfirmCancelInvite(inv)} className="h-8 px-3 rounded-none border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors inline-flex items-center gap-1.5">
                  <Icons.trash className="size-3.5" /> Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add User drawer ──────────────────────────────────────────────────── */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add User" description="Invite by email or provision an account with generated credentials." size="sm">
        {newCredentials ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200">
              <Icons.checkCircle2 className="size-5 text-green-700 shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-900">User provisioned successfully</p>
                <p className="text-xs text-green-700 mt-0.5 font-medium">{newCredentials.email}</p>
              </div>
            </div>
            <div className="border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Save these credentials — they will not be shown again</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-bold text-slate-900 select-all bg-white border border-slate-200 px-3 py-2 flex-1 break-all">{newCredentials.password}</p>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(newCredentials.password); toast.success('Password copied'); }} className="h-9 px-3 border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-colors text-xs font-bold">Copy</button>
                </div>
              </div>
            </div>
            <Button className="w-full h-11 rounded-none bg-brand hover:bg-brand-hover text-white font-bold" onClick={() => { setAddOpen(false); setNewCredentials(null); }}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleAddUser} className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {(['provision', 'invite'] as AddMode[]).map(mode => (
                <button key={mode} type="button" onClick={() => setAddMode(mode)}
                  className={cn(
                    'rounded-none border p-3 text-left transition-all',
                    addMode === mode ? 'border-green-700 bg-green-50 ring-1 ring-green-700/20' : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <p className={cn('text-xs font-bold', addMode === mode ? 'text-green-900' : 'text-slate-600')}>
                    {mode === 'provision' ? 'Provision Account' : 'Send Invite'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-4">
                    {mode === 'provision' ? 'Create account instantly with a generated password' : 'Email them a signup link'}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email</Label>
              <Input type="email" required value={addForm.email} onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))} placeholder="reviewer@authority.org" className="h-10 rounded-none border-slate-200" />
            </div>
            {addMode === 'provision' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Full Name <span className="text-slate-400 font-normal normal-case">(optional)</span></Label>
                <Input value={addForm.fullName} onChange={e => setAddForm(prev => ({ ...prev, fullName: e.target.value }))} className="h-10 rounded-none border-slate-200" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Role</Label>
              <select value={addForm.role} onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}
                className="w-full h-10 px-3 rounded-none border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors cursor-pointer">
                <option value="ADMIN">Admin (Regulator Admin)</option>
                <option value="MEMBER">Member (Regulator Reviewer)</option>
              </select>
            </div>
            <Button type="submit" disabled={adding} className="w-full h-11 rounded-none bg-brand hover:bg-brand-hover text-white font-bold">
              {adding ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
              {addMode === 'provision' ? 'Provision User' : 'Send Invite'}
            </Button>
          </form>
        )}
      </Drawer>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={executeAction}
        title={confirmToggle === 'deactivate' ? 'Deactivate Organisation' : 'Activate Organisation'}
        description={confirmToggle === 'deactivate'
          ? `Deactivate ${org?.name}? All member accounts will be suspended and unable to log in until reactivated.`
          : `Activate ${org?.name}? All member accounts will be restored.`}
        confirmLabel={confirmToggle === 'deactivate' ? 'Deactivate' : 'Activate'}
        confirmVariant={confirmToggle === 'deactivate' ? 'danger' : 'default'}
        loading={pending}
      />

      <ConfirmDialog
        open={!!confirmCancelInvite}
        onClose={() => setConfirmCancelInvite(null)}
        onConfirm={executeAction}
        title="Revoke Invite"
        description={`Revoke the invite for ${confirmCancelInvite?.email}? The signup link will stop working immediately.`}
        confirmLabel="Revoke"
        confirmVariant="danger"
        loading={pending}
      />

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={suspendMember}
        title={confirmRemove?.user_profiles?.suspended_at ? 'Restore Account' : 'Suspend Account'}
        description={confirmRemove?.user_profiles?.suspended_at
          ? `Restore access for ${confirmRemove?.user_profiles?.full_name || confirmRemove?.user_profiles?.email}? They will be able to log in again.`
          : `Suspend ${confirmRemove?.user_profiles?.full_name || confirmRemove?.user_profiles?.email}? They will immediately lose access to the authority portal.`}
        confirmLabel={confirmRemove?.user_profiles?.suspended_at ? 'Restore' : 'Suspend'}
        confirmVariant={confirmRemove?.user_profiles?.suspended_at ? 'default' : 'danger'}
        loading={pending}
      />
    </div>
  );
}
