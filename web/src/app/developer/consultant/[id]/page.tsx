'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { projectService } from '@/services/projects';
import { partnerRequestService } from '@/services/partner-requests';
import { Project, Company, ConsultantProfile, PartnerRequestType } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { stageLabel } from '@/lib/project-stages';
import { toast } from 'sonner';
import { ProfileDetailSkeleton } from '@/components/ui/skeleton';

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-none bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 capitalize">
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-bold text-slate-800">{value}</span>
    </div>
  );
}

export default function ConsultantProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [consultant, setConsultant] = useState<ConsultantProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [requestType, setRequestType] = useState<PartnerRequestType>('quote');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: consRow }, { data: companyRow }] = await Promise.all([
          apiClient.get<{ data: ConsultantProfile }>(`/companies/${id}?resource=consultant-profile`),
          apiClient.get<{ data: Company }>(`/companies/${id}`),
        ]);
        setConsultant(consRow ?? null);
        setCompany(companyRow ?? null);
        if (user?.company_id) {
          const projData = await projectService.getDeveloperProjects(user.company_id);
          setProjects(projData);
          if (projData.length > 0) setSelectedProjectId(projData[0].id);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load consultant profile');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id, user?.company_id]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleSend = async () => {
    if (!selectedProject || !consultant || !company) return;
    setSending(true);
    try {
      await partnerRequestService.create({
        project_id: selectedProject.id,
        partner_company_id: company.id,
        request_type: requestType,
        message: message.trim() || undefined,
      });
      toast.success('Request sent successfully');
      router.push('/engagements');
    } catch (err: any) {
      const existingId = err?.status === 409 ? String(err?.details?.existing_id ?? '') : '';
      if (existingId) {
        toast.info('A request was already sent to this consultant for this project. Opening it.');
        router.push(`/engagements/${existingId}`);
      } else {
        toast.error(err.message || 'Failed to send request');
      }
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-6"><ProfileDetailSkeleton /></div>;
  }

  if (error || (!consultant && !company)) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-10">
          <div className="size-14 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Icons.users className="size-6 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-700 mb-1">Consultant profile not found</h4>
          <p className="text-xs text-slate-400 mb-4">This consultant profile may have been removed or is not yet available.</p>
          <Link href="/developer/find-partners">
            <Button variant="outline" size="sm" className="rounded-none" icon={<Icons.arrowLeft className="size-3.5" />}>
              Back to Find Partners
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const availabilityColor =
    consultant?.availability === 'AVAILABLE' ? 'bg-green-50 border-green-200 text-green-700'
    : consultant?.availability === 'BUSY' ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-slate-50 border-slate-200 text-slate-500';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Back link ── */}
      <Link
        href="/developer/find-partners"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest transition-colors"
      >
        <Icons.arrowLeft className="size-3.5" />
        Find Partners
      </Link>

      {/* ── Hero Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="bg-[#0b3b24] px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="size-14 rounded-none object-cover border border-white/15 shrink-0" />
            ) : (
              <div className="size-14 rounded-none bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <Icons.briefcase className="size-6 text-emerald-200" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Consultant Profile</p>
              <h1 className="text-xl font-bold text-white tracking-tight truncate">{company?.name || 'Consultant'}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold tracking-wider', availabilityColor)}>
                  <span className="size-1.5 rounded-full bg-current" />
                  {consultant?.availability?.replace(/_/g, ' ') || '—'}
                </span>
                {company?.country && (
                  <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider flex items-center gap-1">
                    <Icons.mapPin className="size-3" />
                    {company.country}
                  </span>
                )}
                {company?.team_size && (
                  <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">{company.team_size} team</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {company?.description && (
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm text-slate-600 font-medium leading-relaxed">{company.description}</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
          {[
            { label: 'Experience', value: `${consultant?.years_of_experience ?? 0} yrs` },
            { label: 'Projects Done', value: consultant?.total_projects_completed ?? 0 },
            { label: 'Largest Project', value: `${consultant?.largest_project_mw || 0} MW` },
            { label: 'Type', value: 'Consultant' },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left Column ── */}
        <div className="space-y-4">
          {/* Company Details */}
          <Section label="Company Details">
            <div className="space-y-1">
              {company?.years_operating && <InfoRow label="Years Operating" value={company.years_operating} />}
              {company?.website && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Website</span>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-green-800 hover:underline truncate max-w-[60%]">{company.website}</a>
                </div>
              )}
            </div>
          </Section>

          {/* Rates */}
          {(consultant?.hourly_rate_range || consultant?.project_rate_range) && (
            <Section label="Rates">
              {consultant?.hourly_rate_range && <InfoRow label="Hourly Rate" value={consultant.hourly_rate_range} />}
              {consultant?.project_rate_range && <InfoRow label="Project Rate" value={consultant.project_rate_range} />}
            </Section>
          )}

          {/* Documents */}
          {(consultant?.company_experience_doc_url || consultant?.portfolio_doc_url) && (
            <Section label="Documents">
              <div className="space-y-2">
                {consultant.company_experience_doc_url && (
                  <a href={consultant.company_experience_doc_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 rounded-none bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                    <Icons.fileText className="size-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Company Experience</span>
                  </a>
                )}
                {consultant.portfolio_doc_url && (
                  <a href={consultant.portfolio_doc_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 rounded-none bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                    <Icons.folder className="size-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Portfolio</span>
                  </a>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Categories */}
          <Section label="Service Categories">
            {consultant?.service_categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {consultant.service_categories.map((s) => (
                  <Chip key={s}>{s.replace(/_/g, ' ').toLowerCase()}</Chip>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic">No services listed.</p>}
          </Section>

          {/* Sector Experience */}
          <Section label="Sector Experience">
            {consultant?.sector_experience?.length ? (
              <div className="flex flex-wrap gap-2">
                {consultant.sector_experience.map((s) => (
                  <Chip key={s}>{s.toLowerCase()}</Chip>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic">No sectors listed.</p>}
          </Section>

          {/* Regions */}
          <Section label="Regions Operated">
            {consultant?.regions_operated?.length ? (
              <div className="flex flex-wrap gap-2">
                {consultant.regions_operated.map((r) => (
                  <Chip key={r}>{r}</Chip>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic">No regions listed.</p>}
          </Section>

          {/* Certifications */}
          <Section label="Certifications">
            {consultant?.certifications?.length ? (
              <div className="flex flex-wrap gap-2">
                {consultant.certifications.map((c) => (
                  <Chip key={c}>{c.toLowerCase()}</Chip>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic">No certifications listed.</p>}
          </Section>

          {/* Specializations */}
          {!!consultant?.specializations?.length && (
            <Section label="Specializations">
              <div className="flex flex-wrap gap-2">
                {consultant.specializations.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </Section>
          )}

          {/* ── Request Engagement Card ── */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Request Engagement</p>
              <Icons.send className="size-3.5 text-emerald-200/40" />
            </div>
            <div className="p-5 space-y-4">
              {projects.length > 1 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Select Project</label>
                  <SearchableSelect
                    value={selectedProjectId}
                    onChange={(val) => setSelectedProjectId(val)}
                    options={projects.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Select project..."
                    label="Select Project"
                    className="w-full"
                  />
                </div>
              )}

              {selectedProject && (
                <div className="rounded-none bg-green-50/50 border border-green-100 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Selected Project</span>
                    <span className="text-xs font-bold text-slate-900">{selectedProject.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-3">
                    <div>
                      <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">Size</p>
                      <p className="text-xs font-black text-slate-900">{selectedProject.project_size_mw} MW</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">Capital</p>
                      <p className="text-xs font-black text-slate-900">{formatCompactCurrency(selectedProject.capital_required)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">Stage</p>
                      <p className="text-xs font-black text-slate-900">{stageLabel(selectedProject.project_stage)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Request Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'quote', label: 'Request Quote', icon: Icons.fileText },
                    { value: 'meeting', label: 'Request Meeting', icon: Icons.clock },
                    { value: 'introduction', label: 'Introduce', icon: Icons.users },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRequestType(opt.value)}
                      className={cn(
                        'p-3 rounded-none border-2 text-center transition-all',
                        requestType === opt.value
                          ? 'border-green-600 bg-green-50'
                          : 'border-slate-200 bg-white hover:border-green-300'
                      )}
                    >
                      <opt.icon className={cn('size-4 mx-auto mb-1', requestType === opt.value ? 'text-green-600' : 'text-slate-400')} />
                      <p className={cn('text-[10px] font-bold', requestType === opt.value ? 'text-green-700' : 'text-slate-700')}>{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Introduce your project and explain which advisory service you need..."
                  className="w-full px-4 py-3 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 text-sm font-medium resize-none"
                  rows={4}
                />
              </div>

              <Button
                onClick={handleSend}
                disabled={sending || !selectedProjectId}
                className="bg-green-600 hover:bg-green-700 w-full rounded-none"
              >
                {sending ? (
                  <>
                    <Icons.spinner className="size-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send {requestType === 'quote' ? 'Quote' : requestType === 'meeting' ? 'Meeting' : 'Intro'} Request
                    <Icons.send className="size-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
