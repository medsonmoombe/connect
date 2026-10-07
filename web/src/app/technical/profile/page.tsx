'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useTechnicalData } from '@/hooks/useTechnicalData';
import { TechnicalProfileCard } from '@/components/partners/TechnicalProfileCard';
import { toast } from 'sonner';
import { TechnicalPartner } from '@/types';
import { SERVICE_CATEGORIES, SECTORS, ZAMBIAN_PROVINCES, DELIVERY_MODELS } from '@/lib/profile-options';

// ── Option sets ──────────────────────────────────────────────────────────────
const PROJECT_TYPES = [
  'Utility-scale', 'Commercial & Industrial', 'Mini-grid', 'Off-grid', 'Transmission', 'Distribution',
];

const inputClass =
  'w-full h-11 px-3.5 rounded-none border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-[#1f9d55] focus:ring-2 focus:ring-[#1f9d55]/20';

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map(val => {
          const opt = options.find(o => o.value === val);
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
          {options.filter(o => !selected.includes(o.value)).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icons.chevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}{required && <span className="text-red-400">*</span>}
        {hint && (
          <span title={hint} className="inline-flex">
            <Icons.info className="size-3 text-slate-300" />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export default function TechnicalProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useTechnicalData({ engagements: true });
  const [profileData, setProfileData] = useState<Partial<TechnicalPartner>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed local state once the server profile loads
  useEffect(() => {
    if (data.techProfile && !dirty) {
      setProfileData({
        service_categories: data.techProfile.service_categories || [],
        sector_experience: data.techProfile.sector_experience || [],
        min_mw_capacity: data.techProfile.min_mw_capacity || 0,
        max_mw_capacity: data.techProfile.max_mw_capacity || 0,
        regions_operated: data.techProfile.regions_operated || [],
        annual_delivery_capacity_mw: data.techProfile.annual_delivery_capacity_mw || 0,
        total_mw_delivered: data.techProfile.total_mw_delivered || 0,
        largest_project_mw: data.techProfile.largest_project_mw || 0,
        average_delivery_time_months: data.techProfile.average_delivery_time_months || 0,
        bonding_capacity: data.techProfile.bonding_capacity || 0,
        delivery_models: data.techProfile.delivery_models || [],
        payment_terms: data.techProfile.payment_terms || '',
        project_type_experience: data.techProfile.project_type_experience || [],
        min_ticket_size_zmw: data.techProfile.min_ticket_size_zmw || 0,
        max_ticket_size_zmw: data.techProfile.max_ticket_size_zmw || 0,
        years_of_experience: data.techProfile.years_of_experience || 0,
        company_experience_doc_url: data.techProfile.company_experience_doc_url || '',
      });
    }
  }, [data.techProfile, dirty]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const set = (patch: Partial<TechnicalPartner>) => {
    setProfileData(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user?.company_id) return;
    setSaving(true);
    try {
      // Validated server-side; the table is derived from the company role.
      const res = await fetch('/api/profile/partner-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update profile');
      if (json.data) data.handleProfileSaved(json.data as TechnicalPartner, json.data.id ?? null);
      setDirty(false);
      toast.success('Capability profile saved — matching will use your new settings.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const completeness = useMemo(() => {
    const checks = [
      (profileData.service_categories?.length ?? 0) > 0,
      (profileData.sector_experience?.length ?? 0) > 0,
      (profileData.regions_operated?.length ?? 0) > 0,
      (profileData.min_mw_capacity ?? 0) > 0 || (profileData.max_mw_capacity ?? 0) > 0,
      (profileData.years_of_experience ?? 0) > 0,
      (profileData.total_mw_delivered ?? 0) > 0,
      (profileData.bonding_capacity ?? 0) > 0,
      (profileData.delivery_models?.length ?? 0) > 0,
      !!profileData.payment_terms,
      (profileData.project_type_experience?.length ?? 0) > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profileData]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Capability Profile" />
      <PageHero
        eyebrow="Service Profile"
        title="Your engineering capability record"
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

      {/* Current profile card */}
      {data.techProfile && (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Icons.eye className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Live preview</p>
            <span className="text-[10px] text-slate-400">— how developers see your company</span>
          </div>
          <TechnicalProfileCard partner={data.techProfile} />
        </div>
      )}

      {/* Editor */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6 space-y-8">
        {/* Service & experience */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.wrench className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Services & experience</p>
          </div>
          <Field label="Service Categories" required hint="What your company delivers — drives project matching.">
            <MultiSelect options={SERVICE_CATEGORIES} selected={profileData.service_categories ?? []} onChange={v => set({ service_categories: v })} placeholder="Add a service…" />
          </Field>
          <Field label="Sector Experience" hint="Technologies you have delivered.">
            <MultiSelect options={SECTORS} selected={profileData.sector_experience ?? []} onChange={v => set({ sector_experience: v })} placeholder="Add a sector…" />
          </Field>
          <Field label="Project Type Experience" hint="Market segments served.">
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map(t => {
                const active = (profileData.project_type_experience ?? []).includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set({
                      project_type_experience: active
                        ? (profileData.project_type_experience ?? []).filter(x => x !== t)
                        : [...(profileData.project_type_experience ?? []), t],
                    })}
                    className={cn(
                      'px-3 py-1.5 text-xs font-bold border transition-colors',
                      active ? 'bg-[#0b3b24] border-[#0b3b24] text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Regions of Operation" hint="Provinces where you can mobilise.">
            <MultiSelect
              options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
              selected={profileData.regions_operated ?? []}
              onChange={v => set({ regions_operated: v })}
              placeholder="Add a province…"
            />
          </Field>
        </section>

        {/* Capacity envelope */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.gauge className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Capacity envelope</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Min MW Capacity" hint="Smallest project you will take on.">
              <input type="number" min={0} step="any" className={inputClass} value={profileData.min_mw_capacity ?? 0} onChange={e => set({ min_mw_capacity: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Max MW Capacity" hint="Largest project you can execute.">
              <input type="number" min={0} step="any" className={inputClass} value={profileData.max_mw_capacity ?? 0} onChange={e => set({ max_mw_capacity: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Annual Delivery Capacity (MW)">
              <input type="number" min={0} step="any" className={inputClass} value={profileData.annual_delivery_capacity_mw ?? 0} onChange={e => set({ annual_delivery_capacity_mw: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Bonding Capacity (USD)" hint="Maximum surety bond your company can secure.">
              <input type="number" min={0} className={inputClass} value={profileData.bonding_capacity ?? 0} onChange={e => set({ bonding_capacity: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        </section>

        {/* Track record */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.trendingUp className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Track record</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Years of Experience" required>
              <input type="number" min={0} className={inputClass} value={profileData.years_of_experience ?? 0} onChange={e => set({ years_of_experience: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Total MW Delivered">
              <input type="number" min={0} step="any" className={inputClass} value={profileData.total_mw_delivered ?? 0} onChange={e => set({ total_mw_delivered: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Largest Project (MW)">
              <input type="number" min={0} step="any" className={inputClass} value={profileData.largest_project_mw ?? 0} onChange={e => set({ largest_project_mw: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Field label="Average Delivery Time (months)">
            <input type="number" min={0} className={cn(inputClass, 'max-w-xs')} value={profileData.average_delivery_time_months ?? 0} onChange={e => set({ average_delivery_time_months: Number(e.target.value) || 0 })} />
          </Field>
        </section>

        {/* Commercial terms */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.dollarSign className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Commercial terms</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Min Project Size (ZMW)">
              <input type="number" min={0} className={inputClass} value={profileData.min_ticket_size_zmw ?? 0} onChange={e => set({ min_ticket_size_zmw: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Max Project Size (ZMW)">
              <input type="number" min={0} className={inputClass} value={profileData.max_ticket_size_zmw ?? 0} onChange={e => set({ max_ticket_size_zmw: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Field label="Delivery Models" hint="Contract structures you work under.">
            <MultiSelect options={DELIVERY_MODELS} selected={profileData.delivery_models ?? []} onChange={v => set({ delivery_models: v })} placeholder="Add a model…" />
          </Field>
          <Field label="Payment Terms" hint="Milestones, retention, advance payment expectations.">
            <textarea className={cn(inputClass, 'h-24 py-3')} value={profileData.payment_terms ?? ''} onChange={e => set({ payment_terms: e.target.value })} />
          </Field>
          <Field label="Experience Document URL" hint="Link to a company profile, track-record deck, or reference list.">
            <input className={inputClass} value={profileData.company_experience_doc_url ?? ''} onChange={e => set({ company_experience_doc_url: e.target.value })} placeholder="https://…" />
          </Field>
        </section>
      </div>

      {/* Save bar (bottom) */}
      <div className="sticky bottom-4 flex items-center justify-between rounded-none border border-line bg-white px-5 py-3.5 shadow-lg z-10">
        <p className="text-xs font-semibold text-slate-500">
          {dirty ? 'You have unsaved changes.' : completeness < 80 ? 'Tip: profiles above 80% complete match noticeably better.' : 'Profile looking sharp.'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex h-9 items-center gap-2 rounded-none bg-[#0b3b24] px-5 text-[11px] font-bold text-white hover:bg-[#0d4a2e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.check className="size-3.5" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
