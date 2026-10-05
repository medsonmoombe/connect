'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Badge, BadgeVariant } from '@/components/ui/badge';
import { PageHero } from '@/components/ui/PageHero';
import { SectionCard } from '@/components/ui/SectionCard';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

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
  id: string;
  name: string;
  primary_role: string;
  country: string;
  location?: string;
  status: OrgStatus;
  created_at: string;
  updated_at?: string;
  admin_note?: string;
  description?: string;
  website?: string;
  team_size?: number;
  size?: number;
  years_operating?: number;
  logo_url?: string;
  registration_number?: string;
  ownership_structure?: string;
  ownership_details?: string;
  contact_email?: string;
  contact_phone?: string;
  management_experience_summary?: string;
  management_team_experience?: Record<string, any>;
  is_new_company_with_experienced_team?: boolean;
  is_authority_org?: boolean;
  project_submission_mode?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  preferences?: Record<string, any> | null;
  company_members: OrgMember[];
  projects?: { id: string; name: string; technology_type: string; status: string; location_country?: string; created_at: string }[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string; chip: string }> = {
  pending_verification: { variant: 'yellow', label: 'Pending Review', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified:             { variant: 'green',  label: 'Verified',        chip: 'bg-green-50 text-green-700 border-green-200' },
  rejected:             { variant: 'red',    label: 'Rejected',        chip: 'bg-red-50 text-red-600 border-red-200' },
  needs_update:         { variant: 'orange', label: 'Needs Update',    chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  deactivated:          { variant: 'slate',  label: 'Deactivated',     chip: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: 'Project Developer', CAPITAL_PARTNER: 'Financier',
  TECHNICAL_PARTNER: 'EPC / Operator', CONSULTANT: 'Consultant',
  POWER_TRADER: 'Power Trader', GRANT_PROVIDER: 'Grant Provider',
};

const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:       { label: 'Draft',        cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  under_review:{ label: 'Under Review', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
  scoring:     { label: 'Scoring',      cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  pending_live:{ label: 'Pending Live', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  live:        { label: 'Live',         cls: 'bg-green-50 text-green-700 border-green-200' },
  paused:      { label: 'Paused',       cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  deactivated: { label: 'Deactivated',  cls: 'bg-red-50 text-red-600 border-red-100' },
  archived:    { label: 'Archived',     cls: 'bg-slate-50 text-slate-400 border-slate-200' },
};

const MEMBER_ROLE_META: Record<string, { label: string; cls: string }> = {
  OWNER:  { label: 'Owner',  cls: 'bg-brand-soft text-brand-text' },
  ADMIN:  { label: 'Admin',  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  MEMBER: { label: 'Member', cls: 'bg-slate-100 text-slate-600' },
};

/** camelCase / snake_case key → readable label */
function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Human formatting for preference values. */
function formatPrefValue(v: any): string | null {
  if (v === null || v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0)) return null;
  if (Array.isArray(v)) return v.map(x => prettyKey(String(x))).join(', ');
  if (typeof v === 'object') {
    const entries = Object.entries(v).filter(([, val]) => val !== null && val !== '' && val !== false);
    if (entries.length === 0) return null;
    return entries.map(([k, val]) => `${prettyKey(k)}: ${Array.isArray(val) ? val.join(', ') : String(val)}`).join(' · ');
  }
  if (typeof v === 'number' && v >= 1000) return new Intl.NumberFormat('en-US').format(v);
  return prettyKey(String(v));
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-100">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <div className="text-sm font-bold text-slate-900 break-words">{value}</div>
    </div>
  );
}

function formatCapital(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [org, setOrg] = useState<OrgRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/organizations/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load organisation');
        if (!cancelled) setOrg(json.data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-[76px] bg-surface-2" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-slate-200 bg-white">
              <div className="h-8 bg-surface-2" />
              <div className="h-14 bg-slate-50" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="h-64 bg-slate-50 border border-slate-200" />
          <div className="h-64 bg-slate-50 border border-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="space-y-6">
        <PageHero eyebrow="Admin · Organisations" title="Organisation" description="Organisation details." />
        <div className="border border-slate-200 bg-white p-16 text-center">
          <Icons.alertTriangle className="size-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">{error || 'Organisation not found'}</p>
          <Link href="/admin/companies" className="inline-block mt-4 text-xs font-bold text-[#0b3b24] hover:underline">
            ← Back to All Organisations
          </Link>
        </div>
      </div>
    );
  }

  const status = STATUS_BADGE[org.status] ?? { variant: 'slate' as BadgeVariant, label: org.status, chip: 'bg-slate-50 text-slate-500 border-slate-200' };
  const owner = org.company_members?.find(m => m.role === 'OWNER')?.user_profiles ?? null;
  const members = org.company_members ?? [];
  const projects = org.projects ?? [];
  const liveProjects = projects.filter(p => p.status === 'live').length;
  const memberCount = org.team_size ?? org.size ?? members.length;
  const orgAge = org.created_at ? Math.floor((Date.now() - new Date(org.created_at).getTime()) / 86400000) : 0;
  const prefEntries = org.preferences
    ? Object.entries(org.preferences).filter(([k, v]) => !['id', 'company_id', 'created_at', 'updated_at'].includes(k) && formatPrefValue(v) !== null)
    : [];
  const mgmtEntries = org.management_team_experience && typeof org.management_team_experience === 'object'
    ? Object.entries(org.management_team_experience).filter(([, v]) => v !== null && v !== '' && v !== false && (!Array.isArray(v) || v.length > 0))
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHero
        eyebrow="Admin · Organisations"
        title={org.name}
        description={`${ROLE_LABELS[org.primary_role] ?? org.primary_role} · ${org.country}${org.location ? ` · ${org.location}` : ''}`}
        topLeft={
          <Link href="/admin/companies" className="text-[11px] font-bold text-emerald-200/70 hover:text-white transition-colors inline-flex items-center gap-1">
            <Icons.arrowLeft className="size-3" /> All Organisations
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold border', status.chip)}>
              <span className="size-1.5 rounded-full bg-current" />
              {status.label}
            </span>
            {org.is_authority_org && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                <Icons.shieldCheck className="size-3" /> Regulator
              </span>
            )}
          </div>
        }
      />

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Members</span>
            <Icons.users className="size-3.5 text-white/40" />
          </div>
          <div className="px-4 pb-4 pt-1"><p className="text-2xl font-bold tracking-tight text-slate-900">{memberCount}</p></div>
        </div>
        <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Projects</span>
            <Icons.folder className="size-3.5 text-white/40" />
          </div>
          <div className="px-4 pb-4 pt-1">
            <p className="text-2xl font-bold tracking-tight text-slate-900">{projects.length}</p>
            {projects.length > 0 && <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{liveProjects} live</p>}
          </div>
        </div>
        <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Years Operating</span>
            <Icons.clock className="size-3.5 text-white/40" />
          </div>
          <div className="px-4 pb-4 pt-1"><p className="text-2xl font-bold tracking-tight text-slate-900">{org.years_operating ?? 0}</p></div>
        </div>
        <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">On Platform</span>
            <Icons.clock className="size-3.5 text-white/40" />
          </div>
          <div className="px-4 pb-4 pt-1">
            <p className="text-2xl font-bold tracking-tight text-slate-900">{orgAge >= 365 ? `${Math.floor(orgAge / 365)}y` : `${orgAge}d`}</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
              {org.created_at ? new Date(org.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column: identity + description ──────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Profile */}
          <SectionCard eyebrow="Profile" title="Organisation Details">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="size-14 border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {org.logo_url
                    ? <img src={org.logo_url} alt="" className="size-full object-cover" />
                    : <span className="text-lg font-bold text-slate-400">{org.name.substring(0, 2).toUpperCase()}</span>}
                </div>
                {org.description && (
                  <p className="text-[13px] text-slate-600 leading-relaxed flex-1">{org.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <InfoTile label="Primary Role" value={ROLE_LABELS[org.primary_role] ?? org.primary_role} />
                <InfoTile label="Country" value={org.country || '—'} />
                <InfoTile label="Region" value={org.location || '—'} />
                <InfoTile label="Team Size" value={org.team_size ?? org.size ?? '—'} />
                <InfoTile label="Years Operating" value={org.years_operating ?? '—'} />
                <InfoTile label="Registration No." value={org.registration_number || '—'} />
                <InfoTile label="Contact Email" value={org.contact_email || '—'} />
                <InfoTile label="Contact Phone" value={org.contact_phone || '—'} />
                <InfoTile label="Submission Mode" value={org.project_submission_mode?.replace(/_/g, ' ') ?? 'direct'} />
              </div>

              {org.website && (
                <a href={org.website} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b3b24] hover:underline">
                  <Icons.globe className="size-3.5" /> {org.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </SectionCard>

          {/* Ownership */}
          {(org.ownership_structure || org.ownership_details) && (
            <SectionCard eyebrow="Structure" title="Ownership">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {org.ownership_structure && (
                  <InfoTile label="Ownership Structure" value={prettyKey(org.ownership_structure)} />
                )}
                {org.ownership_details && (
                  <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ownership Details</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{org.ownership_details}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Management experience */}
          {(mgmtEntries.length > 0 || org.management_experience_summary || org.is_new_company_with_experienced_team) && (
            <SectionCard eyebrow="Governance" title="Management Experience">
              <div className="space-y-3">
                {org.is_new_company_with_experienced_team && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                    New company · experienced team
                  </span>
                )}
                {org.management_experience_summary && (
                  <p className="text-[13px] text-slate-600 leading-relaxed">{org.management_experience_summary}</p>
                )}
                {mgmtEntries.length > 0 && (
                  <div className="p-4 border border-slate-100 bg-slate-50">
                    {mgmtEntries.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">{prettyKey(k)}</span>
                        <span className="text-sm text-slate-700 text-right">{Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : prettyKey(String(v))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Matching preferences */}
          {prefEntries.length > 0 ? (
            <SectionCard
              eyebrow="Matching Engine"
              title={`${ROLE_LABELS[org.primary_role] ?? org.primary_role} Preferences`}
              trailing={<span className="text-[10px] font-semibold text-emerald-200/60">used by matching</span>}
            >
              <div className="p-4 border border-slate-100 bg-slate-50">
                {prefEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">{prettyKey(k)}</span>
                    <span className="text-sm text-slate-700 text-right">{formatPrefValue(v)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : org.primary_role !== 'DEVELOPER' && (
            <SectionCard eyebrow="Matching Engine" title="Preferences">
              <div className="p-8 text-center">
                <Icons.settings className="size-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No preferences configured</p>
                <p className="text-xs text-slate-400 mt-1">This organisation has not completed its preference setup.</p>
              </div>
            </SectionCard>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <SectionCard
              eyebrow="Portfolio"
              title="Projects"
              trailing={<span className="text-[11px] font-semibold text-emerald-200/60">{projects.length} total</span>}
              bodyClassName="p-0"
            >
              <div className="divide-y divide-slate-50">
                {projects.map(p => {
                  const st = PROJECT_STATUS_META[p.status] ?? { label: p.status, cls: 'bg-slate-50 text-slate-500 border-slate-200' };
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`} target="_blank"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                      <div className="size-8 bg-slate-100 flex items-center justify-center shrink-0">
                        <Icons.zap className="size-3.5 text-slate-400 group-hover:text-[#0b3b24]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 group-hover:text-[#0b3b24] truncate transition-colors">{p.name}</p>
                        <p className="text-[11px] text-slate-400">{p.technology_type}{p.location_country ? ` · ${p.location_country}` : ''}</p>
                      </div>
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold border shrink-0', st.cls)}>
                        <span className="size-1.5 rounded-full bg-current" />{st.label}
                      </span>
                      <Icons.arrowUpRight className="size-3.5 text-slate-300 group-hover:text-[#0b3b24] shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Right column: people + admin ─────────────────────── */}
        <div className="space-y-5">
          {/* Owner card */}
          {owner && (
            <SectionCard eyebrow="Leadership" title="Organisation Owner">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-text shrink-0">
                  <span className="text-xs font-bold text-white">
                    {(owner.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{owner.full_name || '—'}</p>
                  <p className="text-xs text-slate-500 truncate">{owner.email || '—'}</p>
                  {owner.job_title && <p className="text-[11px] text-slate-400 mt-0.5">{owner.job_title}</p>}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Members */}
          <SectionCard
            eyebrow="People"
            title="Team Members"
            trailing={<span className="text-[11px] font-semibold text-emerald-200/60">{members.length}</span>}
            bodyClassName="p-0"
          >
            {members.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No members yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {members.map(m => {
                  const roleMeta = MEMBER_ROLE_META[m.role] ?? MEMBER_ROLE_META.MEMBER;
                  return (
                    <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                      <div className="size-8 bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-500">
                          {(m.user_profiles?.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{m.user_profiles?.full_name || 'Unknown'}</p>
                        <p className="text-[11px] text-slate-400 truncate">{m.user_profiles?.email || '—'}</p>
                      </div>
                      <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 shrink-0', roleMeta.cls)}>
                        {roleMeta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Admin timeline */}
          <SectionCard eyebrow="Administration" title="Review Timeline">
            <div className="space-y-0">
              <div className="flex items-start gap-3 py-2">
                <span className="size-2 rounded-full bg-brand shrink-0 mt-1.5" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Registered</p>
                  <p className="text-[11px] text-slate-400">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
              {org.reviewed_at && (
                <div className="flex items-start gap-3 py-2">
                  <span className={cn('size-2 rounded-full shrink-0 mt-1.5', org.status === 'verified' ? 'bg-green-500' : org.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400')} />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Last review: {status.label}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(org.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
              {org.updated_at && org.updated_at !== org.created_at && (
                <div className="flex items-start gap-3 py-2">
                  <span className="size-2 rounded-full bg-slate-300 shrink-0 mt-1.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Last updated</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(org.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Admin note */}
          {org.admin_note && (
            <div className="border border-amber-100 bg-amber-50 p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Admin Note</p>
              <p className="text-sm text-amber-800 leading-relaxed">{org.admin_note}</p>
            </div>
          )}

          {/* Quick actions */}
          <SectionCard eyebrow="Actions" title="Manage">
            <div className="space-y-2">
              <Link href={`/admin/verification/${org.id}`} className="block">
                <Button variant="outline" className="w-full h-9 border-slate-200 text-slate-600 font-bold text-xs justify-start">
                  <Icons.shieldCheck className="size-3.5 mr-2" />Open Verification Review
                </Button>
              </Link>
              <Link href="/admin/companies" className="block">
                <Button variant="outline" className="w-full h-9 border-slate-200 text-slate-600 font-bold text-xs justify-start">
                  <Icons.arrowLeft className="size-3.5 mr-2" />Back to Directory
                </Button>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
