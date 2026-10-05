'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useGrantData, GrantProfileData } from '@/hooks/useGrantData';

// ── Option sets ──────────────────────────────────────────────────────────────
const GRANT_TYPES = [
  { value: 'TECHNICAL_ASSISTANCE', label: 'Technical Assistance' },
  { value: 'FEASIBILITY_STUDY', label: 'Feasibility Study' },
  { value: 'CAPITAL_GRANT', label: 'Capital Grant' },
  { value: 'VIABILITY_GAP_FUNDING', label: 'Viability Gap Funding' },
  { value: 'RESULT_BASED_FINANCING', label: 'Result-Based Financing' },
  { value: 'RESEARCH_DEVELOPMENT', label: 'Research & Development' },
  { value: 'INCUBATION_ACCELERATION', label: 'Incubation / Acceleration' },
];
const SECTORS = [
  { value: 'SOLAR', label: 'Solar' },
  { value: 'WIND', label: 'Wind' },
  { value: 'HYDRO', label: 'Hydro' },
  { value: 'BIOMASS', label: 'Biomass' },
  { value: 'GEOTHERMAL', label: 'Geothermal' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'GRID_INFRA', label: 'Grid Infrastructure' },
  { value: 'CLEAN_COOKING', label: 'Clean Cooking' },
  { value: 'ENERGY_EFFICIENCY', label: 'Energy Efficiency' },
];
const GEOGRAPHIES = [
  'Zambia', 'Kenya', 'Nigeria', 'Ghana', 'Tanzania', 'Uganda', 'Rwanda',
  'Mozambique', 'Zimbabwe', 'Botswana', 'Namibia', 'Malawi', 'Sub-Saharan Africa',
];

const inputClass =
  'w-full h-11 px-3.5 rounded-none border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-[#1f9d55] focus:ring-2 focus:ring-[#1f9d55]/20';

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: { value: string; label: string }[] | string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const normalized = (options as any[]).map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map(val => {
          const opt = normalized.find(o => o.value === val);
          return (
            <button
              key={val}
              type="button"
              onClick={() => toggle(val)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
            >
              {opt?.label ?? val}
              <Icons.close className="size-3" />
            </button>
          );
        })}
      </div>
      <div className="relative">
        <select
          className={cn(inputClass, 'h-9 text-xs appearance-none pr-8')}
          value=""
          onChange={(e) => { if (e.target.value) toggle(e.target.value); }}
        >
          <option value="">{placeholder ?? 'Add…'}</option>
          {normalized.filter(o => !selected.includes(o.value)).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icons.chevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && (
          <span className="relative group inline-flex">
            <Icons.info className="size-3 text-slate-300 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] font-medium leading-4 rounded-none z-10">
              {hint}
            </span>
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export default function GrantProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useGrantData({ engagements: true });
  const [profileData, setProfileData] = useState<GrantProfileData>(data.grantProfile);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'GRANT_PROVIDER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Sync from server once the hook loads the stored profile
  useEffect(() => {
    if (!dirty) setProfileData(data.grantProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.grantProfile]);

  const set = (patch: Partial<GrantProfileData>) => {
    setProfileData(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user?.company_id) return;
    setSaving(true);
    try {
      if (!data.grantProviderId) {
        const { data: created, error } = await supabase
          .from('grant_providers')
          .insert({ company_id: user.company_id, ...profileData })
          .select()
          .single();
        if (error) throw error;
        if (created) toast.success('Funding profile created — matching will now use it.');
      } else {
        const { error } = await supabase
          .from('grant_providers')
          .update(profileData)
          .eq('id', data.grantProviderId);
        if (error) throw error;
        toast.success('Funding profile saved — matching will use your new settings.');
      }
      setDirty(false);
      await data.fetchEngagements();
    } catch {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const completeness = useMemo(() => {
    const checks = [
      (profileData.grant_types?.length ?? 0) > 0,
      (profileData.min_grant_size ?? 0) > 0,
      (profileData.max_grant_size ?? 0) > 0,
      (profileData.max_grant_size ?? 0) >= (profileData.min_grant_size ?? 0) && (profileData.max_grant_size ?? 0) > 0,
      (profileData.focus_sectors?.length ?? 0) > 0,
      (profileData.geographic_focus?.length ?? 0) > 0,
      !!profileData.eligibility_criteria,
      !!profileData.application_process,
      (profileData.typical_timeline_months ?? 0) > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profileData]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const money = (n: number) => {
    if (!n || !isFinite(n)) return 'Not set';
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${n}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Funding Profile" />
      <PageHero
        eyebrow="Grant Mandate"
        title="Your funding criteria record"
        description="This profile drives the matching engine — the more complete and accurate it is, the stronger your project matches."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      {/* Status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 rounded-none border border-line bg-white px-5 py-3 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-black text-slate-900">{completeness}%</p>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">complete</span>
            </div>
            <div className="mt-1 w-36 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', completeness >= 80 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${completeness}%` }} />
            </div>
          </div>
          <span className="w-px h-8 bg-slate-100" />
          <p className="text-[11px] text-slate-500 max-w-[240px] leading-4">
            {completeness >= 80 ? 'Strong profile — you are getting the best match quality.' : 'Fill the gaps below to sharpen your match scores.'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex h-10 items-center gap-2 rounded-none bg-[#0b3b24] px-6 text-[11px] font-bold text-white transition-colors hover:bg-[#0d4a2e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.check className="size-3.5" />}
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'All changes saved'}
        </button>
      </div>

      {/* Live preview card */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icons.eye className="size-4 text-[#166b3b]" />
          <p className="text-sm font-bold text-slate-900">Live preview</p>
          <span className="text-[10px] text-slate-400">— how developers see your mandate</span>
        </div>
        <div className="rounded-none border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {profileData.grant_types.slice(0, 4).map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-[#e9f6ee] text-[#166b3b] text-[10px] font-bold border border-emerald-100">
                {(GRANT_TYPES.find(g => g.value === t)?.label ?? t).replace(/_/g, ' ')}
              </span>
            ))}
            {profileData.grant_types.length === 0 && <span className="text-[11px] text-slate-400">No grant types configured</span>}
          </div>
          <div className="grid sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{money(profileData.min_grant_size)}–{money(profileData.max_grant_size)}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Ticket range</p>
            </div>
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{profileData.focus_sectors.length || '—'}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Sectors</p>
            </div>
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{profileData.geographic_focus.length || '—'}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Geographies</p>
            </div>
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{profileData.typical_timeline_months ? `${profileData.typical_timeline_months} mo` : '—'}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Decision cycle</p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6 space-y-8">
        {/* Grant mandate */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.landmark className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Grant mandate</p>
          </div>
          <Field label="Grant Types" required hint="The kinds of funding you provide — drives project matching.">
            <MultiSelect options={GRANT_TYPES} selected={profileData.grant_types} onChange={v => set({ grant_types: v })} placeholder="Add a grant type…" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Min Grant Size (USD)" required hint="Smallest ticket you write. Use plain numbers, e.g. 50000.">
              <input
                type="number" min={0} step="any"
                className={inputClass}
                value={profileData.min_grant_size || ''}
                onChange={(e) => set({ min_grant_size: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 50000"
              />
            </Field>
            <Field label="Max Grant Size (USD)" required hint="Largest single grant you can approve.">
              <input
                type="number" min={0} step="any"
                className={inputClass}
                value={profileData.max_grant_size || ''}
                onChange={(e) => set({ max_grant_size: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 2000000"
              />
            </Field>
          </div>
          <Field label="Typical Decision Timeline (months)" hint="From application to disbursement — helps developers plan.">
            <input
              type="number" min={0} step={1}
              className={cn(inputClass, 'max-w-[200px]')}
              value={profileData.typical_timeline_months || ''}
              onChange={(e) => set({ typical_timeline_months: parseInt(e.target.value) || 0 })}
              placeholder="e.g. 6"
            />
          </Field>
        </section>

        {/* Focus */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.target className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Focus areas</p>
          </div>
          <Field label="Focus Sectors" required hint="Technologies your mandate covers.">
            <MultiSelect options={SECTORS} selected={profileData.focus_sectors} onChange={v => set({ focus_sectors: v })} placeholder="Add a sector…" />
          </Field>
          <Field label="Geographic Focus" required hint="Countries or regions where you fund.">
            <MultiSelect options={GEOGRAPHIES} selected={profileData.geographic_focus} onChange={v => set({ geographic_focus: v })} placeholder="Add a geography…" />
          </Field>
        </section>

        {/* Process */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.clipboardCheck className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Process & criteria</p>
          </div>
          <Field label="Eligibility Criteria" required hint="What makes a project eligible — sector, stage, size, outcomes.">
            <textarea
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-none border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#1f9d55] focus:ring-2 focus:ring-[#1f9d55]/20 resize-none"
              value={profileData.eligibility_criteria}
              onChange={(e) => set({ eligibility_criteria: e.target.value })}
              placeholder="e.g. Projects between 0.5–10 MW in Sub-Saharan Africa with a confirmed site and community engagement plan. Early-stage feasibility through construction."
            />
          </Field>
          <Field label="Application Process" required hint="Step-by-step: how does a developer apply, and what do they submit?">
            <textarea
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-none border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#1f9d55] focus:ring-2 focus:ring-[#1f9d55]/20 resize-none"
              value={profileData.application_process}
              onChange={(e) => set({ application_process: e.target.value })}
              placeholder="e.g. 1) Express interest via engagement. 2) Submit concept note (max 5 pages). 3) Full application with financial model. 4) Due diligence and board approval."
            />
          </Field>
        </section>
      </div>
    </div>
  );
}
