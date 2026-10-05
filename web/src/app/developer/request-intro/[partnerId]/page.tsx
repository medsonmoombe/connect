'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { projectService } from '@/services/projects';
import { partnerRequestService } from '@/services/partner-requests';
import { Project, Company, PartnerRequestType } from '@/types';
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

export default function RequestIntroPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [partner, setPartner] = useState<Company | null>(null);
  const [requestType, setRequestType] = useState<PartnerRequestType>('quote');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    Promise.all([
      projectService.getDeveloperProjects(user.company_id),
      apiClient.get<{ data: Company }>(`/companies/${partnerId}`),
    ]).then(([projData, partnerData]) => {
      setProjects(projData);
      setPartner(partnerData?.data ?? null);
      if (projData.length > 0) setSelectedProjectId(projData[0].id);
    }).finally(() => setLoading(false));
  }, [user?.company_id, partnerId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleSend = async () => {
    if (!selectedProject || !partner) return;
    setSending(true);
    try {
      await partnerRequestService.create({
        project_id: selectedProject.id,
        partner_company_id: partner.id,
        request_type: requestType,
        message: message.trim() || undefined,
      });
      toast.success('Request sent successfully');
      router.push('/engagements');
    } catch (err: any) {
      const existingId = err?.status === 409 ? String(err?.details?.existing_id ?? '') : '';
      if (existingId) {
        toast.info('A request was already sent to this partner for this project. Opening it.');
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

  if (!partner) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-10">
          <div className="size-14 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Icons.users className="size-6 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-700 mb-1">Partner not found</h4>
          <p className="text-xs text-slate-400 mb-4">This partner profile may have been removed or is not yet available.</p>
          <Link href="/developer/find-partners">
            <Button variant="outline" size="sm" className="rounded-none" icon={<Icons.arrowLeft className="size-3.5" />}>
              Back to Find Partners
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Left: Partner Profile Card ── */}
        <div className="lg:col-span-2">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden sticky top-4">
            {/* Dark green header */}
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              {partner.logo_url ? (
                <img src={partner.logo_url} alt={partner.name} className="size-12 rounded-none object-cover border border-white/15 shrink-0" />
              ) : (
                <div className="size-12 rounded-none bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Icons.building className="size-5 text-emerald-200" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-emerald-200/50 uppercase tracking-widest mb-0.5">Partner Profile</p>
                <h3 className="text-base font-bold text-white truncate">{partner.name}</h3>
                {partner.country && (
                  <p className="text-[10px] font-bold text-emerald-200/70 tracking-wider mt-1 flex items-center gap-1">
                    <Icons.mapPin className="size-3" />
                    {partner.country}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {partner.description && (
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {partner.description.length > 200 ? partner.description.slice(0, 200) + '...' : partner.description}
                </p>
              </div>
            )}

            {/* Details */}
            <div className="px-5 py-4 space-y-2">
              {[
                { label: 'Type', value: partner.type?.replace(/_/g, ' ') || '—' },
                { label: 'Team Size', value: partner.team_size || 'N/A' },
                { label: 'Years Operating', value: partner.years_operating || 'N/A' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{row.label}</span>
                  <span className="text-xs font-bold text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Request Form ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* ── Page Header Card ── */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="bg-[#0b3b24] px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Developer Workspace</p>
                <h1 className="text-lg font-bold text-white tracking-tight">Request Introduction</h1>
                <p className="text-[11px] text-emerald-200/60 mt-1">
                  Send a {requestType} request to <span className="font-bold text-emerald-200">{partner.name}</span>
                </p>
              </div>
              <div className="shrink-0 size-10 bg-white/10 border border-white/15 flex items-center justify-center rounded-none">
                <Icons.send className="size-4 text-emerald-200" />
              </div>
            </div>
          </div>

          {/* ── Project Summary ── */}
          {selectedProject && (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Summary</p>
                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-none">
                  {stageLabel(selectedProject.project_stage)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-slate-100">
                {[
                  { label: 'Name', value: selectedProject.name },
                  { label: 'Size', value: `${selectedProject.project_size_mw} MW` },
                  { label: 'Capital', value: formatCompactCurrency(selectedProject.capital_required) },
                  { label: 'Technology', value: selectedProject.technology_type?.replace(/_/g, ' ') || '—' },
                  { label: 'Location', value: selectedProject.location_country || '—' },
                  { label: 'Stage', value: stageLabel(selectedProject.project_stage) },
                ].map((stat) => (
                  <div key={stat.label} className="px-4 py-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Project Selector ── */}
          {projects.length > 1 && (
            <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Select Project</label>
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

          {/* ── Request Type ── */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Request Type</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'quote', label: 'Quote', icon: Icons.fileText, desc: 'Get a cost estimate' },
                { value: 'meeting', label: 'Meeting', icon: Icons.clock, desc: 'Schedule a call' },
                { value: 'introduction', label: 'Introduce', icon: Icons.users, desc: 'General introduction' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRequestType(opt.value)}
                  className={cn(
                    'p-4 rounded-none border-2 text-center transition-all',
                    requestType === opt.value
                      ? 'border-green-600 bg-green-50'
                      : 'border-slate-200 bg-white hover:border-green-300'
                  )}
                >
                  <div className={cn(
                    'size-9 rounded-none flex items-center justify-center mx-auto mb-2',
                    requestType === opt.value ? 'bg-green-100' : 'bg-slate-100'
                  )}>
                    <opt.icon className={cn('size-4', requestType === opt.value ? 'text-green-600' : 'text-slate-400')} />
                  </div>
                  <p className={cn('text-xs font-bold', requestType === opt.value ? 'text-green-700' : 'text-slate-700')}>
                    {opt.label}
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Message ── */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Message (Optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce your project and explain what you're looking for..."
              className="w-full px-4 py-3 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 text-sm font-medium resize-none"
              rows={4}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-slate-400 font-medium">Briefly describe your needs</p>
              <p className="text-[10px] text-slate-400 font-bold">{message.length}/1000</p>
            </div>
          </div>

          {/* ── Submit Bar ── */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] px-5 py-4 flex items-center justify-between">
            <Link href="/developer/find-partners">
              <Button type="button" variant="outline" disabled={sending} className="rounded-none" icon={<Icons.arrowLeft className="size-3.5" />}>
                Cancel
              </Button>
            </Link>
            <Button
              onClick={handleSend}
              disabled={sending || !selectedProjectId}
              className="bg-green-600 hover:bg-green-700 rounded-none px-6"
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
  );
}
