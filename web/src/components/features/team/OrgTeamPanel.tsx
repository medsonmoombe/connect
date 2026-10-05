'use client';

import { useState } from 'react';
import { useOrgTeam, OrgMember } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

const ROLE_BADGE = {
  OWNER: 'green',
  ADMIN: 'blue',
  MEMBER: 'slate',
} as const;

export function OrgTeamPanel() {
  const { user } = useAuth();
  const { data: members, isLoading, refetch } = useOrgTeam();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [actionMemberId, setActionMemberId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ member: OrgMember; newRole: 'MEMBER' | 'ADMIN' } | null>(null);

  const isOwner = user?.org_member_role === 'OWNER';
  const isOrgAdmin = user?.is_org_admin;

  const activeMembers = members.filter(m => !m.is_invite);
  const pendingInvites = members.filter(m => m.is_invite);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch('/api/org/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, membershipRole: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg({ type: 'error', text: data.error || 'Failed to send invite' });
      } else {
        setInviteMsg({ type: 'success', text: `Invite sent to ${inviteEmail}` });
        setInviteEmail('');
        refetch();
      }
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (member: OrgMember) => {
    if (!member.invite_id) return;
    setActionMemberId(member.user_id);
    try {
      const res = await fetch(`/api/org/team/${member.invite_id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg({ type: 'success', text: `Invite resent to ${member.user_profiles?.email}` });
      } else {
        setInviteMsg({ type: 'error', text: data.error || 'Failed to resend invite' });
      }
    } finally {
      setActionMemberId(null);
    }
  };

  const handleRoleChange = async (member: OrgMember, newRole: 'MEMBER' | 'ADMIN') => {
    setActionMemberId(member.user_id);
    try {
      await fetch(`/api/org/team/${member.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      refetch();
    } finally {
      setActionMemberId(null);
      setConfirmRoleChange(null);
    }
  };

  const handleRemove = async (member: OrgMember) => {
    setActionMemberId(member.user_id);
    try {
      await fetch(`/api/org/team/${member.user_id}`, { method: 'DELETE' });
      refetch();
    } finally {
      setActionMemberId(null);
      setConfirmRemove(null);
    }
  };

  const handleCancelInvite = async (member: OrgMember) => {
    if (!member.invite_id) return;
    setActionMemberId(member.user_id);
    try {
      // Reuse delete endpoint — the invite_id is passed as memberId
      await fetch(`/api/org/team/${member.invite_id}`, { method: 'DELETE' });
      refetch();
    } finally {
      setActionMemberId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="dash-section-label mb-1">Organisation</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Team Management</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isOrgAdmin ? 'Manage your team members and invite new colleagues.' : 'View your organisation\'s team.'}
        </p>
      </div>

      {/* ── Invite Form (OWNER / ADMIN only) ─────────────────────────────── */}
      {isOrgAdmin && (
        <div className="dash-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Invite a Team Member</h3>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="pl-10 h-11 rounded-none border-slate-200"
                required
              />
            </div>
            {isOwner && (
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'MEMBER' | 'ADMIN')}
                className="h-11 px-3 rounded-none border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            )}
            <Button type="submit" disabled={inviting} className="h-11 px-6 rounded-none shrink-0">
              {inviting ? <Icons.spinner className="size-4 animate-spin" /> : <><Icons.plus className="size-4 mr-2" />Send Invite</>}
            </Button>
          </form>
          {inviteMsg && (
            <p className={cn('text-sm font-medium', inviteMsg.type === 'success' ? 'text-green-700' : 'text-red-600')}>
              {inviteMsg.text}
            </p>
          )}
        </div>
      )}

      {/* ── Active Members ────────────────────────────────────────────────── */}
      <div className="dash-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">
            Team Members <span className="text-slate-400 font-normal">({activeMembers.length})</span>
          </h3>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-3 animate-pulse">
                <div className="size-9 rounded-none bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-slate-100 rounded" />
                  <div className="h-2.5 w-48 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeMembers.map(member => {
              const profile = member.user_profiles;
              const isSelf = member.user_id === user?.id;
              const isOwnerRow = member.role === 'OWNER';
              const suspended = !!profile?.suspended_at;

              return (
                <div key={member.user_id} className="px-5 py-4 flex items-center gap-3">
                  <div className="size-9 rounded-none bg-slate-100 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500">
                    {(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {profile?.full_name || '—'}
                        {isSelf && <span className="text-slate-400 font-normal ml-1">(you)</span>}
                      </p>
                      {suspended && <Badge variant="red">Suspended</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
                  </div>
                  <Badge variant={ROLE_BADGE[member.role]}>{member.role}</Badge>
                  {isOrgAdmin && !isOwnerRow && !isSelf && (
                    <div className="flex items-center gap-1 shrink-0">
                      {isOwner && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 px-2 text-xs rounded-none text-slate-500 hover:text-slate-900"
                          disabled={actionMemberId === member.user_id}
                          onClick={() => setConfirmRoleChange({
                            member,
                            newRole: member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                          })}
                        >
                          {member.role === 'ADMIN' ? 'Demote' : 'Make Admin'}
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="size-8 rounded-none text-slate-400 hover:text-red-600 hover:bg-red-50"
                        disabled={actionMemberId === member.user_id}
                        onClick={() => setConfirmRemove(member)}
                      >
                        {actionMemberId === member.user_id
                          ? <Icons.spinner className="size-3.5 animate-spin" />
                          : <Icons.trash className="size-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {activeMembers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No team members yet.</div>
            )}
          </div>
        )}
      </div>

      {/* ── Pending Invites ───────────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <div className="dash-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Pending Invites <span className="text-slate-400 font-normal">({pendingInvites.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {pendingInvites.map(invite => (
              <div key={invite.user_id} className="px-5 py-4 flex items-center gap-3">
                <div className="size-9 rounded-none bg-yellow-50 border border-yellow-100 flex items-center justify-center shrink-0">
                  <Icons.mail className="size-4 text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{invite.user_profiles?.email}</p>
                  <p className="text-xs text-slate-400">Invite pending — awaiting acceptance</p>
                </div>
                <Badge variant="yellow">Pending</Badge>
                {isOrgAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 px-2.5 text-xs rounded-none text-slate-500 hover:text-slate-900"
                      disabled={actionMemberId === invite.user_id}
                      onClick={() => handleResendInvite(invite)}
                    >
                      {actionMemberId === invite.user_id
                        ? <Icons.spinner className="size-3 animate-spin mr-1" />
                        : <Icons.refreshCw className="size-3 mr-1" />}
                      Resend
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="size-8 rounded-none text-slate-400 hover:text-red-600 hover:bg-red-50"
                      disabled={actionMemberId === invite.user_id}
                      onClick={() => handleCancelInvite(invite)}
                    >
                      <Icons.x className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirm Dialogs ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => { if (confirmRemove) handleRemove(confirmRemove); }}
        title="Remove Team Member"
        description={`Remove ${confirmRemove?.user_profiles?.full_name || 'this member'} from your organisation? They will lose access immediately.`}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={actionMemberId === confirmRemove?.user_id}
      />

      <ConfirmDialog
        open={!!confirmRoleChange}
        onClose={() => setConfirmRoleChange(null)}
        onConfirm={() => { if (confirmRoleChange) handleRoleChange(confirmRoleChange.member, confirmRoleChange.newRole); }}
        title={confirmRoleChange?.newRole === 'ADMIN' ? 'Promote to Admin' : 'Demote to Member'}
        description={
          confirmRoleChange?.newRole === 'ADMIN'
            ? `Give ${confirmRoleChange.member.user_profiles?.full_name} admin access? They will be able to invite members and edit the company profile.`
            : `Remove admin access from ${confirmRoleChange?.member.user_profiles?.full_name}?`
        }
        confirmLabel={confirmRoleChange?.newRole === 'ADMIN' ? 'Promote' : 'Demote'}
        loading={actionMemberId === confirmRoleChange?.member.user_id}
      />
    </div>
  );
}
