'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getRoleLabel } from '@/lib/role-labels';

function money(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  verified: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  pending_verification: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  rejected: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  needs_update: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  deactivated: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-green-50 text-green-700 border-green-200',
  ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
  MEMBER: 'bg-slate-50 text-slate-600 border-slate-200',
};

const PROJECT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  live: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  pending_live: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  draft: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  scoring: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
};

type TabId = 'overview' | 'members' | 'projects' | 'audit';

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'overview', label: 'Profile', icon: Icons.building, desc: 'Registration & org details' },
  { id: 'members', label: 'Members', icon: Icons.users, desc: 'Team & access' },
  { id: 'projects', label: 'Projects', icon: Icons.folder, desc: 'Linked projects' },
  { id: 'audit', label: 'Audit Trail', icon: Icons.history, desc: 'Activity log' },
];

type OrgDetail = {
  company: any;
  members: any[];
  memberSummary: Record<string, number>;
  memberCount: number;
  projects: any[];
  auditLogs: any[];
  pendingInvites: any[];
  canDecide?: boolean;
};

export default function AuthorityOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // ── Verification decision state ──────────────────────────────────────
  const [decision, setDecision] = useState<'verified' | 'needs_update' | 'rejected' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const loadDetail = async () => {
    try {
      const res = await fetch(`/api/authority/organizations/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load profile');
      setDetail(json.data);
    } catch (error: any) {
      toast.error(error.message || 'Could not load organisation profile');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDetail();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const submitDecision = async () => {
    if (!decision || submittingDecision) return;
    if ((decision === 'needs_update' || decision === 'rejected') && !decisionNote.trim()) {
      toast.error('A reason is required so the organisation knows what to change.');
      return;
    }
    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/authority/organizations/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: decision, note: decisionNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update verification status');
      const verb = decision === 'verified' ? 'approved' : decision === 'needs_update' ? 'returned for changes' : 'rejected';
      toast.success(`Organisation ${verb}`);
      setDecision(null);
      setDecisionNote('');
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || 'Could not update verification status');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const projectStats = useMemo(() => {
    if (!detail) return { total: 0, live: 0, pending: 0, totalCapital: 0, totalCapacity: 0 };
    return {
      total: detail.projects.length,
      live: detail.projects.filter(p => p.status === 'live').length,
      pending: detail.projects.filter(p => ['pending_live', 'scoring'].includes(p.status)).length,
      totalCapital: detail.projects.reduce((s, p) => s + (p.capital_required ?? 0), 0),
      totalCapacity: detail.projects.reduce((s, p) => s + (p.project_size_mw ?? 0), 0),
    };
  }, [detail]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-[#0b3b24] px-6 py-6 h-32 animate-pulse" />
        <div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-none animate-pulse" />)}</div>
        <div className="h-96 bg-slate-100 rounded-none animate-pulse" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-8 text-center">
        <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Icons.building className="size-5 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-400">Organisation not found</p>
        <Link href="/authority/organizations" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-800">
          <Icons.arrowLeft className="size-3" /> Back to Organisations
        </Link>
      </div>
    );
  }

  const c = detail.company;
  const ss = STATUS_STYLES[c.status] || STATUS_STYLES.pending_verification;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-[#0b3b24] px-6 py-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 size-32 bg-white/[0.03] rounded-full" />
        <div className="absolute -bottom-8 -left-8 size-24 bg-white/[0.02] rounded-full" />
        <div className="relative">
          <Link href="/authority/organizations" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200/50 hover:text-emerald-200 uppercase tracking-widest transition-colors mb-3">
            <Icons.arrowLeft className="size-3" /> Organisations
          </Link>
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-none bg-white/10 border border-white/15 flex items-center justify-center shrink-0 overflow-hidden">
              {c.logo_url ? (
                <img src={c.logo_url} alt="" className="size-14 rounded-none object-cover" />
              ) : (
                <span className="text-lg font-black text-white">{c.name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">{c.name}</h1>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider', ss.bg, ss.text)}>
                  <span className={cn('size-1 rounded-full', ss.dot)} />
                  {c.status.replace(/_/g, ' ')}
                </span>
                {c.is_authority_org && <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[9px] font-bold text-emerald-200 tracking-wider">Regulator</span>}
                {c.is_platform_org && <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[9px] font-bold text-emerald-200 tracking-wider">Platform</span>}
              </div>
              <p className="text-[11px] text-emerald-200/60 mt-1.5">
                {c.is_authority_org ? 'Regulator / Management' : getRoleLabel(c.primary_role)} · {c.country || 'Country not set'}
              </p>
              {c.created_at && (
                <p className="text-[10px] text-emerald-200/40 mt-1">Registered {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              )}
            </div>
            {c.website && (
              <a href={c.website} target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-none bg-white/10 border border-white/15 px-4 text-[11px] font-bold text-emerald-200 hover:bg-white/20 transition-colors shrink-0">
                <Icons.externalLink className="size-3.5" /> Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Members', value: detail.memberCount, icon: Icons.users, color: 'blue' },
          { label: 'Projects', value: projectStats.total, icon: Icons.folder, color: 'slate' },
          { label: 'Live Projects', value: projectStats.live, icon: Icons.checkCircle2, color: 'green' },
          { label: 'Total Capacity', value: `${projectStats.totalCapacity} MW`, icon: Icons.activity, color: 'amber' },
          { label: 'Total Capital', value: money(projectStats.totalCapital), icon: Icons.dollarSign, color: 'emerald' },
        ].map(({ label, value, icon: Icon, color }) => {
          const cm: Record<string, { bg: string; icon: string }> = {
            blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
            green: { bg: 'bg-green-50', icon: 'text-green-600' },
            amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
            emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
            slate: { bg: 'bg-slate-100', icon: 'text-slate-600' },
          };
          const co = cm[color];
          return (
            <div key={label} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 hover:border-slate-300 hover:shadow-md transition-all">
              <div className={cn('size-8 rounded-none flex items-center justify-center mb-3', co.bg)}>
                <Icon className={cn('size-4', co.icon)} />
              </div>
              <p className="text-xl font-bold text-slate-950 tracking-tight">{value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Verification decision (Regulator Admins & Reviewers) ───── */}
      {detail.canDecide && (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
            <div className="size-10 rounded-none bg-[#e9f6ee] text-[#166b3b] flex items-center justify-center shrink-0">
              <Icons.shieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Verification Decision</p>
              <p className="text-[11px] text-slate-400">Review the profile below, then approve this organisation or send it back with feedback.</p>
            </div>
            {(c.status === 'needs_update' || c.status === 'rejected') && c.admin_note && (
              <div className="w-full md:w-auto max-w-md rounded-none border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700">Previous decision note</p>
                <p className="text-xs text-amber-800 mt-0.5">{c.admin_note}</p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 space-y-3">
            {!decision ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  disabled={c.status === 'verified'}
                  onClick={() => setDecision('verified')}
                  className="inline-flex h-9 items-center gap-2 rounded-none bg-[#0b3b24] px-4 text-[11px] font-bold text-white transition-colors hover:bg-[#0d4a2e] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icons.checkCircle2 className="size-3.5" /> Approve & Verify
                </button>
                <button
                  onClick={() => setDecision('needs_update')}
                  className="inline-flex h-9 items-center gap-2 rounded-none border border-amber-300 bg-amber-50 px-4 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <Icons.refresh className="size-3.5" /> Request Changes
                </button>
                <button
                  onClick={() => setDecision('rejected')}
                  className="inline-flex h-9 items-center gap-2 rounded-none border border-red-200 bg-red-50 px-4 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100"
                >
                  <Icons.close className="size-3.5" /> Reject
                </button>
              </div>
            ) : (
              <div className="rounded-none border border-slate-200 bg-slate-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-slate-800">
                      {decision === 'verified'
                        ? `Verify \u201C${c.name}\u201D? This grants full platform access and notifies the team.`
                        : decision === 'needs_update'
                          ? `Return \u201C${c.name}\u201D for changes. The team will be asked to update their profile.`
                          : `Reject \u201C${c.name}\u201D? They will be told the organisation was not approved.`}
                    </p>
                    {decision !== 'verified' && (
                      <textarea
                        rows={3}
                        autoFocus
                        placeholder="Required \u2014 explain what needs to change or why this was not approved."
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0b3b24] focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 resize-none"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 justify-end">
                  <button
                    onClick={() => { setDecision(null); setDecisionNote(''); }}
                    className="inline-flex h-9 items-center rounded-none border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submittingDecision}
                    onClick={submitDecision}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-none px-4 text-[11px] font-bold text-white transition-colors disabled:cursor-wait disabled:opacity-60',
                      decision === 'verified' ? 'bg-[#0b3b24] hover:bg-[#0d4a2e]' : decision === 'needs_update' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700',
                    )}
                  >
                    {submittingDecision ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.shieldCheck className="size-3.5" />}
                    {decision === 'verified' ? 'Confirm Approval' : decision === 'needs_update' ? 'Send Back' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex border-b border-slate-100">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex-1 flex flex-col items-center gap-1.5 px-4 py-4 transition-all relative', isActive ? 'bg-green-50/50' : 'hover:bg-slate-50')}>
                <div className={cn('size-9 rounded-none flex items-center justify-center transition-all', isActive ? 'bg-[#0b3b24] text-white' : 'bg-slate-100 text-slate-400')}>
                  <tab.icon className="size-4" />
                </div>
                <span className={cn('text-[11px] font-bold tracking-wider transition-colors', isActive ? 'text-[#0b3b24]' : 'text-slate-400')}>{tab.label}</span>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b3b24]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && <OverviewTab company={c} />}
      {activeTab === 'members' && <MembersTab members={detail.members} invites={detail.pendingInvites} />}
      {activeTab === 'projects' && <ProjectsTab projects={detail.projects} />}
      {activeTab === 'audit' && <AuditTab logs={detail.auditLogs} />}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ company: c }: { company: any }) {
  return (
    <div className="space-y-5">
      {/* About */}
      <SectionCard icon={Icons.building} label="Profile" title="Organisation Details">
        <p className="text-sm text-slate-600 leading-relaxed">{c.description || 'No description provided.'}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5 pt-5 border-t border-slate-100">
          <Info label="Country" value={c.country || 'Not set'} />
          <Info label="Website" value={c.website || 'Not set'} />
          <Info label="Type" value={c.type?.replace(/_/g, ' ') || 'Not set'} />
          <Info label="Team Size" value={c.team_size ? `${c.team_size} people` : 'Not set'} />
          <Info label="Years Operating" value={c.years_operating ? `${c.years_operating} years` : 'Not set'} />
          <Info label="Registration No." value={c.registration_number || 'Not provided'} />
        </div>
      </SectionCard>

      {/* Contact Information */}
      <SectionCard icon={Icons.mail} label="Contact" title="Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Info label="Contact Email" value={c.contact_email || 'Not provided'} />
          <Info label="Contact Phone" value={c.contact_phone || 'Not provided'} />
          <Info label="Primary Role" value={c.primary_role ? getRoleLabel(c.primary_role) : 'Not set'} />
          {c.project_submission_mode && <Info label="Submission Mode" value={String(c.project_submission_mode).replace(/_/g, ' ')} />}
        </div>
      </SectionCard>

      {/* Ownership & Legal */}
      <SectionCard icon={Icons.landmark} label="Legal" title="Ownership & Legal Information">
        <div className="space-y-4">
          <InfoBlock label="Ownership Structure" value={c.ownership_structure || 'Not provided'} />
          <InfoBlock label="Ownership Details" value={c.ownership_details || 'Not provided'} />
          <InfoBlock label="Registration Number" value={c.registration_number || 'Not provided'} />
        </div>
      </SectionCard>

      {/* Management Experience */}
      <SectionCard icon={Icons.briefcase} label="Experience" title="Management & Team Experience">
        <div className="space-y-4">
          <InfoBlock label="Management Experience Summary" value={c.management_experience_summary || 'Not provided'} />
          {c.management_team_experience && typeof c.management_team_experience === 'object' && (() => {
            const val = c.management_team_experience as Record<string, any>;
            const hasContent = Object.values(val).some(v => v !== null && v !== '' && v !== 0 && v !== false);
            if (!hasContent) return null;
            return (
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Team Experience Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(val).filter(([, v]) => v !== null && v !== '' && v !== 0).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-none bg-slate-50 border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                      <p className="text-sm font-bold text-slate-800 mt-1">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {c.is_new_company_with_experienced_team !== undefined && c.is_new_company_with_experienced_team !== null && (
            <InfoBlock label="New Company with Experienced Team" value={c.is_new_company_with_experienced_team ? 'Yes' : 'No'} />
          )}
        </div>
      </SectionCard>

      {/* Verification Flags */}
      <SectionCard icon={Icons.shieldCheck} label="Status" title="Verification Status">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Organisation Status', value: c.status?.replace(/_/g, ' ') || '—', color: c.status === 'verified' ? 'text-green-700' : c.status === 'pending_verification' ? 'text-amber-700' : 'text-slate-600' },
            { label: 'Platform Org', value: c.is_platform_org ? 'Yes' : 'No', color: c.is_platform_org ? 'text-blue-700' : 'text-slate-600' },
            { label: 'Regulator Org', value: c.is_authority_org ? 'Yes' : 'No', color: c.is_authority_org ? 'text-violet-700' : 'text-slate-600' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-none bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className={cn('text-sm font-bold capitalize mt-1', item.color)}>{item.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Members Tab ────────────────────────────────────────────────────────────

function MembersTab({ members, invites }: { members: any[]; invites: any[] }) {
  return (
    <div className="space-y-5">
      {/* Active Members */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Team</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Active Members ({members.length})</h3>
          </div>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center">
            <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.users className="size-5 text-slate-300" /></div>
            <p className="text-sm font-bold text-slate-400">No members</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {members.map((m: any) => {
              const profile = m.user_profiles;
              const suspended = !!profile?.suspended_at;
              const roleColor = ROLE_COLORS[m.role] || ROLE_COLORS.MEMBER;
              return (
                <div key={m.user_id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                  <div className="size-10 rounded-none bg-[#0b3b24] flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-white">{(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{profile?.full_name || '—'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{profile?.email}</p>
                  </div>
                  <div className="text-right hidden md:block">
                    {profile?.job_title && <p className="text-xs text-slate-500">{profile.job_title}</p>}
                    {profile?.phone && <p className="text-[10px] text-slate-400">{profile.phone}</p>}
                  </div>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border shrink-0', roleColor)}>{m.role}</span>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border shrink-0',
                    suspended ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                  )}>{suspended ? 'Suspended' : 'Active'}</span>
                  {m.created_at && (
                    <span className="text-[10px] text-slate-400 font-medium shrink-0 hidden lg:block">
                      Joined {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Outreach</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Pending Invites ({invites.length})</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {invites.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="size-9 rounded-none bg-amber-50 flex items-center justify-center shrink-0"><Icons.mail className="size-4 text-amber-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{inv.email || 'Open invite'}</p>
                  <p className="text-[10px] text-slate-400">Expires {new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-wider border border-amber-200">{inv.membership_role || 'Pending'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Projects Tab ───────────────────────────────────────────────────────────

function ProjectsTab({ projects }: { projects: any[] }) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div>
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Projects</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Linked Projects ({projects.length})</h3>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.folder className="size-5 text-slate-300" /></div>
          <p className="text-sm font-bold text-slate-400">No projects linked</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {projects.map((p: any) => {
            const score = p.scores?.capital_readiness_score ?? 0;
            const ss = PROJECT_STATUS_COLORS[p.status] || PROJECT_STATUS_COLORS.draft;
            return (
              <Link key={p.id} href={`/authority/projects/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">
                <div className="size-9 rounded-none bg-slate-100 flex items-center justify-center shrink-0">
                  <Icons.folder className="size-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-green-800 transition-colors">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400">{(p.project_stage || 'concept').replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">{p.technology_type || '—'}</span>
                    {p.project_size_mw && <><span className="text-[10px] text-slate-300">·</span><span className="text-[10px] text-slate-400">{p.project_size_mw} MW</span></>}
                  </div>
                </div>
                {/* Score bar */}
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : score > 0 ? 'bg-red-500' : 'bg-slate-200')} style={{ width: `${score}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-8">{score}%</span>
                </div>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider shrink-0', ss.bg, ss.text)}>
                  <span className={cn('size-1 rounded-full', ss.dot)} />
                  {p.status?.replace(/_/g, ' ')}
                </span>
                <Icons.chevronRight className="size-3.5 text-slate-300 group-hover:text-green-700 transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Audit Tab ──────────────────────────────────────────────────────────────

function AuditTab({ logs }: { logs: any[] }) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">History</p>
        <h3 className="text-[15px] font-bold text-ink mt-0.5">Audit Trail</h3>
      </div>
      {logs.length === 0 ? (
        <div className="p-8 text-center">
          <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icons.history className="size-5 text-slate-300" /></div>
          <p className="text-sm font-bold text-slate-400">No activity recorded</p>
          <p className="text-xs text-slate-400 mt-1">Audit events will appear here as they occur.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {logs.map((log: any, i: number) => (
            <div key={log.id || i} className="flex items-start gap-3 px-5 py-3.5">
              <div className="size-8 rounded-none bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icons.history className="size-3.5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{log.action_type?.replace(/_/g, ' ') || 'Activity'}</p>
                {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{JSON.stringify(log.details).substring(0, 120)}</p>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                {log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Sub-components ──────────────────────────────────────────────────

function SectionCard({ icon: Icon, label, title, children }: {
  icon: React.ElementType;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">{label}</p>
        <h3 className="text-[15px] font-bold text-ink mt-0.5">{title}</h3>
      </div>
      <div className="p-[22px]">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="px-4 py-3 rounded-none bg-slate-50 border border-slate-100">
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
}
