'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useConsultantData } from '@/hooks/useConsultantData';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { SERVICE_CATEGORIES as BASE_SERVICE_CATEGORIES, SECTORS, ZAMBIAN_PROVINCES } from '@/lib/profile-options';

// ── Option sets (canonical sets + consultant-specific additions) ────────────
const SERVICE_CATEGORIES = [
  ...BASE_SERVICE_CATEGORIES,
  { value: 'TECHNICAL_ADVISORY', label: 'Technical Advisory' },
  { value: 'PROJECT_MANAGEMENT', label: 'Project Management' },
  { value: 'GRID_INTERCONNECTION', label: 'Grid Interconnection Studies' },
  { value: 'DUE_DILIGENCE', label: 'Due Diligence' },
];

const inputClass =
  'w-full h-11 px-3.5 rounded-none border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-[#1f9d55] focus:ring-2 focus:ring-[#1f9d55]/20';

interface ProfileForm {
  service_categories: string[];
  sector_experience: string[];
  specializations: string[];
  regions_operated: string[];
  certifications: string[];
  years_of_experience: number;
  total_projects_completed: number;
  largest_project_mw: number;
  availability: string;
  hourly_rate_range: string;
  project_rate_range: string;
  company_experience_doc_url: string;
  portfolio_doc_url: string;
}

const EMPTY_FORM: ProfileForm = {
  service_categories: [], sector_experience: [], specializations: [],
  regions_operated: [], certifications: [],
  years_of_experience: 0, total_projects_completed: 0, largest_project_mw: 0,
  availability: '', hourly_rate_range: '', project_rate_range: '',
  company_experience_doc_url: '', portfolio_doc_url: '',
};

function MultiSelect({ options, selected, onChange, placeholder, freeText }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  freeText?: boolean;
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
              className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
            >
              {opt?.label ?? val}
              <Icons.close className="size-3" />
            </button>
          );
        })}
      </div>
      <div className="relative">
        <select
          className={cn(inputClass, 'h-9 appearance-none pr-8 text-xs')}
          value=""
          onChange={(e) => { if (e.target.value) toggle(e.target.value); }}
        >
          <option value="">{placeholder ?? 'Add…'}</option>
          {options.filter(o => !selected.includes(o.value)).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icons.chevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
      </div>
      {freeText && (
        <input
          className={cn(inputClass, 'h-9 text-xs')}
          placeholder="Or type a custom value and press Enter…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const v = (e.target as HTMLInputElement).value.trim();
              if (v && !selected.includes(v)) { onChange([...selected, v]); (e.target as HTMLInputElement).value = ''; }
            }
          }}
        />
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
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

export default function ConsultantProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useConsultantData({ engagements: true });
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CONSULTANT' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Hydrate form once profile data arrives
  useEffect(() => {
    const p = data.consultantProfile;
    if (p && !loadedId) {
      hydrateFrom(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.consultantProfile, loadedId]);

  const hydrateFrom = (p: any) => {
    setLoadedId(p.id);
    setForm({
      service_categories: p.service_categories || [],
      sector_experience: p.sector_experience || [],
      specializations: p.specializations || [],
      regions_operated: p.regions_operated || [],
      certifications: p.certifications || [],
      years_of_experience: p.years_of_experience || 0,
      total_projects_completed: p.total_projects_completed || 0,
      largest_project_mw: p.largest_project_mw || 0,
      availability: p.availability || '',
      hourly_rate_range: p.hourly_rate_range || '',
      project_rate_range: p.project_rate_range || '',
      company_experience_doc_url: p.company_experience_doc_url || '',
      portfolio_doc_url: p.portfolio_doc_url || '',
    });
  };

  const set = (patch: Partial<ProfileForm>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  // Completeness meter (10 checks)
  const completeness = useMemo(() => {
    const checks = [
      { done: form.service_categories.length > 0, label: 'Service categories' },
      { done: form.sector_experience.length > 0, label: 'Sector experience' },
      { done: form.specializations.length > 0, label: 'Specializations' },
      { done: form.regions_operated.length > 0, label: 'Regions operated' },
      { done: form.certifications.length > 0, label: 'Certifications' },
      { done: form.years_of_experience > 0, label: 'Years of experience' },
      { done: form.total_projects_completed > 0, label: 'Projects completed' },
      { done: form.largest_project_mw > 0, label: 'Largest project size' },
      { done: form.availability !== '', label: 'Availability status' },
      { done: form.hourly_rate_range !== '' || form.project_rate_range !== '', label: 'Rate indication' },
    ];
    return {
      pct: Math.round((checks.filter(c => c.done).length / checks.length) * 100),
      missing: checks.filter(c => !c.done).map(c => c.label),
    };
  }, [form]);

  const handleSave = async () => {
    if (!user?.company_id) return;
    setSaving(true);
    try {
      // Validated server-side; the table is derived from the company role.
      const res = await fetch('/api/profile/partner-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update profile');
      if (json.data?.id) setLoadedId(json.data.id);
      await data.fetchEngagements();
      setDirty(false);
      toast.success('Consulting profile updated.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const hasProfile = !!data.consultantProfile;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Consulting Profile" />
      <PageHero
        eyebrow="Your Mandate"
        title="How developers find you"
        description="Your expertise, track record and terms are matched against every project on the platform — keep this profile sharp to surface in the right deals."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      {/* Completeness meter */}
      <div className={cn('rounded-none border p-5 shadow-[0_1px_2px_rgba(22,36,28,0.05)]', completeness.pct < 60 ? 'border-amber-200 bg-amber-50/60' : 'border-line bg-white')}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Profile completeness</p>
          <p className={cn('text-lg font-black', completeness.pct < 60 ? 'text-amber-700' : 'text-[#166b3b]')}>{completeness.pct}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-none bg-slate-100">
          <div
            className={cn('h-full rounded-none transition-all', completeness.pct < 60 ? 'bg-amber-500' : 'bg-[#0b3b24]')}
            style={{ width: `${completeness.pct}%` }}
          />
        </div>
        {completeness.missing.length > 0 && (
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            Missing: {completeness.missing.join(' · ')}
          </p>
        )}
      </div>

      {/* Live preview — how developers see you */}
      <div className={cn('overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]')}>
        <div className="border-b border-line bg-slate-50/60 px-[22px] py-[17px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live preview</p>
          <h3 className="mt-0.5 text-[15px] font-bold text-ink">How developers see you</h3>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-3">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Services</p>
            <div className="flex flex-wrap gap-1.5">
              {form.service_categories.length > 0 ? form.service_categories.map(s => (
                <span key={s} className="rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                  {SERVICE_CATEGORIES.find(o => o.value === s)?.label ?? s.replace(/_/g, ' ')}
                </span>
              )) : <span className="text-xs italic text-slate-300">Not set</span>}
            </div>
            <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sectors</p>
            <div className="flex flex-wrap gap-1.5">
              {form.sector_experience.length > 0 ? form.sector_experience.map(s => (
                <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {SECTORS.find(o => o.value === s)?.label ?? s}
                </span>
              )) : <span className="text-xs italic text-slate-300">Not set</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Track record</p>
            <div className="space-y-1.5 text-xs">
              <p className="text-slate-600"><strong className="text-slate-900">{form.years_of_experience}</strong> years · <strong className="text-slate-900">{form.total_projects_completed}</strong> projects completed</p>
              <p className="text-slate-600">Largest project: <strong className="text-slate-900">{form.largest_project_mw} MW</strong></p>
              <p className="text-slate-600">Regions: <strong className="text-slate-900">{form.regions_operated.length > 0 ? form.regions_operated.join(', ') : '—'}</strong></p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Commercial</p>
            <div className="space-y-1.5 text-xs">
              <p className="text-slate-600">Availability: <strong className="text-slate-900 capitalize">{form.availability ? form.availability.toLowerCase() : '—'}</strong></p>
              <p className="text-slate-600">Hourly: <strong className="text-slate-900">{form.hourly_rate_range || '—'}</strong></p>
              <p className="text-slate-600">Per project: <strong className="text-slate-900">{form.project_rate_range || '—'}</strong></p>
              <p className="text-slate-600">Certifications: <strong className="text-slate-900">{form.certifications.length || 0}</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor card */}
      <div className={cn('overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]')}>
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div>
            <p className="text-[10px] font-bold text-g-600 uppercase tracking-widest">Profile</p>
            <h3 className="mt-0.5 text-[15px] font-bold text-ink">Consulting profile editor</h3>
          </div>
          {!hasProfile && (
            <span className="ml-auto rounded-none border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
              New profile will be created on save
            </span>
          )}
        </div>

        <div className="space-y-8 p-6">
          {/* Expertise */}
          <div className="space-y-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Expertise</p>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Service Categories" hint="What you advise on — drives match scoring">
                <MultiSelect options={SERVICE_CATEGORIES} selected={form.service_categories} onChange={v => set({ service_categories: v })} placeholder="Add a service…" />
              </Field>
              <Field label="Sector Experience" hint="Technologies you know deeply">
                <MultiSelect options={SECTORS} selected={form.sector_experience} onChange={v => set({ sector_experience: v })} placeholder="Add a sector…" />
              </Field>
              <Field label="Specializations">
                <MultiSelect
                  options={[]}
                  selected={form.specializations}
                  onChange={v => set({ specializations: v })}
                  freeText
                  placeholder="Add specialization…"
                />
              </Field>
              <Field label="Regions Operated">
                <MultiSelect
                  options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                  selected={form.regions_operated}
                  onChange={v => set({ regions_operated: v })}
                  placeholder="Add a province…"
                  freeText
                />
              </Field>
            </div>
          </div>

          {/* Experience */}
          <div className="space-y-5 border-t border-slate-100 pt-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Track record</p>
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Years of Experience">
                <input type="number" min={0} className={inputClass} value={form.years_of_experience} onChange={e => set({ years_of_experience: parseInt(e.target.value) || 0 })} />
              </Field>
              <Field label="Total Projects Completed">
                <input type="number" min={0} className={inputClass} value={form.total_projects_completed} onChange={e => set({ total_projects_completed: parseInt(e.target.value) || 0 })} />
              </Field>
              <Field label="Largest Project (MW)">
                <input type="number" min={0} step="any" className={inputClass} value={form.largest_project_mw} onChange={e => set({ largest_project_mw: parseFloat(e.target.value) || 0 })} />
              </Field>
            </div>
            <Field label="Certifications">
              <MultiSelect options={[]} selected={form.certifications} onChange={v => set({ certifications: v })} freeText placeholder="Add certification…" />
            </Field>
          </div>

          {/* Availability & pricing */}
          <div className="space-y-5 border-t border-slate-100 pt-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Availability &amp; pricing</p>
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Availability">
                <select className={inputClass} value={form.availability} onChange={e => set({ availability: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="BUSY">Busy</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                </select>
              </Field>
              <Field label="Hourly Rate Range">
                <input className={inputClass} value={form.hourly_rate_range} onChange={e => set({ hourly_rate_range: e.target.value })} placeholder="e.g. $80–$150 / hr" />
              </Field>
              <Field label="Project Rate Range">
                <input className={inputClass} value={form.project_rate_range} onChange={e => set({ project_rate_range: e.target.value })} placeholder="e.g. $20k–$80k" />
              </Field>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-5 border-t border-slate-100 pt-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Credibility documents</p>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Company Experience Document URL">
                <input className={inputClass} value={form.company_experience_doc_url} onChange={e => set({ company_experience_doc_url: e.target.value })} placeholder="https://…" />
              </Field>
              <Field label="Portfolio Document URL">
                <input className={inputClass} value={form.portfolio_doc_url} onChange={e => set({ portfolio_doc_url: e.target.value })} placeholder="https://…" />
              </Field>
            </div>
          </div>
        </div>

        {/* Sticky save bar */}
        {dirty && (
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_16px_rgba(22,36,28,0.06)] backdrop-blur">
            <p className="text-xs font-semibold text-slate-500">
              You have unsaved changes — scores use your saved profile.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (data.consultantProfile) hydrateFrom(data.consultantProfile); setDirty(false); }}
                className="h-9 rounded-none border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-none bg-[#0b3b24] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0d4a2e] disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.checkCircle2 className="size-3.5" />}
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
