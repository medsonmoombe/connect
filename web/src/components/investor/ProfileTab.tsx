'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CapitalPartner } from '@/types';
import { clsx } from 'clsx';

interface ProfileTabProps {
  capProfile: CapitalPartner | null;
  capitalPartnerId: string | null;
  userId: string; // company_id
  onProfileSaved: (data: any, id: string | null) => void;
}

// ── Exact same styles as onboarding ──────────────────────────────────────────
const inputClass = "w-full h-9 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm";
const selectClass = "w-full h-9 px-4 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm appearance-none";
const labelClass = "text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1";

const SECTORS = [
  { value: 'SOLAR', label: 'Solar' },
  { value: 'WIND', label: 'Wind' },
  { value: 'HYDRO', label: 'Hydro' },
  { value: 'BIOMASS', label: 'Biomass' },
  { value: 'GEOTHERMAL', label: 'Geothermal' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'GRID_INFRA', label: 'Grid Infrastructure' },
];

const ZAMBIAN_PROVINCES = [
  'Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka',
  'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western',
];

const CAPITAL_STRUCTURES = [
  { value: 'EQUITY', label: 'Equity' },
  { value: 'PROFIT_SHARING', label: 'Profit Sharing' },
  { value: 'LEASING', label: 'Leasing' },
  { value: 'GRANT', label: 'Grant' },
];

const PROJECT_STAGES = [
  { value: 'CONCEPT', label: 'Concept' },
  { value: 'FEASIBILITY', label: 'Feasibility' },
  { value: 'PERMITTING', label: 'Permitting' },
  { value: 'FINANCIAL_CLOSE', label: 'Financial Close' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'OPERATIONS', label: 'Operations' },
];

const RISK_LEVELS = [
  { value: 'LOW', label: 'Low Risk (Proven tech, signed PPA)' },
  { value: 'MEDIUM', label: 'Medium Risk (Proven tech, merchant risk)' },
  { value: 'HIGH', label: 'High Risk (Emerging tech or frontier market)' },
];

const GOVERNANCE_PREFERENCES = [
  { value: 'PASSIVE', label: 'Passive (No intervention)' },
  { value: 'BOARD_SEAT', label: 'Board Seat' },
  { value: 'ACTIVE_ROLE', label: 'Active Role' },
];

// ── Same MultiSelect as onboarding ────────────────────────────────────────────
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
              <Icons.close className="w-3 h-3" />
            </button>
          );
        })}
      </div>
      <div className="relative">
        <select
          className={clsx(selectClass, "h-8 text-xs")}
          value=""
          onChange={e => { if (e.target.value) toggle(e.target.value); }}
        >
          <option value="">{placeholder ?? 'Select...'}</option>
          {options.filter(o => !selected.includes(o.value)).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

const EMPTY: any = {
  min_ticket_size: '',
  max_ticket_size: '',
  risk_tolerance: '',
  governance_preference: '',
  geographic_focus: [],
  sector_focus: [],
  preferred_project_stage: [],
  preferred_capital_structure: [],
  expected_return_profile: '',
};

export function ProfileTab({ capProfile, capitalPartnerId, userId, onProfileSaved }: ProfileTabProps) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<any>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  // Load from API on mount (always fresh)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_edit_data' }),
        });
        const json = await res.json();
        const p = json?.data?.preferences ?? {};
        setPrefs({
          min_ticket_size: p.min_ticket_size ?? '',
          max_ticket_size: p.max_ticket_size ?? '',
          risk_tolerance: p.risk_tolerance ?? '',
          governance_preference: p.governance_preference ?? '',
          geographic_focus: p.geographic_focus ?? [],
          sector_focus: p.sector_focus ?? [],
          preferred_project_stage: p.preferred_project_stage ?? [],
          preferred_capital_structure: p.preferred_capital_structure ?? [],
          expected_return_profile: p.expected_return_profile ?? '',
        });
      } catch {
        // fall back to capProfile prop if API fails
        if (capProfile) {
          setPrefs({
            min_ticket_size: capProfile.min_ticket_size ?? '',
            max_ticket_size: capProfile.max_ticket_size ?? '',
            risk_tolerance: capProfile.risk_tolerance ?? '',
            governance_preference: capProfile.governance_preference ?? '',
            geographic_focus: capProfile.geographic_focus ?? [],
            sector_focus: capProfile.sector_focus ?? [],
            preferred_project_stage: (capProfile.preferred_project_stage as string[]) ?? [],
            preferred_capital_structure: (capProfile.preferred_capital_structure as string[]) ?? [],
            expected_return_profile: capProfile.expected_return_profile ?? '',
          });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = (key: string, val: any) => setPrefs((p: any) => ({ ...p, [key]: val }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!prefs.sector_focus?.length) { setError('Please select at least one sector focus'); return; }
    if (!prefs.geographic_focus?.length) { setError('Please select at least one geographic focus'); return; }
    if (!prefs.risk_tolerance) { setError('Please select a risk tolerance'); return; }
    if (!prefs.governance_preference) { setError('Please select a governance preference'); return; }
    if (Number(prefs.min_ticket_size) > Number(prefs.max_ticket_size)) { setError('Min ticket size must be ≤ max ticket size'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_preferences',
          role: 'CAPITAL_PARTNER',
          preferences: {
            ...prefs,
            min_ticket_size: Number(prefs.min_ticket_size) || 0,
            max_ticket_size: Number(prefs.max_ticket_size) || 0,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      onProfileSaved(prefs, capitalPartnerId);
      toast.success('Investment preferences saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="p-8 bg-white border border-slate-100 rounded-[32px] space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Investment Preferences</h2>
          <p className="text-sm text-slate-500 mt-1">Update your criteria to improve match accuracy.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-soft space-y-6">

        {/* Ticket Size */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Min Ticket Size (ZMW) *</label>
            <input
              type="number" min={0} required
              value={prefs.min_ticket_size}
              onChange={e => set('min_ticket_size', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Max Ticket Size (ZMW) *</label>
            <input
              type="number" min={0} required
              value={prefs.max_ticket_size}
              onChange={e => set('max_ticket_size', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Sector Focus */}
        <div className="space-y-2">
          <label className={labelClass}>Investment Sector Focus *</label>
          <MultiSelect
            options={SECTORS}
            selected={prefs.sector_focus}
            onChange={v => set('sector_focus', v)}
            placeholder="Select sectors..."
          />
        </div>

        {/* Geographic Focus */}
        <div className="space-y-2">
          <label className={labelClass}>Geographic Focus *</label>
          <MultiSelect
            options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
            selected={prefs.geographic_focus}
            onChange={v => set('geographic_focus', v)}
            placeholder="Select provinces..."
          />
        </div>

        {/* Risk Tolerance */}
        <div className="space-y-2">
          <label className={labelClass}>Risk Tolerance *</label>
          <div className="relative">
            <select
              required className={selectClass}
              value={prefs.risk_tolerance}
              onChange={e => set('risk_tolerance', e.target.value)}
            >
              <option value="">Select risk level...</option>
              {RISK_LEVELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Governance Preference */}
        <div className="space-y-2">
          <label className={labelClass}>Governance Preference *</label>
          <div className="relative">
            <select
              required className={selectClass}
              value={prefs.governance_preference}
              onChange={e => set('governance_preference', e.target.value)}
            >
              <option value="">Select preference...</option>
              {GOVERNANCE_PREFERENCES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Project Stages */}
        <div className="space-y-2">
          <label className={labelClass}>Preferred Project Stages</label>
          <MultiSelect
            options={PROJECT_STAGES}
            selected={prefs.preferred_project_stage}
            onChange={v => set('preferred_project_stage', v)}
            placeholder="Select stages..."
          />
        </div>

        {/* Capital Structures */}
        <div className="space-y-2">
          <label className={labelClass}>Preferred Capital Structures</label>
          <MultiSelect
            options={CAPITAL_STRUCTURES}
            selected={prefs.preferred_capital_structure}
            onChange={v => set('preferred_capital_structure', v)}
            placeholder="Select structures..."
          />
        </div>

        {/* Expected Return */}
        <div className="space-y-2">
          <label className={labelClass}>Expected Return Profile</label>
          <input
            type="text"
            placeholder="e.g. 15-20% IRR"
            value={prefs.expected_return_profile}
            onChange={e => set('expected_return_profile', e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-sm">
            <Icons.alertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-50">
          <Button type="submit" disabled={saving} className="h-10 px-8 rounded-xl font-bold bg-green-800 hover:bg-green-700 text-white">
            {saving ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.check className="size-4" />}
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}
