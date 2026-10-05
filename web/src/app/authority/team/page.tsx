'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Hero, HeroGhostButton, HeroLightButton, HeroPill,
  Card, CardHead, CardBody, SoftIcon, CountChip,
  Badge, StatusPill, EmptyState, Row, RowMain,
  SearchInput, Select, PrimaryButton, RowMenu, type Tone,
} from '@/components/ui/kit';
import { TH_CLASS, TD_CLASS } from '@/components/ui/kit';

// ── Types ──────────────────────────────────────────────────────────────────

type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

interface TeamMember {
  user_id: string;
  role: MemberRole;
  user_profiles?: { full_name?: string; email?: string; phone?: string; job_title?: string; suspended_at?: string | null; created_at?: string } | null;
}

interface PendingInvite {
  id: string;
  email: string | null;
  token: string;
  expires_at: string;
  created_at: string;
  membership_role: string | null;
}

// ── Role badge (kit Badge tones) ───────────────────────────────────────────

const ROLE_TONE: Record<MemberRole, Tone> = {
  OWNER: 'green',
  ADMIN: 'blue',
  MEMBER: 'slate',
};

const ROLE_HINTS: Record<'MEMBER' | 'ADMIN', string> = {
  ADMIN: 'Admins can invite and remove members and manage the organisation profile — full workspace access.',
  MEMBER: 'Members have read and write access to their workspace, but cannot manage the team.',
};

export default function AuthorityTeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviting, setInviting] = useState(false);

  // Invites drawer
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<PendingInvite | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState(false);

  // Member action
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<TeamMember | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<TeamMember | null>(null);
  const [actionPending, setActionPending] = useState(false);

  // Member filter
  const [filter, setFilter] = useState('');

  const isOrgAdmin = user?.is_org_admin ?? false;
  const isOwner = user?.org_member_role === 'OWNER';

  // ── Fetch members ──
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/org/team');
      const data = await res.json();
      const teamMembers = (data.data ?? []).filter((m: any) => m.user_profiles && !m.is_invite);
      setMembers(teamMembers);
    } catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Fetch invites ──
  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    try { const res = await fetch('/api/org/team/invites'); const d = await res.json(); setInvites(d.data ?? []); }
    finally { setInvitesLoading(false); }
  }, []);

  const openInvitesDrawer = () => { setInvitesOpen(true); fetchInvites(); };

  // ── Send invite ──
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch('/api/org/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, membershipRole: inviteRole }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); }
      else { toast.success(`Invite sent to ${inviteEmail}`); setInviteEmail(''); fetchMembers(); }
    } finally { setInviting(false); }
  };

  const handleResendInvite = async (inv: PendingInvite) => {
    setResendingId(inv.id);
    try {
      const res = await fetch(`/api/org/team/invites/${inv.id}`, { method: 'POST' });
      if (res.ok) { const data = await res.json(); setInvites(prev => prev.map(i => i.id === inv.id ? { ...i, expires_at: data.expires_at } : i)); toast.success('Invite resent'); }
      else toast.error('Failed to resend');
    } finally { setResendingId(null); }
  };

  const handleCancelInvite = async () => {
    if (!confirmCancelInvite) return;
    setCancellingInvite(true);
    try { await fetch(`/api/org/team/invites/${confirmCancelInvite.id}`, { method: 'DELETE' }); setInvites(prev => prev.filter(i => i.id !== confirmCancelInvite.id)); toast.success('Invite cancelled'); setConfirmCancelInvite(null); }
    finally { setCancellingInvite(false); }
  };

  // ── Remove member ──
  const handleRemove = async () => {
    if (!confirmRemove) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${confirmRemove.user_id}`, { method: 'DELETE' }); toast.success('Member removed'); setConfirmRemove(null); fetchMembers(); }
    finally { setActionPending(false); }
  };

  // ── Deactivate / Reactivate ──
  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${confirmDeactivate.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'suspend' }) }); toast.success('Member deactivated'); setConfirmDeactivate(null); fetchMembers(); }
    finally { setActionPending(false); }
  };

  const handleReactivate = async () => {
    if (!confirmReactivate) return;
    setActionPending(true);
    try { await fetch(`/api/org/team/${confirmReactivate.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reactivate' }) }); toast.success('Member reactivated'); setConfirmReactivate(null); fetchMembers(); }
    finally { setActionPending(false); }
  };

  // ── RBAC ──
  const canActOn = (m: TeamMember): boolean => {
    if (!isOrgAdmin) return false;
    if (m.user_id === user?.id) return false;
    if (m.role === 'OWNER') return false;
    return true;
  };

  // ── Derived ──
  const adminCount = useMemo(() => members.filter(m => m.role === 'ADMIN' || m.role === 'OWNER').length, [members]);
  const filteredMembers = useMemo(() => {
    if (!filter.trim()) return members;
    const q = filter.toLowerCase();
    return members.filter(m =>
      `${m.user_profiles?.full_name ?? ''} ${m.user_profiles?.email ?? ''} ${m.role}`.toLowerCase().includes(q)
    );
  }, [members, filter]);

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const inviteMeta = (inv: PendingInvite) => {
    const days = Math.max(0, Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86400000));
    return `Sent ${fmtDate(inv.created_at)} · expires in ${days} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">

      {/* ══ HERO (mock .hero) ══════════════════════════════════════════ */}
      <Hero
        eyebrow={<>Settings · Team Management</>}
        icon={Icons.shield}
        title="Team Members"
        description={
          <>Manage who has access to <strong className="font-semibold text-[#e9f7ee]">{user?.company_name || 'your organisation'}</strong> — invite colleagues, assign roles, and keep every approval audit-ready.</>
        }
        actions={
          <>
            {isOrgAdmin && (
              <HeroGhostButton onClick={openInvitesDrawer}>
                <Icons.clock className="size-4" /> Pending invites <HeroPill>{invites.length}</HeroPill>
              </HeroGhostButton>
            )}
            {isOrgAdmin && (
              <HeroLightButton onClick={() => document.getElementById('invite-email')?.focus()}>
                <Icons.users className="size-4" /> Invite member
              </HeroLightButton>
            )}
          </>
        }
        stats={[
          { value: members.length, label: 'Active members' },
          { value: adminCount, label: 'Admins' },
          { value: invites.length, label: 'Pending invites' },
        ].map(s => ({
          ...s,
          value: loading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/20" /> : s.value,
        }))}
      />

      {/* ══ INVITE CARD (mock #inviteCard) ═════════════════════════════ */}
      {isOrgAdmin && (
        <Card>
          <CardHead
            icon={Icons.user}
            title="Invite a team member"
            sub="They'll receive an email with a secure link to join this workspace."
          />
          <CardBody>
            <form onSubmit={handleInvite} className="flex flex-wrap items-start gap-3">
              <div className="relative min-w-[230px] flex-[1_1_280px]">
                <Icons.mail className="pointer-events-none absolute left-3.5 top-[13px] size-[17px] text-ink-3" />
                <input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoComplete="off"
                  className="h-11 w-full rounded-none border border-line-strong bg-white pl-10 pr-3.5 text-sm text-ink transition-all placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-[3.5px] focus:ring-brand/20"
                  required
                />
              </div>
              {isOwner && (
                <Select
                  value={inviteRole}
                  onChange={v => setInviteRole(v as 'MEMBER' | 'ADMIN')}
                  ariaLabel="Assign a role"
                  options={[{ value: 'ADMIN', label: 'Admin' }, { value: 'MEMBER', label: 'Member' }]}
                  className="w-full sm:w-44 [&>select]:h-11"
                />
              )}
              <PrimaryButton type="submit" loading={inviting} icon={Icons.send} className="h-11">
                Send invite
              </PrimaryButton>
            </form>
            <div className="mt-4 flex items-start gap-2.5 rounded-none border border-line bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-2">
              <Icons.info className="mt-px size-[15px] shrink-0 text-brand-text" />
              <span>{ROLE_HINTS[inviteRole]}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ══ PENDING INVITES (mock #pendingCard .row-list) ══════════════ */}
      {isOrgAdmin && (
        <Card>
          <CardHead
            icon={Icons.clock}
            tone="copper"
            title={<>Pending invites <CountChip>{invites.length}</CountChip></>}
            sub="Awaiting a response — invites expire after 7 days."
            trailing={
              <button onClick={openInvitesDrawer} className="ml-auto text-[13px] font-semibold text-brand-text hover:underline">
                View all
              </button>
            }
          />
          {invitesLoading ? (
            <div className="px-[22px] py-12 text-center">
              <Icons.spinner className="mx-auto size-5 animate-spin text-ink-3/50" />
            </div>
          ) : invites.length === 0 ? (
            <EmptyState icon="checkCircle2" title="All caught up" sub="There are no pending invites right now." />
          ) : (
            invites.slice(0, 4).map(inv => (
              <Row key={inv.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-copper-soft text-copper">
                  <Icons.mail className="size-[15px]" />
                </span>
                <RowMain
                  title={inv.email ?? 'Open invite'}
                  sub={inviteMeta(inv)}
                />
                <Badge tone={inv.membership_role === 'ADMIN' ? 'blue' : 'amber'} className="capitalize">
                  {inv.membership_role?.toLowerCase() ?? 'member'}
                </Badge>
                <div className="flex gap-1">
                  <RowMenu
                    trigger={({ open, toggle }) => (
                      <button
                        onClick={toggle}
                        disabled={resendingId === inv.id}
                        aria-label={`Actions for invite to ${inv.email}`}
                        className={cn('grid size-8 place-items-center rounded-none transition-colors', open ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink')}
                      >
                        {resendingId === inv.id ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.moreVertical className="size-4" />}
                      </button>
                    )}
                    items={[
                      { label: 'Resend', icon: Icons.refreshCw, onClick: () => handleResendInvite(inv) },
                      { label: 'Copy link', icon: Icons.copy, onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/signup?token=${inv.token}`); toast.success('Link copied'); } },
                      'divider',
                      { label: 'Revoke', icon: Icons.x, danger: true, onClick: () => setConfirmCancelInvite(inv) },
                    ]}
                  />
                </div>
              </Row>
            ))
          )}
        </Card>
      )}

      {/* ══ TEAM TABLE (mock #teamCard .team-table) ════════════════════ */}
      <Card>
        <CardHead
          icon={Icons.users}
          title={<>Team members <CountChip>{members.length}</CountChip></>}
          sub="Everyone with access to this organisation"
          trailing={
            <div className="ml-auto w-full sm:w-56">
              <SearchInput value={filter} onChange={setFilter} placeholder="Filter members…" />
            </div>
          }
        />
        {loading ? (
          <div className="px-[22px] py-12 text-center">
            <Icons.spinner className="mx-auto size-5 animate-spin text-ink-3/50" />
            <p className="mt-2 text-[13px] font-semibold text-ink-3">Loading team…</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon={filter ? 'search' : 'users'}
            title={filter ? 'No members match your filter' : 'No team members yet'}
            sub={filter ? 'Try a different name, email, or role.' : 'Invite your first colleague to get started.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Member</th>
                  <th className={TH_CLASS}>Role</th>
                  <th className={TH_CLASS}>Status</th>
                  <th className={TH_CLASS}>Joined</th>
                  <th className={cn(TH_CLASS, 'w-16')} />
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(m => {
                  const suspended = !!m.user_profiles?.suspended_at;
                  const isSelf = m.user_id === user?.id;
                  return (
                    <tr key={m.user_id} className="transition-colors hover:bg-surface-2">
                      <td className={TD_CLASS}>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-text text-xs font-bold text-white">
                            {(m.user_profiles?.full_name || m.user_profiles?.email || 'U').slice(0, 2).toUpperCase()}
                            {!suspended && <span className="absolute translate-x-5 translate-y-4 size-2.5 rounded-full border-2 border-white bg-green-500" />}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-ink">
                              {m.user_profiles?.full_name || '—'}
                              {isSelf && (
                                <span className="rounded-full bg-surface-2 px-[7px] py-px text-[10px] font-bold tracking-[0.04em] text-ink-2">You</span>
                              )}
                            </p>
                            <p className="truncate text-[12.5px] text-ink-3">{m.user_profiles?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={TD_CLASS}>
                        <Badge tone={ROLE_TONE[m.role]} className="capitalize">{m.role.toLowerCase()}</Badge>
                      </td>
                      <td className={TD_CLASS}>
                        <StatusPill status={suspended ? 'suspended' : 'active'} />
                      </td>
                      <td className={TD_CLASS}>
                        <span className="text-[13px] text-ink-2">{fmtDate(m.user_profiles?.created_at)}</span>
                      </td>
                      <td className={TD_CLASS}>
                        {isSelf ? (
                          <span className="text-[11px] font-semibold text-ink-3/60">You</span>
                        ) : canActOn(m) ? (
                          <RowMenu
                            trigger={({ open, toggle }) => (
                              <button
                                onClick={toggle}
                                aria-label={`Actions for ${m.user_profiles?.full_name || 'member'}`}
                                className={cn('grid size-8 place-items-center rounded-none transition-colors', open ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink')}
                              >
                                <Icons.moreVertical className="size-4" />
                              </button>
                            )}
                            items={[
                              suspended
                                ? { label: 'Activate', icon: Icons.check, onClick: () => setConfirmReactivate(m) }
                                : { label: 'Deactivate', icon: Icons.alertTriangle, danger: true, onClick: () => setConfirmDeactivate(m) },
                              'divider',
                              { label: 'Remove from team', icon: Icons.trash, danger: true, onClick: () => setConfirmRemove(m) },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Drawers */}
      <Drawer open={invitesOpen} onClose={() => setInvitesOpen(false)} title="Pending Invites" description="Invites sent but not yet accepted.">
        {invitesLoading ? (
          <div className="p-8 text-center"><Icons.spinner className="mx-auto size-5 animate-spin text-slate-300" /></div>
        ) : invites.length === 0 ? (
          <EmptyState icon="checkCircle2" title="All caught up" sub="There are no pending invites right now." />
        ) : (
          <div className="space-y-1">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 rounded-none border border-line p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-copper-soft text-copper">
                  <Icons.mail className="size-[15px]" />
                </span>
                <RowMain title={inv.email ?? 'Open invite'} sub={inviteMeta(inv)} />
                <Badge tone={inv.membership_role === 'ADMIN' ? 'blue' : 'amber'} className="capitalize">
                  {inv.membership_role?.toLowerCase() ?? 'member'}
                </Badge>
                <RowMenu
                  trigger={({ open, toggle }) => (
                    <button
                      onClick={toggle}
                      disabled={resendingId === inv.id}
                      className={cn('grid size-8 place-items-center rounded-none transition-colors', open ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink')}
                    >
                      {resendingId === inv.id ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.moreVertical className="size-4" />}
                    </button>
                  )}
                  items={[
                    { label: 'Resend', icon: Icons.refreshCw, onClick: () => handleResendInvite(inv) },
                    { label: 'Copy link', icon: Icons.copy, onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/signup?token=${inv.token}`); toast.success('Link copied'); } },
                    'divider',
                    { label: 'Revoke', icon: Icons.x, danger: true, onClick: () => setConfirmCancelInvite(inv) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* Confirm Dialogs */}
      <ConfirmDialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)} onConfirm={handleRemove} title="Remove Team Member" description={`Remove ${confirmRemove?.user_profiles?.full_name || 'this member'}? They will lose access immediately.`} confirmLabel="Remove" confirmVariant="danger" loading={actionPending} />
      <ConfirmDialog open={!!confirmCancelInvite} onClose={() => setConfirmCancelInvite(null)} onConfirm={handleCancelInvite} title="Cancel Invite" description={`Cancel the invite${confirmCancelInvite?.email ? ` for ${confirmCancelInvite.email}` : ''}?`} confirmLabel="Cancel Invite" confirmVariant="danger" loading={cancellingInvite} />
      <ConfirmDialog open={!!confirmDeactivate} onClose={() => setConfirmDeactivate(null)} onConfirm={handleDeactivate} title="Deactivate Member" description={`Deactivate ${confirmDeactivate?.user_profiles?.full_name || 'this member'}?`} confirmLabel="Deactivate" confirmVariant="danger" loading={actionPending} />
      <ConfirmDialog open={!!confirmReactivate} onClose={() => setConfirmReactivate(null)} onConfirm={handleReactivate} title="Activate Member" description={`Reactivate ${confirmReactivate?.user_profiles?.full_name || 'this member'}?`} confirmLabel="Activate" loading={actionPending} />
    </div>
  );
}
