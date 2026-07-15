'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { onboardingApi, companiesApi } from '@/services/api';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Company, CompanyType } from '@/types';
import { clsx } from 'clsx';

type OnboardingStep = 'profile' | 'company' | 'preferences' | 'complete';

const COMPANY_TYPES: { value: CompanyType; label: string; description: string }[] = [
  { value: 'DEVELOPER', label: 'Project Developer', description: 'Develop and own energy infrastructure projects seeking capital' },
  { value: 'CAPITAL', label: 'Capital Partner', description: 'Investment firms deploying capital into energy projects' },
  { value: 'TECHNICAL', label: 'Technical Partner', description: 'EPC, O&M, and advisory service providers' },
  { value: 'POWER_TRADER', label: 'Power Trader', description: 'Offtake and power purchase agreements' },
];

const COUNTRIES = [
  'Zambia', 'Democratic Republic of Congo', 'Zimbabwe', 'Mozambique', 'Botswana',
  'Namibia', 'Malawi', 'Angola', 'Tanzania', 'Kenya', 'Nigeria', 'South Africa',
  'Ghana', 'Uganda', 'Rwanda', 'Senegal', 'Ethiopia', 'Egypt',
];

const ZAMBIAN_PROVINCES = [
  'Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka',
  'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western',
];

const SECTORS = [
  { value: 'SOLAR', label: 'Solar' },
  { value: 'WIND', label: 'Wind' },
  { value: 'HYDRO', label: 'Hydro' },
  { value: 'BIOMASS', label: 'Biomass' },
  { value: 'GEOTHERMAL', label: 'Geothermal' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'GRID_INFRA', label: 'Grid Infrastructure' },
];

const SERVICE_CATEGORIES = [
  { value: 'EPC', label: 'EPC (Engineering, Procurement, Construction)' },
  { value: 'O_M', label: 'O&M (Operations & Maintenance)' },
  { value: 'FEASIBILITY_STUDY', label: 'Feasibility Study' },
  { value: 'ENVIRONMENTAL_IMPACT', label: 'Environmental Impact Assessment' },
  { value: 'LEGAL_ADVISORY', label: 'Legal Advisory' },
  { value: 'FINANCIAL_ADVISORY', label: 'Financial Advisory' },
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

const DELIVERY_MODELS = [
  { value: 'FIXED_PRICE', label: 'Fixed Price' },
  { value: 'TIME_MATERIALS', label: 'Time & Materials' },
  { value: 'COST_PLUS', label: 'Cost Plus' },
  { value: 'BOOT', label: 'BOOT (Build-Own-Operate-Transfer)' },
  { value: 'BOO', label: 'BOO (Build-Own-Operate)' },
];

const inputClass = "w-full h-9 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm";
const selectClass = "w-full h-9 px-4 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm appearance-none";
const labelClass = "text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1";
const smallInputClass = "w-full h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-xs";

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.length > 0 && selected.map(val => {
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
          onChange={(e) => { if (e.target.value) toggle(e.target.value); }}
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

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile
  const [fullName, setFullName] = useState(user?.full_name || '');

  // Company search
  const [companySearch, setCompanySearch] = useState('');
  const [foundCompanies, setFoundCompanies] = useState<Company[]>([]);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // New company form
  const [companyType, setCompanyType] = useState<CompanyType>(
    user?.role === 'ADMIN' ? 'DEVELOPER'
      : user?.role === 'CAPITAL_PARTNER' ? 'CAPITAL'
      : user?.role === 'TECHNICAL_PARTNER' ? 'TECHNICAL'
      : user?.role === 'POWER_TRADER' ? 'POWER_TRADER'
      : 'DEVELOPER'
  );
  const [newCompany, setNewCompany] = useState({
    name: '',
    country: 'Zambia',
    countryOther: '',
    description: '',
    website: '',
    years_operating: '' as string | number,
    team_size: '' as string | number,
    is_new_company_with_experienced_team: false,
    management_team_experience: { years: 0 as number, description: '' },
  });

  const [preferences, setPreferences] = useState<any>({});

  const getCountry = () => newCompany.country === 'OTHER' ? newCompany.countryOther : newCompany.country;

  const updateManagementExperience = (years: number) => {
    const yearsOperating = Number(newCompany.years_operating || 0);
    setNewCompany({
      ...newCompany,
      management_team_experience: { ...newCompany.management_team_experience, years },
      is_new_company_with_experienced_team: yearsOperating < 2 && years >= 5,
    });
  };

  const validateCompany = (): string | null => {
    if (!newCompany.name.trim()) return 'Company name is required';
    if (newCompany.country === 'OTHER' && !newCompany.countryOther.trim()) return 'Please specify your country';
    if (newCompany.description.length < 30) return 'Company description must be at least 30 characters';
    return null;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);
    const { error } = await onboardingApi.completeUserProfile(user.id, { full_name: fullName });
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      await refreshUser();
      setLoading(false);
      setStep('company');
    }
  };

  const searchCompanies = async () => {
    if (companySearch.length < 2) return;
    const { data } = await companiesApi.getAdminAll({ search: companySearch });
    if (data) setFoundCompanies(data);
  };

  const handleJoinCompany = async (companyId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { error } = await onboardingApi.joinCompany(user.id, companyId);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      await refreshUser();
      if (companyType === 'CAPITAL' || companyType === 'TECHNICAL' || companyType === 'POWER_TRADER') {
        setStep('preferences');
      } else {
        setStep('complete');
      }
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const validationError = validateCompany();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    const managementYears = Number(newCompany.management_team_experience?.years || 0);
    const companyData = {
      ...newCompany,
      country: getCountry(),
      type: companyType,
      years_operating: Number(newCompany.years_operating || 0),
      team_size: Number(newCompany.team_size || 0),
      is_new_company_with_experienced_team: Number(newCompany.years_operating || 0) < 2 && managementYears >= 5,
    };
    // @ts-ignore
    delete companyData.countryOther;
    if (!companyData.website) {
      // @ts-ignore
      delete companyData.website;
    }

    const result = await onboardingApi.setupCompany(user.id, companyData as any);
    if ('error' in result && result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      await refreshUser();
      if (companyType === 'CAPITAL' || companyType === 'TECHNICAL' || companyType === 'POWER_TRADER') {
        setStep('preferences');
      } else {
        setStep('complete');
      }
      setLoading(false);
    }
  };

  const handlePreferenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.company_id) return;
    setLoading(true);
    setError(null);
    const role = companyType === 'CAPITAL' ? 'CAPITAL_PARTNER'
      : companyType === 'TECHNICAL' ? 'TECHNICAL_PARTNER'
      : companyType === 'POWER_TRADER' ? 'POWER_TRADER'
      : 'DEVELOPER';
    const { error } = await onboardingApi.saveRolePreferences(role, user.company_id, preferences);
    setLoading(false);
    if (error) setError(error);
    else setStep('complete');
  };

  const finishOnboarding = async () => {
    setLoading(true);
    await onboardingApi.completeOnboarding();
    await refreshUser();
    setLoading(false);
    router.push('/dashboard');
  };

  const needsPreferences = companyType === 'CAPITAL' || companyType === 'TECHNICAL' || companyType === 'POWER_TRADER';
  const steps = ['profile', 'company', ...(needsPreferences ? ['preferences'] : []), 'complete'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Progress Stepper */}
      <div className="flex justify-between mb-8 px-4">
        {steps.map((s, idx) => {
          const isDone = steps.indexOf(step) > idx;
          const isActive = step === s;
          return (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                isDone ? "bg-green-800 text-white" : isActive ? "ring-2 ring-green-800 ring-offset-2 bg-white text-green-800" : "bg-slate-200 text-slate-400"
              )}>
                {isDone ? "✓" : idx + 1}
              </div>
              <span className={clsx("text-[10px] uppercase tracking-wider font-bold capitalize", isActive ? "text-green-800" : "text-slate-400")}>
                {s}
              </span>
            </div>
          );
        })}
      </div>

      <div className="premium-card p-10 md:p-12">
        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome to the Network</h1>
              <p className="text-slate-500 font-medium">Let&apos;s start by completing your professional profile.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex items-center gap-3 text-green-700 text-sm font-medium">
                <Icons.shieldCheck className="size-5 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Assigned Role: {user?.role?.replace(/_/g, ' ')}</p>
                  <p className="text-green-600 font-normal">Your account was provisioned with this role by an administrator.</p>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 bg-green-800 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-900/20 flex gap-2 text-sm font-bold">
              {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>Continue to Company Setup <Icons.arrowRight className="w-4 h-4" /></>}
            </Button>
          </form>
        )}

        {step === 'company' && (
          <div className="space-y-6">
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Company Information</h1>
              <p className="text-slate-500 font-medium">Link your account to an existing organization or create a new one.</p>
            </div>

            {!isCreatingCompany ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className={labelClass}>Search for your company</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter company name..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className={clsx(inputClass, "flex-1")}
                    />
                    <Button type="button" variant="outline" onClick={searchCompanies} className="h-9 px-4 rounded-xl border-slate-200 font-bold text-sm">Search</Button>
                  </div>
                </div>

                {foundCompanies.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-2xl">
                    {foundCompanies.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleJoinCompany(c.id)}
                        className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.country || 'Global'}</p>
                        </div>
                        <Icons.chevronRight className="w-4 h-4 text-slate-400 group-hover:text-green-800" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold tracking-widest">Or</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatingCompany(true)}
                  className="w-full h-10 rounded-xl border-2 border-dashed border-slate-300 hover:border-green-600 hover:bg-green-50/50 text-slate-500 hover:text-green-700 transition-all font-bold flex items-center justify-center gap-2 text-sm"
                >
                  <Icons.plus className="w-5 h-5" />
                  Create New Company Profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateCompany} className="space-y-6">
                {/* Company Type Selector */}
                <div className="space-y-3">
                  <label className={labelClass}>Company Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {COMPANY_TYPES.map((ct) => (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => setCompanyType(ct.value)}
                        className={clsx(
                          "p-4 rounded-2xl border-2 text-left transition-all",
                          companyType === ct.value
                            ? "border-green-800 bg-green-50"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <p className={clsx("text-sm font-bold", companyType === ct.value ? "text-green-800" : "text-slate-900")}>
                          {ct.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{ct.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={labelClass}>Company Name *</label>
                    <input
                      required
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                      placeholder="e.g. SolarTech Africa Ltd"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Company Description * <span className="text-slate-300 normal-case tracking-normal">(min 30 characters)</span></label>
                    <textarea
                      required
                      minLength={30}
                      value={newCompany.description}
                      onChange={(e) => setNewCompany({...newCompany, description: e.target.value})}
                      placeholder="Briefly describe your organization's mission, focus areas, and key capabilities..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium resize-none text-sm"
                    />
                    <p className="text-xs text-slate-400 ml-1">{newCompany.description.length}/30 minimum</p>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Country *</label>
                    <div className="relative">
                      <select
                        required
                        value={newCompany.country}
                        onChange={(e) => setNewCompany({...newCompany, country: e.target.value})}
                        className={selectClass}
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="OTHER">Other (specify below)</option>
                      </select>
                      <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    {newCompany.country === 'OTHER' && (
                      <input
                        type="text"
                        required
                        placeholder="Enter your country"
                        value={newCompany.countryOther}
                        onChange={(e) => setNewCompany({...newCompany, countryOther: e.target.value})}
                        className={clsx(inputClass, "mt-2")}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Years Operating *</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={newCompany.years_operating}
                        onChange={(e) => {
                          const years = Number(e.target.value || 0);
                          const mgmtYears = Number(newCompany.management_team_experience?.years || 0);
                          setNewCompany({
                            ...newCompany,
                            years_operating: years,
                            is_new_company_with_experienced_team: years < 2 && mgmtYears >= 5,
                          });
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Team Size *</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={newCompany.team_size}
                        onChange={(e) => setNewCompany({...newCompany, team_size: Number(e.target.value || 0)})}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Website</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newCompany.website}
                      onChange={(e) => setNewCompany({...newCompany, website: e.target.value})}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Technical Partner specific fields */}
                {companyType === 'TECHNICAL' && (
                  <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_new_company_with_experienced_team"
                        checked={newCompany.is_new_company_with_experienced_team}
                        disabled
                        className="rounded"
                      />
                      <Label htmlFor="is_new_company_with_experienced_team" className="font-semibold">Experienced Leadership Flag</Label>
                    </div>
                    <p className="text-xs text-slate-500">Auto-calculated: company operating &lt;2 years AND management experience ≥5 years.</p>
                    <div className="space-y-2">
                      <label className={labelClass}>Management Team Total Experience (Years)</label>
                      <input
                        type="number"
                        min={0}
                        value={newCompany.management_team_experience.years}
                        onChange={(e) => updateManagementExperience(Number(e.target.value || 0))}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsCreatingCompany(false)} className="h-9 px-4 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition-colors text-sm">
                    Back to Search
                  </button>
                  <Button type="submit" disabled={loading} className="flex-1 h-10 bg-green-800 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-900/20 flex gap-2 text-sm font-bold">
                    {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>Register Company <Icons.arrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === 'preferences' && (
          <form onSubmit={handlePreferenceSubmit} className="space-y-6">
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-3">
                {companyType === 'CAPITAL' ? 'Investment Preferences'
                  : companyType === 'TECHNICAL' ? 'Service Profile'
                  : 'Trading Preferences'}
              </h1>
              <p className="text-slate-500 font-medium">Help us match you with the right opportunities.</p>
            </div>

            {companyType === 'CAPITAL' && (
              <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Min Ticket Size (ZMW) *</label>
                    <input type="number" min={0} required onChange={(e) => setPreferences({...preferences, min_ticket_size: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Max Ticket Size (ZMW) *</label>
                    <input type="number" min={0} required onChange={(e) => setPreferences({...preferences, max_ticket_size: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Investment Sector Focus *</label>
                  <MultiSelect
                    options={SECTORS}
                    selected={preferences.sector_focus ?? []}
                    onChange={(vals) => setPreferences({...preferences, sector_focus: vals})}
                    placeholder="Select sectors..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Geographic Focus *</label>
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.geographic_focus ?? []}
                    onChange={(vals) => setPreferences({...preferences, geographic_focus: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Risk Tolerance *</label>
                  <div className="relative">
                    <select required className={selectClass} onChange={(e) => setPreferences({...preferences, risk_tolerance: e.target.value})}>
                      <option value="">Select risk level...</option>
                      {RISK_LEVELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Governance Preference *</label>
                  <div className="relative">
                    <select required className={selectClass} onChange={(e) => setPreferences({...preferences, governance_preference: e.target.value})}>
                      <option value="">Select preference...</option>
                      {GOVERNANCE_PREFERENCES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                    <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Preferred Project Stages</label>
                  <MultiSelect
                    options={PROJECT_STAGES}
                    selected={preferences.preferred_project_stage ?? []}
                    onChange={(vals) => setPreferences({...preferences, preferred_project_stage: vals})}
                    placeholder="Select stages..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Preferred Capital Structures</label>
                  <MultiSelect
                    options={CAPITAL_STRUCTURES}
                    selected={preferences.preferred_capital_structure ?? []}
                    onChange={(vals) => setPreferences({...preferences, preferred_capital_structure: vals})}
                    placeholder="Select structures..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Expected Return Profile</label>
                  <input
                    type="text"
                    placeholder="e.g. 15-20% IRR"
                    value={preferences.expected_return_profile ?? ''}
                    onChange={(e) => setPreferences({...preferences, expected_return_profile: e.target.value})}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {companyType === 'TECHNICAL' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Years of Experience *</label>
                    <input type="number" min={0} required onChange={(e) => setPreferences({...preferences, years_of_experience: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Min Project Size (ZMW)</label>
                    <input type="number" min={0} onChange={(e) => setPreferences({...preferences, min_ticket_size_zmw: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Max Project Size (ZMW)</label>
                    <input type="number" min={0} onChange={(e) => setPreferences({...preferences, max_ticket_size_zmw: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Max MW Capacity</label>
                    <input type="number" min={0} onChange={(e) => setPreferences({...preferences, max_mw_capacity: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Service Categories *</label>
                  <MultiSelect
                    options={SERVICE_CATEGORIES}
                    selected={preferences.service_categories ?? []}
                    onChange={(vals) => setPreferences({...preferences, service_categories: vals})}
                    placeholder="Select categories..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Sector Experience *</label>
                  <MultiSelect
                    options={SECTORS}
                    selected={preferences.sector_experience ?? []}
                    onChange={(vals) => setPreferences({...preferences, sector_experience: vals})}
                    placeholder="Select sectors..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Regions of Operation *</label>
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.regions_operated ?? []}
                    onChange={(vals) => setPreferences({...preferences, regions_operated: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Preferred Delivery Models</label>
                  <MultiSelect
                    options={DELIVERY_MODELS}
                    selected={preferences.delivery_models ?? []}
                    onChange={(vals) => setPreferences({...preferences, delivery_models: vals})}
                    placeholder="Select models..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Payment Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. 20% upfront, milestones..."
                    value={preferences.payment_terms ?? ''}
                    onChange={(e) => setPreferences({...preferences, payment_terms: e.target.value})}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {companyType === 'POWER_TRADER' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className={labelClass}>License Type *</label>
                  <div className="relative">
                    <select required className={selectClass} onChange={(e) => setPreferences({...preferences, license_type: e.target.value})}>
                      <option value="">Select license type...</option>
                      <option value="GENERATION">Generation License</option>
                      <option value="TRADING">Trading License</option>
                      <option value="DISTRIBUTION">Distribution License</option>
                      <option value="TRANSMISSION">Transmission License</option>
                      <option value="SUPPLIER">Supplier License</option>
                    </select>
                    <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Max Offtake Capacity (MW) *</label>
                  <input type="number" min={0} required onChange={(e) => setPreferences({...preferences, max_offtake_capacity_mw: Number(e.target.value)})} className={inputClass} />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Preferred Technology Types *</label>
                  <MultiSelect
                    options={SECTORS.map(s => ({ value: s.value, label: s.label }))}
                    selected={preferences.preferred_technology_types ?? []}
                    onChange={(vals) => setPreferences({...preferences, preferred_technology_types: vals})}
                    placeholder="Select technology types..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Regions of Interest *</label>
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.regions_of_interest ?? []}
                    onChange={(vals) => setPreferences({...preferences, regions_of_interest: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Min PPA Duration (Years) *</label>
                  <input type="number" min={1} required onChange={(e) => setPreferences({...preferences, min_ppa_duration_years: Number(e.target.value)})} className={inputClass} />
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-10 bg-green-800 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-900/20 flex gap-2 text-sm font-bold">
              {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>Save & Finalize <Icons.arrowRight className="w-4 h-4" /></>}
            </Button>
          </form>
        )}

        {step === 'complete' && (
          <div className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-green-800/10 rounded-full flex items-center justify-center mx-auto">
              <Icons.check className="w-10 h-10 text-green-800" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-slate-900">Setup Complete</h1>
              <p className="text-slate-500 font-medium max-w-md mx-auto">Your organization is now registered and under review. Our team will verify your profile shortly. You&apos;ll receive an email once approved.</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-3 text-amber-700 text-sm font-medium max-w-md mx-auto">
              <Icons.info className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">What happens next?</p>
                <p className="font-normal mt-0.5">An administrator will review your organization. You&apos;ll have limited access until verification is complete.</p>
              </div>
            </div>
            <Button onClick={finishOnboarding} disabled={loading} className="w-full h-10 bg-green-800 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-900/20 flex gap-2 text-sm font-bold mt-8">
              {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>Go to Dashboard <Icons.arrowRight className="w-4 h-4" /></>}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in zoom-in-95">
          <Icons.alertTriangle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
