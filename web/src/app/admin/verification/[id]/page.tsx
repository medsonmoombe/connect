'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Badge, BadgeVariant } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

type OrgStatus = 'pending_verification' | 'verified' | 'rejected' | 'needs_update' | 'deactivated';

interface OrgMember {
  role: string;
  user_id: string;
  user_profiles: {
    id: string; full_name: string; email: string;
    avatar_url?: string; phone?: string; job_title?: string;
    created_at?: string;
  } | null;
}

interface OrgRecord {
  id: string; name: string; primary_role: string; country: string;
  status: OrgStatus; created_at: string; updated_at?: string;
  admin_note?: string; description?: string; website?: string;
  team_size?: number; years_operating?: number; logo_url?: string;
  registration_number?: string; ownership_structure?: string;
  ownership_details?: string; contact_email?: string; contact_phone?: string;
  is_new_company_with_experienced_team?: boolean;
  management_team_experience?: Record<string, any>;
  management_experience_summary?: string;
  reviewed_by?: string; reviewed_at?: string;
  preferences?: Record<string, any> | null;
  company_members: OrgMember[];
  projects?: { id: string; name: string; technology_type: string; status: string; location_country?: string; created_at: string }[];
}

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string; tone: string }> = {
  pending_verification: { variant: 'yellow', label: 'Pending Review', tone: 'amber' },
  verified:             { variant: 'green',  label: 'Verified',       tone: 'green' },
  rejected:             { variant: 'red',    label: 'Rejected',       tone: 'red'   },
  needs_update:         { variant: 'orange', label: 'Needs Update',   tone: 'blue'  },
  deactivated:          { variant: 'slate',  label: 'Deactivated',    tone: 'slate' },
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: 'Project Developer', CAPITAL_PARTNER: 'Financier',
  TECHNICAL_PARTNER: 'EPC / Operator', CONSULTANT: 'Consultant',
  POWER_TRADER: 'Power Trader', GRANT_PROVIDER: 'Grant Provider',
};

const TONE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', dot: 'bg-green-500' },
  red:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-600',   dot: 'bg-red-500'   },
  blue:  { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  dot: 'bg-blue-400'  },
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-400' },
};

type ReviewTab = 'overview' | 'ownership' | 'preferences' | 'team' | 'audit';

const TABS: { id: ReviewTab; label: string; icon: keyof typeof Icons }[] = [
  { id: 'overview',     label: 'Organisation',            icon: 'building'    },
  { id: 'ownership',    label: 'Ownership & Registration', icon: 'shieldCheck' },
  { id: 'preferences',  label: 'Matching Preferences',    icon: 'settings'    },
  { id: 'team',         label: 'Team Members',            icon: 'users'       },
  { id: 'audit',        label: 'Review Notes',            icon: 'history'     },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-3.5 border border-slate-100 bg-slate-50">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      {children ?? <p className="text-sm font-semibold text-slate-900">{value || 'Not provided'}</p>}
    </div>
  );
}

function SecHead({ icon, label, description }: { icon: keyof typeof Icons; label: string; description?: string }) {
  const Icon = Icons[icon];
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
      <div className="grid size-7 place-items-center rounded-none bg-brand-soft text-brand-text shrink-0">
        <Icon className="size-3.5 text-[#0b3b24]" />
      </div>
      <div>
        <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">{label}</h3>
        {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function PrefItem({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '' || value === 0 || value === false) return null;
  const display = Array.isArray(value) ? (value.length > 0 ? value.join(', ') : null)
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (!display) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">{label.replace(/_/g, ' ')}</span>
      <span className="text-sm text-slate-700 text-right">{display}</span>
    </div>
  );
}

function TimelineItem({ icon, label, date, color }: { icon: keyof typeof Icons; label: string; date: string; color: string }) {
  const Icon = Icons[icon];
  const c: Record<string, string> = { green: 'bg-green-100 text-green-700', blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600' };
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex flex-col items-center gap-0.5">
        <div className={cn('size-7 flex items-center justify-center', c[color] ?? c.green)}><Icon className="size-3.5" /></div>
        <div className="w-px h-3 bg-slate-100" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{date}</p>
      </div>
    </div>
  );
}

export default function AdminVerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [org, setOrg] = useState<OrgRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReviewTab>('overview');
  const [note, setNote] = useState('');
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [loadingRequestInfo, setLoadingRequestInfo] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmRequestInfo, setConfirmRequestInfo] = useState(false);

  const fetchOrg = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`);
      const json = await res.json();
      if (res.ok && json.data) { setOrg(json.data); }
      else { toast.error('Organisation not found'); router.push('/admin/verification'); }
    } catch { toast.error('Failed to load organisation'); router.push('/admin/verification'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrg(); }, [id]);

  const handleAction = async (status: 'verified' | 'rejected' | 'needs_update') => {
    const setLoader = status === 'verified' ? setLoadingApprove : status === 'rejected' ? setLoadingReject : setLoadingRequestInfo;
    setLoader(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status, note: note || undefined }),
      });
      if (res.ok) {
        toast.success(`Organisation ${STATUS_BADGE[status]?.label ?? status}`, { description: `"${org?.name}" has been updated.` });
        setConfirmApprove(false); setConfirmReject(false); setConfirmRequestInfo(false); setNote('');
        await fetchOrg();
      } else { const err = await res.json(); toast.error(err.error || 'Failed to update status'); }
    } catch { toast.error('An error occurred'); }
    finally { setLoader(false); }
  };

  const statusConf = STATUS_BADGE[org?.status ?? 'pending_verification'] ?? STATUS_BADGE.pending_verification;
  const tone = TONE[statusConf.tone] ?? TONE.amber;
  const owner = org?.company_members?.find(m => m.role === 'OWNER')?.user_profiles;
  const members = org?.company_members ?? [];
  const canAct = org?.status === 'pending_verification' || org?.status === 'needs_update';

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-slate-100 animate-pulse" />
          <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="border border-slate-200 bg-white overflow-hidden">
          <div className="h-14 bg-surface-2 animate-pulse" />
          <div className="p-6 space-y-4">
            <div className="flex gap-4">
              <div className="size-14 bg-slate-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-56 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-80 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-50 border border-slate-100 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="space-y-5">

      {/* Back nav + actions */}
      <div className="flex items-center gap-3">
        <Link href="/admin/verification"
          className="inline-flex items-center justify-center size-9 border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors">
          <Icons.arrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="dash-section-label mb-0">Admin · Verification</p>
          <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">Organisation Review</h1>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 px-3.5 border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
              onClick={() => { setNote(''); setConfirmReject(true); }} loading={loadingReject}>
              <Icons.x className="size-3.5 mr-1" />Reject
            </Button>
            <Button variant="outline" className="h-9 px-3.5 border-amber-200 text-amber-600 text-xs font-bold hover:bg-amber-50"
              onClick={() => { setNote(''); setConfirmRequestInfo(true); }} loading={loadingRequestInfo}>
              <Icons.info className="size-3.5 mr-1" />Request Info
            </Button>
            <Button className="h-9 px-3.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold"
              onClick={() => { setNote(''); setConfirmApprove(true); }} loading={loadingApprove}>
              <Icons.checkCircle2 className="size-3.5 mr-1" />Approve
            </Button>
          </div>
        )}
      </div>

      {/* Main card */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 mb-0.5">Verification Review</p>
            <h2 className="text-sm font-semibold text-ink">{org.name}</h2>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border', tone.border, tone.bg, tone.text)}>
            <span className={cn('size-1.5 rounded-full', tone.dot)} />
            {statusConf.label}
          </span>
        </div>

        {/* Identity row */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="size-14 shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
              {org.logo_url
                ? <img src={org.logo_url} alt="" className="size-full object-cover" />
                : <span className="text-lg font-bold text-slate-400">{org.name.substring(0, 2).toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant={statusConf.variant}>{ROLE_LABELS[org.primary_role] ?? org.primary_role}</Badge>
                <span className="text-[11px] text-slate-400">{org.country}</span>
                {org.team_size ? <span className="text-[11px] text-slate-400">· {org.team_size} members</span> : null}
                {org.years_operating != null ? <span className="text-[11px] text-slate-400">· {org.years_operating}yr operating</span> : null}
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{org.name}</h2>
              {org.description && (
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-2xl line-clamp-2">{org.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span>Applied {formatDate(org.created_at)}</span>
                {org.reviewed_at && <span>· Reviewed {formatDateTime(org.reviewed_at)}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-100 px-6 overflow-x-auto">
          <div className="flex -mb-px">
            {TABS.map(tab => {
              const TabIcon = Icons[tab.icon];
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn('flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold border-b-2 transition-colors whitespace-nowrap',
                    activeTab === tab.id ? 'border-[#0b3b24] text-[#0b3b24]' : 'border-transparent text-slate-400 hover:text-slate-600')}>
                  <TabIcon className="size-3.5" />{tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6 space-y-6">

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoRow label="Status"><Badge variant={statusConf.variant}>{statusConf.label}</Badge></InfoRow>
                <InfoRow label="Type" value={ROLE_LABELS[org.primary_role] ?? org.primary_role} />
                <InfoRow label="Country" value={org.country} />
                <InfoRow label="Team Size" value={org.team_size ? `${org.team_size} people` : undefined} />
                <InfoRow label="Years Operating" value={org.years_operating != null ? `${org.years_operating} years` : undefined} />
                <InfoRow label="Website">
                  {org.website
                    ? <a href={org.website.startsWith('http') ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-semibold text-[#0b3b24] hover:underline flex items-center gap-1">
                        {org.website}<Icons.arrowUpRight className="size-3" />
                      </a>
                    : <p className="text-sm font-semibold text-slate-400">Not provided</p>}
                </InfoRow>
                <InfoRow label="Applied" value={formatDate(org.created_at)} />
                <InfoRow label="New Company Flag" value={org.is_new_company_with_experienced_team ? 'Yes — experienced team' : 'No'} />
              </div>

              {org.description && (
                <div className="space-y-3">
                  <SecHead icon="fileText" label="Description" />
                  <div className="p-4 border border-slate-100 bg-slate-50">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{org.description}</p>
                  </div>
                </div>
              )}

              {org.management_team_experience && Object.keys(org.management_team_experience).length > 0 && (
                <div className="space-y-3">
                  <SecHead icon="trendingUp" label="Management Team Experience" />
                  <div className="p-4 border border-slate-100 bg-slate-50 space-y-1">
                    {Object.entries(org.management_team_experience).map(([k, v]) => <PrefItem key={k} label={k} value={v} />)}
                  </div>
                  {org.management_experience_summary && (
                    <div className="p-4 border border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experience Summary</p>
                      <p className="text-sm text-slate-700">{org.management_experience_summary}</p>
                    </div>
                  )}
                </div>
              )}

              {org.projects && org.projects.length > 0 && (
                <div className="space-y-3">
                  <SecHead icon="folder" label="Projects" description={`${org.projects.length} project(s) on the platform`} />
                  <div className="space-y-2">
                    {org.projects.map(p => (
                      <Link key={p.id} href={`/projects/${p.id}`}
                        className="flex items-center justify-between p-4 border border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 bg-slate-200 flex items-center justify-center shrink-0">
                            <Icons.folder className="size-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-[#0b3b24]">{p.name}</p>
                            <p className="text-[11px] text-slate-500">{p.technology_type?.replace(/_/g, ' ')} · {p.location_country ?? '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant={p.status === 'draft' ? 'slate' : 'blue'}>{p.status}</Badge>
                          <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-[#0b3b24]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* OWNERSHIP */}
          {activeTab === 'ownership' && (
            <>
              <div className="space-y-3">
                <SecHead icon="shieldCheck" label="Registration Details" description="Legal and ownership information" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow label="Registration Number" value={org.registration_number || undefined} />
                  <InfoRow label="Ownership Structure" value={org.ownership_structure?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || undefined} />
                </div>
                {org.ownership_details && (
                  <div className="p-4 border border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ownership Breakdown</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{org.ownership_details}</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <SecHead icon="mail" label="Contact Information" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow label="Contact Email">
                    {org.contact_email
                      ? <a href={`mailto:${org.contact_email}`} className="text-sm font-semibold text-[#0b3b24] hover:underline">{org.contact_email}</a>
                      : <p className="text-sm font-semibold text-slate-400">Not provided</p>}
                  </InfoRow>
                  <InfoRow label="Contact Phone">
                    {org.contact_phone
                      ? <a href={`tel:${org.contact_phone}`} className="text-sm font-semibold text-[#0b3b24] hover:underline">{org.contact_phone}</a>
                      : <p className="text-sm font-semibold text-slate-400">Not provided</p>}
                  </InfoRow>
                </div>
              </div>
              <div className="space-y-3">
                <SecHead icon="eye" label="Verification Status" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow label="Current Status"><Badge variant={statusConf.variant}>{statusConf.label}</Badge></InfoRow>
                  <InfoRow label="Review Date" value={org.reviewed_at ? formatDateTime(org.reviewed_at) : undefined} />
                </div>
                {org.admin_note && (
                  <div className={cn('p-4 border', tone.border, tone.bg)}>
                    <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', tone.text)}>Admin Note</p>
                    <p className={cn('text-sm leading-relaxed', tone.text)}>{org.admin_note}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* PREFERENCES */}
          {activeTab === 'preferences' && (
            <>
              {org.preferences && Object.keys(org.preferences).length > 2 ? (
                <div className="space-y-3">
                  <SecHead icon="settings" label={`${ROLE_LABELS[org.primary_role] ?? org.primary_role} Matching Preferences`} description="Role-specific preferences used by the matching engine" />
                  <div className="p-4 border border-slate-100 bg-slate-50">
                    {Object.entries(org.preferences).map(([k, v]) => {
                      if (['id', 'company_id', 'created_at', 'updated_at'].includes(k)) return null;
                      return <PrefItem key={k} label={k} value={v} />;
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center border border-slate-100 bg-slate-50">
                  <Icons.settings className="size-8 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 mb-1">No Preferences Configured</p>
                  <p className="text-xs text-slate-400">
                    {org.primary_role === 'DEVELOPER'
                      ? 'Developers do not have matching preferences — they create projects instead.'
                      : 'This organisation has not completed their preference setup yet.'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* TEAM */}
          {activeTab === 'team' && (
            <>
              {owner && (
                <div className="space-y-3">
                  <SecHead icon="shieldCheck" label="Organisation Owner" />
                  <div className="flex items-center gap-4 p-4 border border-line bg-surface-2">
                    <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-text shrink-0">
                      <span className="text-xs font-bold text-white">
                        {(owner.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{owner.full_name ?? '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{owner.email ?? '—'}</p>
                      {owner.job_title && <p className="text-xs text-[#0b3b24] mt-1">{owner.job_title}</p>}
                    </div>
                    <Badge variant="green">OWNER</Badge>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <SecHead icon="users" label="All Members" description={`${members.length} member(s)`} />
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3.5 border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                      <div className="size-9 bg-slate-200 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-500">
                          {(m.user_profiles?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{m.user_profiles?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-500">{m.user_profiles?.email ?? '—'}</p>
                      </div>
                      <Badge variant={m.role === 'OWNER' ? 'green' : m.role === 'ADMIN' ? 'blue' : 'slate'}>{m.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* AUDIT */}
          {activeTab === 'audit' && (
            <>
              <div className="space-y-3">
                <SecHead icon="history" label="Review Notes" description="Admin decisions and notes" />
                {org.admin_note ? (
                  <div className={cn('p-4 border', tone.border, tone.bg)}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest', tone.text)}>
                        {STATUS_BADGE[org.status]?.label ?? 'Note'}
                      </span>
                      {org.reviewed_at && <span className="text-[10px] text-slate-400">· {formatDateTime(org.reviewed_at)}</span>}
                    </div>
                    <p className={cn('text-sm leading-relaxed', tone.text)}>{org.admin_note}</p>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-slate-100 bg-slate-50">
                    <Icons.history className="size-6 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No review notes yet</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <SecHead icon="clock" label="Timeline" />
                <TimelineItem icon="building" label="Organisation created" date={formatDateTime(org.created_at)} color="green" />
                {org.reviewed_at && (
                  <TimelineItem icon="shieldCheck" label={`Status: ${STATUS_BADGE[org.status]?.label ?? org.status}`} date={formatDateTime(org.reviewed_at)} color="blue" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom action bar */}
        {canAct && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <p className="text-xs text-slate-400 font-medium">Review the details above, then approve, request changes, or reject.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 px-4 border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                onClick={() => { setNote(''); setConfirmReject(true); }} loading={loadingReject}>Reject</Button>
              <Button variant="outline" className="h-9 px-4 border-amber-200 text-amber-600 text-xs font-bold hover:bg-amber-50"
                onClick={() => { setNote(''); setConfirmRequestInfo(true); }} loading={loadingRequestInfo}>Request Info</Button>
              <Button className="h-9 px-5 bg-brand hover:bg-brand-hover text-white text-xs font-bold"
                onClick={() => { setNote(''); setConfirmApprove(true); }} loading={loadingApprove}>Approve Organisation</Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Approve */}
      <ConfirmDialog open={confirmApprove} onClose={() => setConfirmApprove(false)}
        onConfirm={() => handleAction('verified')} title="Approve Organisation"
        description={`Approve "${org.name}"? They will be notified and gain full platform access.`}
        confirmLabel="Approve" confirmVariant="default" loading={loadingApprove} />

      {/* Reject / Request Info drawer */}
      <Drawer open={confirmReject || confirmRequestInfo}
        onClose={() => { setConfirmReject(false); setConfirmRequestInfo(false); setNote(''); }}
        title={confirmReject ? 'Reject Organisation' : 'Request Information'}
        description={confirmReject
          ? `Provide a reason for rejecting "${org.name}".`
          : `What information do you need from "${org.name}"?`}
        size="sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {confirmReject ? 'Rejection Reason' : 'Information Needed'} *
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder={confirmReject ? 'Explain why this organisation is being rejected...' : 'Describe what information is needed...'}
              className="w-full h-24 px-4 py-3 border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/20" />
            {!note.trim() && <p className="text-xs text-amber-600">A comment is required.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-10 font-bold"
              onClick={() => { setConfirmReject(false); setConfirmRequestInfo(false); setNote(''); }}>Cancel</Button>
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
