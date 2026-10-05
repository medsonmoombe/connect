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
import { useTraderData, TraderProfileData } from '@/hooks/useTraderData';

// ── Option sets ──────────────────────────────────────────────────────────────
const LICENSE_TYPES = [
  { value: 'TRADING', label: 'Trading' },
  { value: 'BROKERAGE', label: 'Brokerage' },
  { value: 'MARKET_MAKER', label: 'Market Maker' },
];
const TECHNOLOGY_TYPES = [
  { value: 'SOLAR', label: 'Solar' },
  { value: 'WIND', label: 'Wind' },
  { value: 'HYDRO', label: 'Hydro' },
  { value: 'BIOMASS', label: 'Biomass' },
  { value: 'GEOTHERMAL', label: 'Geothermal' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'GRID_INFRA', label: 'Grid Infrastructure' },
];
const REGIONS = [
  'Zambia', 'Kenya', 'Nigeria', 'Ghana', 'Tanzania', 'Uganda', 'Rwanda',
  'Mozambique', 'Zimbabwe', 'Botswana', 'Namibia', 'Malawi', 'Southern Africa', 'East Africa', 'West Africa',
];
const CREDIT_RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'B', 'Not rated'];

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

export default function TraderProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useTraderData({ engagements: true });
  const [profileData, setProfileData] = useState<TraderProfileData>(data.traderProfile);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'POWER_TRADER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Sync from server once the hook loads the stored profile
  useEffect(() => {
    if (!dirty) setProfileData(data.traderProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.traderProfile]);

  const set = (patch: Partial<TraderProfileData>) => {
    setProfileData(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user?.company_id) return;
    setSaving(true);
    try {
      if (!data.traderId) {
        const { data: created, error } = await supabase
          .from('power_traders')
          .insert({ company_id: user.company_id, ...profileData })
          .select()
          .single();
        if (error) throw error;
        if (created) toast.success('Trading profile created — matching will now use it.');
      } else {
        const { error } = await supabase
          .from('power_traders')
          .update(profileData)
          .eq('id', data.traderId);
        if (error) throw error;
        toast.success('Trading profile saved — matching will use your new settings.');
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
      !!profileData.license_type,
      (profileData.max_offtake_capacity_mw ?? 0) > 0,
      (profileData.preferred_technology_types?.length ?? 0) > 0,
      (profileData.regions_of_interest?.length ?? 0) > 0,
      (profileData.min_ppa_duration_years ?? 0) > 0,
      !!profileData.credit_rating_equivalent,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profileData]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Trading Profile" />
      <PageHero
        eyebrow="Offtake Mandate"
        title="Your trading capability record"
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
            <span className="px-2 py-0.5 rounded-full bg-[#e9f6ee] text-[#166b3b] text-[10px] font-bold border border-emerald-100">
              {profileData.license_type?.replace(/_/g, ' ') || 'No license type'}
            </span>
            {profileData.credit_rating_equivalent && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                Rated {profileData.credit_rating_equivalent}
              </span>
            )}
            {profileData.preferred_technology_types.slice(0, 4).map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-center">
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{profileData.max_offtake_capacity_mw || '—'} MW</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Offtake ceiling</p>
            </div>
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{profileData.min_ppa_duration_years ? `${profileData.min_ppa_duration_years} yrs` : '—'}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Min PPA term</p>
            </div>
            <div className="rounded-none border border-slate-100 bg-white p-2.5">
              <p className="text-sm font-black text-slate-900">{profileData.regions_of_interest.length || '—'}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Target regions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6 space-y-8">
        {/* License & capacity */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.shieldCheck className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">License & capacity</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="License Type" required hint="Your trading license category.">
              <select
                className={inputClass}
                value={profileData.license_type}
                onChange={(e) => set({ license_type: e.target.value })}
              >
                {LICENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Max Offtake Capacity (MW)" required hint="Largest volume you can trade at once. Decimals allowed.">
              <input
                type="number" min={0} step="any"
                className={inputClass}
                value={profileData.max_offtake_capacity_mw || ''}
                onChange={(e) => set({ max_offtake_capacity_mw: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 50"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Min PPA Duration (years)" required hint="Shortest power purchase agreement term you accept.">
              <input
                type="number" min={0} step={1}
                className={inputClass}
                value={profileData.min_ppa_duration_years || ''}
                onChange={(e) => set({ min_ppa_duration_years: parseInt(e.target.value) || 0 })}
                placeholder="e.g. 10"
              />
            </Field>
            <Field label="Credit Rating Equivalent" hint="Your investment-grade standing — helps developers gauge counterparty risk.">
              <select
                className={inputClass}
                value={profileData.credit_rating_equivalent}
                onChange={(e) => set({ credit_rating_equivalent: e.target.value })}
              >
                <option value="">Select rating…</option>
                {CREDIT_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Icons.target className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Trading preferences</p>
          </div>
          <Field label="Preferred Technology Types" required hint="Technologies you trade — drives project matching.">
            <MultiSelect options={TECHNOLOGY_TYPES} selected={profileData.preferred_technology_types} onChange={v => set({ preferred_technology_types: v })} placeholder="Add a technology…" />
          </Field>
          <Field label="Regions of Interest" required hint="Markets where you offtake.">
            <MultiSelect options={REGIONS} selected={profileData.regions_of_interest} onChange={v => set({ regions_of_interest: v })} placeholder="Add a region…" />
          </Field>
        </section>
      </div>
    </div>
  );
}
