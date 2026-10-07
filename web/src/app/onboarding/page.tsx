'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { onboardingApi, companiesApi } from '@/services/api';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InfoHint } from '@/components/ui/InfoHint';
import { Company, CompanyType } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SearchableCountrySelect } from '@/components/ui/SearchableCountrySelect';
import {
  SECTORS,
  SERVICE_CATEGORIES,
  CAPITAL_STRUCTURES,
  PROJECT_STAGES,
  RISK_LEVELS,
  GOVERNANCE_PREFERENCES,
  DELIVERY_MODELS,
  OWNERSHIP_STRUCTURES,
  ZAMBIAN_PROVINCES,
  CERTIFICATIONS,
} from '@/lib/profile-options';

/** Market segments an EPC / technical partner has delivered. */
const PROJECT_TYPES = [
  'Utility-scale', 'Commercial & Industrial', 'Mini-grid', 'Off-grid', 'Transmission', 'Distribution',
];

type OnboardingStep = 'profile' | 'company' | 'preferences' | 'complete';

const COMPANY_TYPES: { value: CompanyType; label: string; description: string }[] = [
  { value: 'DEVELOPER', label: 'Project Developer', description: 'Develop and own energy infrastructure projects seeking capital' },
  { value: 'CAPITAL', label: 'Financier', description: 'Investment firms deploying capital into energy projects' },
  { value: 'TECHNICAL', label: 'Technical Partner', description: 'EPC, O&M, and advisory service providers' },
  { value: 'CONSULTANT', label: 'Consultant', description: 'Feasibility, financial, environmental, and legal advisory firms' },
  { value: 'POWER_TRADER', label: 'Power Trader', description: 'Offtake and power purchase agreements' },
  { value: 'GRANT_PROVIDER', label: 'Grant Provider', description: 'Development partners and grant funders supporting early-stage project preparation' },
];

const PROFILE_META: Record<CompanyType, { icon: keyof typeof Icons; title: string; blurb: string }> = {
  DEVELOPER: { icon: 'zap', title: 'Project Developer', blurb: 'Develop and own energy infrastructure projects seeking capital.' },
  CAPITAL: { icon: 'dollarSign', title: 'Financier', blurb: 'Deploy debt, equity and grant capital into vetted opportunities.' },
  TECHNICAL: { icon: 'hardHat', title: 'Technical Partner', blurb: 'Provide EPC, O&M and specialist services to active projects.' },
  CONSULTANT: { icon: 'briefcase', title: 'Consultant', blurb: 'Offer feasibility, financial, environmental and legal advisory.' },
  POWER_TRADER: { icon: 'activity', title: 'Power Trader', blurb: 'Offtake and power purchase agreement counterparties.' },
  GRANT_PROVIDER: { icon: 'handshake', title: 'Grant Provider', blurb: 'Fund early-stage project preparation and feasibility.' },
  AUTHORITY: { icon: 'shieldCheck', title: 'Regulator / Management', blurb: 'Review projects, verify evidence, and govern platform participation.' },
};

const FIRM_TYPE_DETAILS: Record<CompanyType, { summary: string; captures: string[]; usedFor: string }> = {
  DEVELOPER: {
    summary: 'For project owners building renewable energy and infrastructure assets that need capital, technical support, offtake, or advisory partners.',
    captures: ['Project pipeline context', 'Company track record', 'Verification details'],
    usedFor: 'Used to assess readiness, credibility, and partner fit before your projects are shared with financiers or service providers.',
  },
  CAPITAL: {
    summary: 'For investors, lenders, funds, DFIs, and capital providers looking for qualified energy infrastructure opportunities.',
    captures: ['Ticket size', 'Sector appetite', 'Risk and governance preferences'],
    usedFor: 'Used to match your mandate with projects that fit your investment criteria and operating regions.',
  },
  TECHNICAL: {
    summary: 'For EPCs, O&M providers, engineering firms, and specialist technical partners supporting project delivery.',
    captures: ['Service categories', 'Delivery capacity', 'Regional and sector experience'],
    usedFor: 'Used to surface you for projects that need the capabilities, certifications, and delivery model you provide.',
  },
  CONSULTANT: {
    summary: 'For advisory firms supporting feasibility, finance, environmental, legal, regulatory, and transaction work.',
    captures: ['Advisory focus', 'Experience profile', 'Availability and rate context'],
    usedFor: 'Used to connect you with developers and funders that need specialist support during preparation or execution.',
  },
  POWER_TRADER: {
    summary: 'For offtakers, traders, utilities, and commercial buyers evaluating generation capacity and power purchase opportunities.',
    captures: ['License type', 'Offtake capacity', 'Technology and region preferences'],
    usedFor: 'Used to match you with projects that align with your offtake mandate, duration requirements, and market coverage.',
  },
  GRANT_PROVIDER: {
    summary: 'For grant makers, development partners, and facilities funding early-stage preparation, feasibility, or capacity building.',
    captures: ['Grant size', 'Eligible sectors', 'Application and timeline criteria'],
    usedFor: 'Used to route suitable developers and projects toward the grant instruments you offer.',
  },
  AUTHORITY: {
    summary: 'For sector authorities and management organisations that verify project submissions and oversee platform governance.',
    captures: ['Reviewer mandate', 'Governance scope', 'Project approval responsibilities'],
    usedFor: 'Used to grant controlled review access without exposing technical platform administration settings.',
  },
};



const inputClass = "w-full h-10 px-4 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm";
const selectClass = "w-full h-10 px-4 pr-10 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm appearance-none";
const textareaClass = "w-full px-4 py-3 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 resize-none text-sm font-medium";

/** Field hints shown as ? tooltips â€” mirrors the project-submission form UX. */
const FIELD_HINTS: Record<string, string> = {
  companyName: 'The legal name of your organisation as it appears on registration documents.',
  description: 'Briefly describe your mission, focus areas and key capabilities. Partners use this to understand who you are.',
  country: 'Country of operation. Matching prioritises partners active in the same country.',
  yearsOperating: 'How long your organisation has been operating. New companies with experienced teams are treated differently.',
  teamSize: 'Approximate number of full-time employees or core team members.',
  website: 'Optional â€” your official website so partners can verify your credentials.',
  registrationNumber: 'Your company registration or tax identification number, if applicable.',
  ownershipStructure: 'The legal ownership structure of your organisation.',
  ownershipDetails: 'Shareholding or ownership breakdown. Not needed if you are a sole proprietor.',
  contactEmail: 'Primary business email shown to matched partners.',
  contactPhone: 'Primary contact phone number for your organisation.',
  managementExperience: 'Combined years of senior management experience â€” helps establish credibility for new companies.',
  managementSummary: 'A short summary of your leadership team\'s background and experience (sectors, prior ventures, notable projects). This is shown to reviewers and matched partners.',
};

const PREFERENCE_HINTS: Record<string, string> = {
  yearsOfExperience: 'Years your firm or senior team has delivered this type of work.',
  totalProjectsCompleted: 'Total completed advisory or delivery assignments relevant to energy projects.',
  largestProjectMw: 'Largest single project capacity your firm has supported or delivered.',
  availability: 'Current capacity to take on new work or mandates.',
  serviceCategories: 'The services your firm can provide to matched projects.',
  sectorExperience: 'Technologies or infrastructure sectors where your team has practical experience.',
  regionsOperated: 'Regions where your firm has delivered work or can actively operate.',
  certifications: 'Professional licenses, accreditations, or credentials that strengthen your profile.',
  hourlyRateRange: 'Indicative hourly pricing. This helps counterparties understand budget fit.',
  projectRateRange: 'Typical fixed or project-based fee range for a standard engagement.',
  minTicketSize: 'Smallest investment or financing amount your mandate can consider.',
  maxTicketSize: 'Largest investment or financing amount your mandate can consider.',
  investmentSectorFocus: 'Energy sectors you want to evaluate for matching.',
  geographicFocus: 'Priority provinces or regions for your mandate.',
  riskTolerance: 'Risk level your organisation is comfortable evaluating.',
  governancePreference: 'How actively you prefer to participate after investing or funding.',
  preferredProjectStages: 'Project maturity stages that best fit your mandate.',
  preferredCapitalStructures: 'Capital instruments you can provide or prefer to deploy.',
  expectedReturnProfile: 'Target return, yield, IRR, or broad commercial expectation.',
  minProjectSize: 'Smallest project contract size your firm can support commercially.',
  maxProjectSize: 'Largest project contract size your firm can support commercially.',
  minMwCapacity: 'Smallest project capacity your team is equipped to support.',
  maxMwCapacity: 'Largest project capacity your team is equipped to support.',
  preferredDeliveryModels: 'Commercial delivery models your firm can work under.',
  paymentTerms: 'Typical billing terms, milestone structure, or upfront payment expectations.',
  licenseType: 'Regulatory license or market role under which you can trade or offtake power.',
  maxOfftakeCapacity: 'Maximum generation capacity you can evaluate for offtake or trading.',
  preferredTechnologyTypes: 'Generation technologies you are interested in buying from or trading.',
  regionsOfInterest: 'Regions where your offtake or trading mandate is active.',
  minPpaDuration: 'Minimum power purchase agreement duration you can consider.',
  minGrantSize: 'Smallest grant amount your programme can provide.',
  maxGrantSize: 'Largest grant amount your programme can provide.',
  grantTypes: 'Grant instruments or support categories your programme offers.',
  focusSectors: 'Sectors or technologies eligible under your grant mandate.',
  typicalTimeline: 'Expected time from application to approval or disbursement.',
  eligibilityCriteria: 'Conditions applicants or projects must meet before applying.',
  applicationProcess: 'How applicants submit, get reviewed, and receive decisions.',
};
function FieldLabel({ field, hint, required, className }: { field: string; hint?: string; required?: boolean; className?: string }) {
  return (
    <div className="flex items-center gap-1.5 ml-1">
      <Label className={cn('text-[11px] font-bold text-slate-400 uppercase tracking-widest', className)}>
        {field}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {hint && <InfoHint text={hint} />}
    </div>
  );
}

const defaultCompany = {
  name: '',
  country: 'Zambia',
  countryOther: '',
  description: '',
  website: '',
  years_operating: '' as string | number,
  team_size: '' as string | number,
  is_new_company_with_experienced_team: false,
  management_team_experience: { years: 0 as number, description: '' },
  registration_number: '',
  ownership_structure: '',
  ownership_details: '',
  contact_email: '',
  contact_phone: '',
  management_experience_summary: '',
};

function MultiSelect({ options, selected, onChange, placeholder, freeText }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  /** Allow values not present in `options` (type + Enter). */
  freeText?: boolean;
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:border-green-700 hover:text-green-800 transition-colors"
            >
              {opt?.label ?? val}
              <Icons.close className="w-3 h-3" />
            </button>
          );
        })}
      </div>
      <div className="relative">
        <select
          className={cn(selectClass, "h-10 text-xs")}
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

const ROLE_TO_COMPANY_TYPE: Record<string, CompanyType> = {
  DEVELOPER: 'DEVELOPER',
  CAPITAL_PARTNER: 'CAPITAL',
  TECHNICAL_PARTNER: 'TECHNICAL',
  CONSULTANT: 'CONSULTANT',
  POWER_TRADER: 'POWER_TRADER',
  GRANT_PROVIDER: 'GRANT_PROVIDER',
};

const PREFERENCE_TYPES: CompanyType[] = ['CAPITAL', 'TECHNICAL', 'CONSULTANT', 'POWER_TRADER', 'GRANT_PROVIDER'];

const STEP_META: Record<OnboardingStep, { label: string; subtitle: string; icon: keyof typeof Icons }> = {
  profile: { label: 'Profile', subtitle: 'Tell us who you are', icon: 'user' },
  company: { label: 'Company', subtitle: 'Set up your organisation profile', icon: 'building' },
  preferences: { label: 'Preferences', subtitle: 'How you want to be matched', icon: 'settings' },
  complete: { label: 'Review', subtitle: 'Submit for verification', icon: 'checkCircle2' },
};

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditParam = searchParams.get('edit') === 'true';
  const editMode = isEditParam && !!user?.company_id;

  const isInvitedMember = !!user?.company_id && !editMode;
  const invitedCompanyType = isInvitedMember
    ? (ROLE_TO_COMPANY_TYPE[user?.role ?? ''] ?? 'DEVELOPER')
    : 'DEVELOPER';

  const [step, setStep] = useState<OnboardingStep>('profile');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditParam);
  const [error, setError] = useState<string | null>(null);
  /** True once a saved draft has been restored into the form states. */
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const [fullName, setFullName] = useState(user?.full_name || '');

  /** Role-specific preference fields (shape varies by profile type). */
  const [preferences, setPreferences] = useState<Preferences>({});

  const [companySearch, setCompanySearch] = useState('');
  const [foundCompanies, setFoundCompanies] = useState<Company[]>([]);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  const queryType = searchParams.get('type');
  const registrationType = user?.registration_type ?? queryType;
  const [companyType, setCompanyType] = useState<CompanyType>(
    () => {
      if (registrationType && (['DEVELOPER','CAPITAL','TECHNICAL','CONSULTANT','POWER_TRADER','GRANT_PROVIDER'] as string[]).includes(registrationType)) {
        return registrationType as CompanyType;
      }
      return isInvitedMember ? invitedCompanyType : 'DEVELOPER';
    },
  );
  const [newCompany, setNewCompany] = useState(defaultCompany);

  const STORAGE_KEY = 'onboarding_edit_draft';
  const clearDraft = () => localStorage.removeItem(STORAGE_KEY);

  // ── Step-wise draft persistence ────────────────────────────────────────────
  // Every step's input is saved to the server (user_profiles.onboarding_draft)
  // as the user advances, so the application can be completed later — on this
  // device or any other — with the earlier inputs populated. Debounced 1.5s;
  // also fires on step changes so closing the tab right after advancing keeps
  // the new position.
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftStepRef = useRef<OnboardingStep>(step);
  draftStepRef.current = step;

  const scheduleDraftSave = useCallback((immediate = false) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    const flush = () => {
      draftTimer.current = null;
      // A fresh draft with only a step and no user input yet is not worth a
      // row write — skip until something was actually entered.
      const hasCompanyInput = Object.keys(newCompany).some(
        (k) => k !== 'countryOther' && String((newCompany as Record<string, unknown>)[k] ?? '').length > 0,
      );
      if (!fullName.trim() && !hasCompanyInput && Object.keys(preferences).length === 0) return;
      onboardingApi.saveDraft({
        step: draftStepRef.current,
        fullName: fullName || null,
        companyType,
        company: newCompany,
        preferences,
      }).catch(() => { /* drafts are best-effort — next keystroke retries */ });
    };
    if (immediate) flush();
    else draftTimer.current = setTimeout(flush, 1500);
  }, [fullName, companyType, newCompany, preferences]);

  useEffect(() => {
    if (isEditParam || isInvitedMember || !user || draftRestored === false) return;
    if (user.onboarding_complete) return;
    scheduleDraftSave();
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [fullName, companyType, newCompany, preferences, step, isEditParam, isInvitedMember, user, draftRestored, scheduleDraftSave]);

  // ── Draft restore ────────────────────────────────────────────────────────
  // On first load (not edit mode), pull the saved draft and jump the user back
  // to the step they left off at, with every earlier input re-filled.
  useEffect(() => {
    if (isEditParam || isInvitedMember || !user || user.onboarding_complete) {
      setDraftRestored(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await onboardingApi.getDraft();
        if (cancelled || !data?.draft) return;
        const draft = data.draft as {
          step?: OnboardingStep;
          fullName?: string | null;
          companyType?: CompanyType;
          company?: Record<string, unknown> | null;
          preferences?: Preferences | null;
        };
        if (draft.fullName && !user.full_name) setFullName(draft.fullName);
        if (draft.companyType) setCompanyType(draft.companyType);
        if (draft.company) setNewCompany({ ...defaultCompany, ...draft.company } as typeof defaultCompany);
        if (draft.preferences) setPreferences(draft.preferences);
        const validSteps: OnboardingStep[] = ['profile', 'company', 'preferences', 'complete'];
        if (draft.step && validSteps.includes(draft.step)) {
          // Never jump PAST where the account actually allows: preferences
          // require a company, so a stale step is clamped to 'company'.
          setStep(user.company_id ? draft.step : (['company', 'preferences', 'complete'].includes(draft.step) ? 'company' : draft.step));
        }
        if (draft.step || draft.fullName || draft.company || draft.preferences) {
          toast.info('We restored your saved progress — continue where you left off.');
        }
      } catch {
        // No draft / offline — start fresh.
      } finally {
        if (!cancelled) setDraftRestored(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** Role-specific preference fields (all optional â€” shape varies by profile type). */
interface Preferences {
  years_of_experience?: number;
  total_projects_completed?: number;
  largest_project_mw?: number;
  availability?: string;
  service_categories?: string[];
  sector_experience?: string[];
  regions_operated?: string[];
  certifications?: string[];
  hourly_rate_range?: string;
  project_rate_range?: string;
  min_ticket_size?: number;
  max_ticket_size?: number;
  sector_focus?: string[];
  geographic_focus?: string[];
  risk_tolerance?: string;
  governance_preference?: string;
  preferred_project_stage?: string[];
  preferred_capital_structure?: string[];
  expected_return_profile?: string;
  min_ticket_size_zmw?: number;
  max_ticket_size_zmw?: number;
  min_mw_capacity?: number;
  max_mw_capacity?: number;
  delivery_models?: string[];
  payment_terms?: string;
  license_type?: string;
  max_offtake_capacity_mw?: number;
  preferred_technology_types?: string[];
  regions_of_interest?: string[];
  min_ppa_duration_years?: number;
  // Technical-partner metrics captured by the capability-profile editor
  annual_delivery_capacity_mw?: number;
  total_mw_delivered?: number;
  average_delivery_time_months?: number;
  bonding_capacity?: number;
  project_type_experience?: string[];
  company_experience_doc_url?: string;
  portfolio_doc_url?: string;
  specializations?: string[];
  min_grant_size?: number;
  max_grant_size?: number;
  grant_types?: string[];
  focus_sectors?: string[];
  typical_timeline_months?: number;
  eligibility_criteria?: string;
  application_process?: string;
  [key: string]: string | number | string[] | undefined;
}

  useEffect(() => {
    if (!isEditParam || !user?.company_id) return;
    const loadExistingData = async () => {
      setLoadingData(true);
      localStorage.removeItem(STORAGE_KEY);
      try {
        const { data, error: fetchErr } = await onboardingApi.getEditData();
        if (fetchErr || !data) { setError(fetchErr || 'Failed to load existing data'); return; }
        const { company, preferences: prefs } = data;
        const typeDraft = (company.type as CompanyType) || 'DEVELOPER';
        const companyDraft = {
          name: company.name || '',
          country: company.country || 'Zambia',
          countryOther: '',
          description: company.description || '',
          website: company.website || '',
          years_operating: company.years_operating ?? '',
          team_size: company.team_size ?? '',
          is_new_company_with_experienced_team: company.is_new_company_with_experienced_team || false,
          management_team_experience: company.management_team_experience || { years: 0, description: '' },
          registration_number: company.registration_number || '',
          ownership_structure: company.ownership_structure || '',
          ownership_details: company.ownership_details || '',
          contact_email: company.contact_email || '',
          contact_phone: company.contact_phone || '',
          management_experience_summary: company.management_experience_summary || '',
        };
        const prefsDraft = prefs ?? {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ companyType: typeDraft, newCompany: companyDraft, preferences: prefsDraft }));
        setCompanyType(typeDraft);
        setNewCompany(companyDraft);
        setPreferences(prefsDraft);
        goToStep('company');
      } catch (err) {
        console.error('[EDIT] Failed to load existing data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadExistingData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditParam, user?.company_id]);

  useEffect(() => {
    if (step !== 'preferences' || !isEditParam) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.companyType) setCompanyType(draft.companyType);
      if (draft.preferences) setPreferences(draft.preferences);
    } catch {}
  }, [step, isEditParam]);

  /** Advance a step and flush the draft immediately so the saved position matches reality. */
  const goToStep = (next: OnboardingStep) => {
    draftStepRef.current = next;
    setStep(next);
    scheduleDraftSave(true);
  };

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
      if (isInvitedMember) {
        const needsPrefs = PREFERENCE_TYPES.includes(invitedCompanyType);
        goToStep(needsPrefs ? 'preferences' : 'complete');
      } else {
        goToStep('company');
      }
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
      if (PREFERENCE_TYPES.includes(companyType)) {
        goToStep('preferences');
      } else {
        goToStep('complete');
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
    const companyData: Record<string, unknown> = {
      name: newCompany.name,
      country: getCountry(),
      type: companyType,
      years_operating: Number(newCompany.years_operating || 0),
      team_size: Number(newCompany.team_size || 0),
      is_new_company_with_experienced_team: Number(newCompany.years_operating || 0) < 2 && managementYears >= 5,
      description: newCompany.description,
      website: newCompany.website || undefined,
      registration_number: newCompany.registration_number || undefined,
      ownership_structure: newCompany.ownership_structure || undefined,
      ownership_details: newCompany.ownership_details || undefined,
      contact_email: newCompany.contact_email || undefined,
      contact_phone: newCompany.contact_phone || undefined,
      management_team_experience: newCompany.management_team_experience,
      management_experience_summary: newCompany.management_experience_summary || undefined,
    };

    if (editMode) {
      const result = await onboardingApi.updateCompany(user.id, companyData);
      if ('error' in result && result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        if (PREFERENCE_TYPES.includes(companyType)) {
          goToStep('preferences');
        } else {
          goToStep('complete');
        }
        setLoading(false);
      }
    } else {
      const result = await onboardingApi.setupCompany(user.id, companyData);
      if ('error' in result && result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        if (PREFERENCE_TYPES.includes(companyType)) {
          goToStep('preferences');
        } else {
          goToStep('complete');
        }
        setLoading(false);
      }
    }
  };

  const handlePreferenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (companyType === 'CAPITAL') {
      if (!preferences.sector_focus?.length) { setError('Please select at least one sector focus'); return; }
      if (!preferences.geographic_focus?.length) { setError('Please select at least one geographic focus'); return; }
      if (!preferences.risk_tolerance) { setError('Please select a risk tolerance'); return; }
      if (!preferences.governance_preference) { setError('Please select a governance preference'); return; }
      if ((preferences.min_ticket_size || 0) > (preferences.max_ticket_size || 0)) { setError('Min ticket size must be less than or equal to max ticket size'); return; }
    }

    setLoading(true);
    setError(null);
    const role = companyType === 'CAPITAL' ? 'CAPITAL_PARTNER'
      : companyType === 'TECHNICAL' ? 'TECHNICAL_PARTNER'
      : companyType === 'CONSULTANT' ? 'CONSULTANT'
      : companyType === 'POWER_TRADER' ? 'POWER_TRADER'
      : companyType === 'GRANT_PROVIDER' ? 'GRANT_PROVIDER'
      : 'DEVELOPER';
    const { error } = await onboardingApi.saveRolePreferences(role, preferences);
    setLoading(false);
    if (error) setError(error);
    else goToStep('complete');
  };

  const finishOnboarding = async () => {
    setLoading(true);
    clearDraft();
    if (editMode) {
      await onboardingApi.resubmitCompany();
      await refreshUser();
      setLoading(false);
      window.location.href = '/dashboard';
      return;
    }
    await onboardingApi.completeOnboarding();
    await refreshUser();
    setLoading(false);
    window.location.href = '/dashboard';
  };

  const needsPreferences = PREFERENCE_TYPES.includes(companyType);
  const steps: OnboardingStep[] = [
    'profile',
    ...(isInvitedMember ? ([] as OnboardingStep[]) : (['company'] as OnboardingStep[])),
    ...(needsPreferences ? (['preferences'] as OnboardingStep[]) : ([] as OnboardingStep[])),
    'complete',
  ];
  const currentStepIndex = Math.max(0, steps.indexOf(step));
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Whether the company type was pre-determined (from registration) and must not be re-selected.
  const typeLocked = !!registrationType || editMode;
  const activeProfile = PROFILE_META[companyType];
  const ProfileIcon = Icons[activeProfile.icon];
  const firmTypeDetails = FIRM_TYPE_DETAILS[companyType];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 animate-in fade-in duration-500">

      {/* ── Progress header ─────────────────────────────────────────── */}
      <section className="rounded-none border border-slate-200 bg-white px-5 py-5 md:px-6 md:py-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Onboarding</p>
            <p className="mt-1 text-[15px] font-semibold text-slate-800">{STEP_META[step].subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-extrabold tabular-nums text-slate-950">{Math.round(progress)}%</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Complete</p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-4 right-4 top-4 h-[3px] rounded-full bg-slate-200" />
          <div
            className="absolute left-4 top-4 h-[3px] rounded-full bg-green-800 transition-all duration-500 ease-out"
            style={{ width: `calc((100% - 2rem) * ${(steps.length <= 1 ? 0 : currentStepIndex / (steps.length - 1)).toFixed(4)})` }}
          />
          <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, idx) => {
              const isActive = step === s;
              const isComplete = currentStepIndex > idx;

              return (
                <li key={s} className="flex min-w-0 flex-col items-center gap-2 px-1 text-center">
                  <div
                    className={cn(
                      "z-10 grid size-8 place-items-center rounded-full border text-xs font-bold transition-all duration-300",
                      isActive
                        ? "border-green-800 bg-green-800 text-white shadow-[0_0_0_5px_rgba(22,101,52,0.10)]"
                        : isComplete
                          ? "border-green-800 bg-white text-green-800"
                          : "border-slate-200 bg-white text-slate-400",
                    )}
                  >
                    {isComplete ? <Icons.check className="size-4" /> : idx + 1}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={cn(
                        "truncate text-xs font-bold md:text-sm",
                        isActive ? "text-slate-950" : isComplete ? "text-slate-700" : "text-slate-400",
                      )}
                    >
                      {STEP_META[s].label}
                    </p>
                    <p
                      className={cn(
                        "hidden text-[10px] font-semibold md:block",
                        isActive ? "text-green-800" : isComplete ? "text-slate-400" : "text-slate-400",
                      )}
                    >
                      {isActive ? 'Current step' : isComplete ? 'Done' : 'Pending'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Registration summary ────────────────────────────────────── */}
      <section className="rounded-none border border-slate-200 bg-white px-6 py-7 md:px-8 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Left — firm type */}
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-none border border-green-100 bg-green-50 text-green-800">
              <ProfileIcon className="size-6" />
            </div>
            <div className="min-w-0 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Registration type</p>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">{activeProfile.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{firmTypeDetails.summary}</p>
              </div>
              <p className="flex items-start gap-2 text-[13px] leading-6 text-slate-500">
                <Icons.info className="mt-0.5 size-3.5 shrink-0 text-green-800/70" />
                <span>{firmTypeDetails.usedFor}</span>
              </p>
            </div>
          </div>

          {/* Right — profile captures */}
          <div className="w-full shrink-0 border-t border-slate-200 pt-5 md:w-72 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Profile captures</p>
            <ul className="mt-3.5 space-y-2.5">
              {firmTypeDetails.captures.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-none border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-none bg-green-100 text-green-800">
                    <Icons.check className="size-4" />
                  </span>
                  <span className="text-[13px] font-semibold text-slate-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="border border-slate-200 bg-white">
        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="p-6 md:p-10 space-y-7">
            <div className="max-w-2xl">
              <div className="hidden">
                <Icons.user className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-950 tracking-tight mb-2">Welcome to the Network</h1>
              <p className="text-sm text-slate-600">Let&apos;s start by completing your professional profile.</p>
            </div>



            <div className="space-y-5">
              <div className="space-y-2">
                <FieldLabel field="Full Name" hint="Your name as you would like partners to address you." required />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-none bg-green-800 hover:bg-green-700 text-white shadow-none flex gap-2 text-sm font-semibold">
              {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>Continue to Company Setup <Icons.arrowRight className="w-4 h-4" /></>}
            </Button>
          </form>
        )}

        {step === 'company' && (
          <div className="p-6 md:p-10 space-y-7">
            <div className="max-w-2xl">
              <div className="hidden">
                <Icons.building className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-950 tracking-tight mb-2">
                {editMode ? 'Edit Company Information' : 'Company Information'}
              </h1>
              <p className="text-sm text-slate-600">
                {editMode ? 'Update your organisation details below.' : 'Link your account to an existing organisation or create a new one.'}
              </p>
            </div>

            {!isCreatingCompany && !editMode ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <FieldLabel field="Search for your company" hint="Your organisation may already be registered on the platform." />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter company name..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className={cn(inputClass, "flex-1")}
                    />
                    <Button type="button" variant="outline" onClick={searchCompanies} className="h-10 px-4 rounded-none border-slate-200 font-semibold text-sm">Search</Button>
                  </div>
                </div>

                {foundCompanies.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 bg-white p-2">
                    {foundCompanies.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleJoinCompany(c.id)}
                        className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex justify-between items-center group"
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
                  className="w-full h-10 rounded-none border border-slate-200 hover:border-green-700 hover:bg-slate-50 text-slate-700 hover:text-green-800 transition-colors font-semibold flex items-center justify-center gap-2 text-sm"
                >
                  <Icons.plus className="w-5 h-5" />
                  Create New Company Profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateCompany} className="space-y-8">
                {/* Applying-as badge â€” company type is pre-determined */}
                <div className="border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
                  <div className="size-10 rounded-none bg-white border border-slate-200 text-green-800 flex items-center justify-center shrink-0">
                    <ProfileIcon className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Registering as</p>
                    <p className="text-base font-semibold text-slate-950">{activeProfile.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{activeProfile.blurb}</p>
                  </div>
                  {typeLocked ? (
                    <div className="ml-auto shrink-0 hidden sm:block">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                        <Icons.lock className="size-3" /> Locked
                      </div>
                    </div>
                  ) : (
                    <div className="relative shrink-0 ml-auto hidden sm:block">
                      <select
                        className="h-10 px-3 pr-8 rounded-none border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-600/20 appearance-none"
                        value={companyType}
                        onChange={(e) => setCompanyType(e.target.value as CompanyType)}
                      >
                        {COMPANY_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                      </select>
                      <Icons.chevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-700 pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Section: Organisation */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="size-7 rounded-none bg-primary/10 flex items-center justify-center">
                      <Icons.building className="size-3.5 text-primary" />
                    </div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Organisation</h3>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel field="Company Name" hint={FIELD_HINTS.companyName} required />
                    <input
                      required
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                      placeholder="e.g. SolarTech Africa Ltd"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldLabel field="Company Description" hint={FIELD_HINTS.description} required />
                    <textarea
                      required
                      minLength={30}
                      value={newCompany.description}
                      onChange={(e) => setNewCompany({...newCompany, description: e.target.value})}
                      placeholder="Briefly describe your organisation's mission, focus areas, and key capabilities..."
                      rows={4}
                      className={textareaClass}
                    />
                    <p className="text-xs text-slate-400 ml-1">{newCompany.description.length}/30 minimum</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <FieldLabel field="Country" hint={FIELD_HINTS.country} required />
                      <SearchableCountrySelect
                        value={newCompany.country === 'OTHER' ? '' : (newCompany.country ?? '')}
                        onChange={(val) => setNewCompany({ ...newCompany, country: val, countryOther: '' })}
                        required
                        helperText={FIELD_HINTS.country}
                      />
                      {newCompany.country === 'OTHER' && (
                        <input
                          type="text"
                          required
                          placeholder="Enter your country"
                          value={newCompany.countryOther}
                          onChange={(e) => setNewCompany({...newCompany, countryOther: e.target.value})}
                          className={cn(inputClass, "mt-2")}
                        />
                      )}
                      {/* "Other (specify below)" — escape hatch for countries
                          not in the ISO 3166-1 list (e.g. disputed territories). */}
                      {newCompany.country !== 'OTHER' && (
                        <button
                          type="button"
                          onClick={() => setNewCompany({ ...newCompany, country: 'OTHER' })}
                          className="text-[11px] text-slate-500 hover:text-green-700 font-medium ml-1 self-start transition-colors"
                        >
                          Can't find your country? Specify it manually →
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <FieldLabel field="Website" hint={FIELD_HINTS.website} />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={newCompany.website}
                        onChange={(e) => setNewCompany({...newCompany, website: e.target.value})}
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel field="Years Operating" hint={FIELD_HINTS.yearsOperating} required />
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
                      <FieldLabel field="Team Size" hint={FIELD_HINTS.teamSize} required />
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
                </div>

                {/* Section: Ownership & Registration */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="size-7 rounded-none bg-primary/10 flex items-center justify-center">
                      <Icons.shieldCheck className="size-3.5 text-primary" />
                    </div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ownership & Registration</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <FieldLabel field="Registration Number" hint={FIELD_HINTS.registrationNumber} />
                      <input
                        placeholder="Company registration number"
                        value={newCompany.registration_number}
                        onChange={(e) => setNewCompany({...newCompany, registration_number: e.target.value})}
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel field="Ownership Structure" hint={FIELD_HINTS.ownershipStructure} />
                      <div className="relative">
                        <select
                          value={newCompany.ownership_structure}
                          onChange={(e) => setNewCompany({...newCompany, ownership_structure: e.target.value, ownership_details: e.target.value === 'SOLE_PROPRIETOR' ? '' : newCompany.ownership_details})}
                          className={selectClass}
                        >
                          <option value="">Select...</option>
                          {OWNERSHIP_STRUCTURES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Conditional: sole proprietor needs no ownership breakdown */}
                  {newCompany.ownership_structure && newCompany.ownership_structure !== 'SOLE_PROPRIETOR' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                      <FieldLabel field="Ownership Details" hint={FIELD_HINTS.ownershipDetails} />
                      <textarea
                        placeholder="e.g. 60% Founder A, 40% Founder B; or Government 100%"
                        value={newCompany.ownership_details}
                        onChange={(e) => setNewCompany({...newCompany, ownership_details: e.target.value})}
                        rows={2}
                        className={textareaClass}
                      />
                    </div>
                  )}

                  {/* New company (<2 years incl. brand-new) â†’ capture leadership experience */}
                  {Number(newCompany.years_operating || 0) < 2 && (
                    <div className="space-y-4 border border-slate-200 bg-slate-50 p-4 animate-in fade-in slide-in-from-top-1 duration-300">
                      <div className="flex items-center gap-2">
                        <Icons.trendingUp className="size-4 text-green-800" />
                        <h4 className="text-xs font-semibold text-slate-700">Leadership Experience</h4>
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="Management Team Experience (Years)" hint={FIELD_HINTS.managementExperience} />
                        <input
                          type="number"
                          min={0}
                          value={newCompany.management_team_experience.years}
                          onChange={(e) => updateManagementExperience(Number(e.target.value || 0))}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel field="Management Experience Summary" hint={FIELD_HINTS.managementSummary} />
                        <textarea
                          placeholder="e.g. Our founding team brings 20+ years across solar EPC and project finance in Zambia…"
                          rows={3}
                          value={newCompany.management_experience_summary}
                          onChange={(e) => setNewCompany({ ...newCompany, management_experience_summary: e.target.value })}
                          className={cn(textareaClass, "w-full")}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section: Contact */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="size-7 rounded-none bg-primary/10 flex items-center justify-center">
                      <Icons.mail className="size-3.5 text-primary" />
                    </div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <FieldLabel field="Contact Email" hint={FIELD_HINTS.contactEmail} />
                      <input
                        type="email"
                        placeholder="company@example.com"
                        value={newCompany.contact_email}
                        onChange={(e) => setNewCompany({...newCompany, contact_email: e.target.value})}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel field="Contact Phone" hint={FIELD_HINTS.contactPhone} />
                      <input
                        type="tel"
                        placeholder="+260 XXX XXX XXX"
                        value={newCompany.contact_phone}
                        onChange={(e) => setNewCompany({...newCompany, contact_phone: e.target.value})}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button type="button" onClick={() => editMode ? router.push('/dashboard') : setIsCreatingCompany(false)} className="h-10 px-4 rounded-none border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors text-sm">
                    {editMode ? 'Cancel' : 'Back to Search'}
                  </button>
                  <Button type="submit" disabled={loading} className="flex-1 h-11 bg-green-800 hover:bg-green-700 text-white rounded-none shadow-none flex gap-2 text-sm font-semibold">
                    {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>{editMode ? 'Save Changes' : 'Register Company'} <Icons.arrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === 'preferences' && (
          <form onSubmit={handlePreferenceSubmit} className="p-8 md:p-12 space-y-8">
            <div className="max-w-2xl">
              <div className="hidden">
                {(() => { const Icon = Icons[STEP_META.preferences.icon]; return <Icon className="size-6 text-primary" />; })()}
              </div>
              <h1 className="text-2xl font-semibold text-slate-950 tracking-tight mb-2">
                {editMode ? 'Update ' : ''}
                {companyType === 'CAPITAL' ? 'Investment Preferences'
                  : companyType === 'TECHNICAL' ? 'Service Profile'
                  : companyType === 'CONSULTANT' ? 'Consulting Profile'
                  : companyType === 'GRANT_PROVIDER' ? 'Grant Provider Profile'
                  : 'Trading Preferences'}
              </h1>
              <p className="text-sm text-slate-600">Help us match you with the right opportunities.</p>
            </div>

            {/* Applying-as badge */}
            <div className="border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
              <div className="size-10 rounded-none bg-white border border-slate-200 text-green-800 flex items-center justify-center shrink-0">
                <ProfileIcon className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Preferences for</p>
                <p className="text-base font-semibold text-slate-950">{activeProfile.title}</p>
              </div>
            </div>

            {companyType === 'CONSULTANT' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Years of Experience" hint={PREFERENCE_HINTS.yearsOfExperience} required />
                    <input type="number" min={0} required value={preferences.years_of_experience ?? ''} onChange={(e) => setPreferences({...preferences, years_of_experience: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Total Projects Completed" hint={PREFERENCE_HINTS.totalProjectsCompleted} required />
                    <input type="number" min={0} required value={preferences.total_projects_completed ?? ''} onChange={(e) => setPreferences({...preferences, total_projects_completed: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Largest Project (MW)" hint={PREFERENCE_HINTS.largestProjectMw} />
                    <input type="number" min={0} step="any" value={preferences.largest_project_mw ?? ''} onChange={(e) => setPreferences({...preferences, largest_project_mw: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Availability" hint={PREFERENCE_HINTS.availability} />
                    <div className="relative">
                      <select className={selectClass} value={preferences.availability ?? ''} onChange={(e) => setPreferences({...preferences, availability: e.target.value})}>
                        <option value="">Select availability...</option>
                        <option value="AVAILABLE">Available</option>
                        <option value="BUSY">Busy</option>
                        <option value="UNAVAILABLE">Unavailable</option>
                      </select>
                      <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Service Categories" hint={PREFERENCE_HINTS.serviceCategories} required />
                  <MultiSelect
                    options={SERVICE_CATEGORIES}
                    selected={preferences.service_categories ?? []}
                    onChange={(vals) => setPreferences({...preferences, service_categories: vals})}
                    placeholder="Select categories..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Sector Experience" hint={PREFERENCE_HINTS.sectorExperience} required />
                  <MultiSelect
                    options={SECTORS}
                    selected={preferences.sector_experience ?? []}
                    onChange={(vals) => setPreferences({...preferences, sector_experience: vals})}
                    placeholder="Select sectors..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Regions Operated" hint={PREFERENCE_HINTS.regionsOperated} required />
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.regions_operated ?? []}
                    onChange={(vals) => setPreferences({...preferences, regions_operated: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Certifications" hint={PREFERENCE_HINTS.certifications} />
                  <MultiSelect
                    options={CERTIFICATIONS}
                    selected={preferences.certifications ?? []}
                    onChange={(vals) => setPreferences({...preferences, certifications: vals})}
                    placeholder="Select certifications..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Specializations" />
                  <MultiSelect
                    options={[]}
                    selected={preferences.specializations ?? []}
                    onChange={(vals) => setPreferences({...preferences, specializations: vals})}
                    placeholder="Add a specialization..."
                    freeText
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Hourly Rate Range" hint={PREFERENCE_HINTS.hourlyRateRange} />
                    <input type="text" placeholder="e.g. $80 - $150 / hr" value={preferences.hourly_rate_range ?? ''} onChange={(e) => setPreferences({...preferences, hourly_rate_range: e.target.value})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Project Rate Range" hint={PREFERENCE_HINTS.projectRateRange} />
                    <input type="text" placeholder="e.g. $20k - $80k" value={preferences.project_rate_range ?? ''} onChange={(e) => setPreferences({...preferences, project_rate_range: e.target.value})} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Company Experience Document URL" />
                    <input type="text" placeholder="https://..." value={preferences.company_experience_doc_url ?? ''} onChange={(e) => setPreferences({...preferences, company_experience_doc_url: e.target.value})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Portfolio Document URL" />
                    <input type="text" placeholder="https://..." value={preferences.portfolio_doc_url ?? ''} onChange={(e) => setPreferences({...preferences, portfolio_doc_url: e.target.value})} className={inputClass} />
                  </div>
                </div>
              </div>
            )}

            {companyType === 'CAPITAL' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Min Ticket Size (ZMW)" hint={PREFERENCE_HINTS.minTicketSize} required />
                    <input type="number" min={0} step="any" required value={preferences.min_ticket_size ?? ''} onChange={(e) => setPreferences({...preferences, min_ticket_size: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Max Ticket Size (ZMW)" hint={PREFERENCE_HINTS.maxTicketSize} required />
                    <input type="number" min={0} step="any" required value={preferences.max_ticket_size ?? ''} onChange={(e) => setPreferences({...preferences, max_ticket_size: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Investment Sector Focus" hint={PREFERENCE_HINTS.investmentSectorFocus} required />
                  <MultiSelect
                    options={SECTORS}
                    selected={preferences.sector_focus ?? []}
                    onChange={(vals) => setPreferences({...preferences, sector_focus: vals})}
                    placeholder="Select sectors..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Geographic Focus" hint={PREFERENCE_HINTS.geographicFocus} required />
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.geographic_focus ?? []}
                    onChange={(vals) => setPreferences({...preferences, geographic_focus: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Risk Tolerance" hint={PREFERENCE_HINTS.riskTolerance} required />
                  <div className="relative">
                    <select required className={selectClass} value={preferences.risk_tolerance ?? ''} onChange={(e) => setPreferences({...preferences, risk_tolerance: e.target.value})}>
                      <option value="">Select risk level...</option>
                      {RISK_LEVELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Governance Preference" hint={PREFERENCE_HINTS.governancePreference} required />
                  <div className="relative">
                    <select required className={selectClass} value={preferences.governance_preference ?? ''} onChange={(e) => setPreferences({...preferences, governance_preference: e.target.value})}>
                      <option value="">Select preference...</option>
                      {GOVERNANCE_PREFERENCES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                    <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Preferred Project Stages" hint={PREFERENCE_HINTS.preferredProjectStages} />
                  <MultiSelect
                    options={PROJECT_STAGES}
                    selected={preferences.preferred_project_stage ?? []}
                    onChange={(vals) => setPreferences({...preferences, preferred_project_stage: vals})}
                    placeholder="Select stages..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Preferred Capital Structures" hint={PREFERENCE_HINTS.preferredCapitalStructures} />
                  <MultiSelect
                    options={CAPITAL_STRUCTURES}
                    selected={preferences.preferred_capital_structure ?? []}
                    onChange={(vals) => setPreferences({...preferences, preferred_capital_structure: vals})}
                    placeholder="Select structures..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Expected Return Profile" hint={PREFERENCE_HINTS.expectedReturnProfile} />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Years of Experience" hint={PREFERENCE_HINTS.yearsOfExperience} required />
                    <input type="number" min={0} required value={preferences.years_of_experience ?? ''} onChange={(e) => setPreferences({...preferences, years_of_experience: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Min Project Size (ZMW)" hint={PREFERENCE_HINTS.minProjectSize} />
                    <input type="number" min={0} step="any" value={preferences.min_ticket_size_zmw ?? ''} onChange={(e) => setPreferences({...preferences, min_ticket_size_zmw: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Max Project Size (ZMW)" hint={PREFERENCE_HINTS.maxProjectSize} />
                    <input type="number" min={0} step="any" value={preferences.max_ticket_size_zmw ?? ''} onChange={(e) => setPreferences({...preferences, max_ticket_size_zmw: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Min MW Capacity" hint={PREFERENCE_HINTS.minMwCapacity} />
                    <input type="number" min={0} step="any" value={preferences.min_mw_capacity ?? ''} onChange={(e) => setPreferences({...preferences, min_mw_capacity: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel field="Max MW Capacity" hint={PREFERENCE_HINTS.maxMwCapacity} />
                  <input type="number" min={0} step="any" value={preferences.max_mw_capacity ?? ''} onChange={(e) => setPreferences({...preferences, max_mw_capacity: Number(e.target.value)})} className={inputClass} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Annual Delivery Capacity (MW)" />
                    <input type="number" min={0} step="any" value={preferences.annual_delivery_capacity_mw ?? ''} onChange={(e) => setPreferences({...preferences, annual_delivery_capacity_mw: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Total MW Delivered" />
                    <input type="number" min={0} step="any" value={preferences.total_mw_delivered ?? ''} onChange={(e) => setPreferences({...preferences, total_mw_delivered: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Largest Project (MW)" hint={PREFERENCE_HINTS.largestProjectMw} />
                    <input type="number" min={0} step="any" value={preferences.largest_project_mw ?? ''} onChange={(e) => setPreferences({...preferences, largest_project_mw: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Average Delivery Time (months)" />
                    <input type="number" min={0} value={preferences.average_delivery_time_months ?? ''} onChange={(e) => setPreferences({...preferences, average_delivery_time_months: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Bonding Capacity (USD)" />
                    <input type="number" min={0} value={preferences.bonding_capacity ?? ''} onChange={(e) => setPreferences({...preferences, bonding_capacity: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Project Type Experience" />
                  <MultiSelect
                    options={PROJECT_TYPES.map(t => ({ value: t, label: t }))}
                    selected={preferences.project_type_experience ?? []}
                    onChange={(vals) => setPreferences({...preferences, project_type_experience: vals})}
                    placeholder="Select project types..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Service Categories" hint={PREFERENCE_HINTS.serviceCategories} required />
                  <MultiSelect
                    options={SERVICE_CATEGORIES}
                    selected={preferences.service_categories ?? []}
                    onChange={(vals) => setPreferences({...preferences, service_categories: vals})}
                    placeholder="Select categories..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Sector Experience" hint={PREFERENCE_HINTS.sectorExperience} required />
                  <MultiSelect
                    options={SECTORS}
                    selected={preferences.sector_experience ?? []}
                    onChange={(vals) => setPreferences({...preferences, sector_experience: vals})}
                    placeholder="Select sectors..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Regions of Operation" hint={PREFERENCE_HINTS.regionsOperated} required />
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.regions_operated ?? []}
                    onChange={(vals) => setPreferences({...preferences, regions_operated: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Preferred Delivery Models" hint={PREFERENCE_HINTS.preferredDeliveryModels} />
                  <MultiSelect
                    options={DELIVERY_MODELS}
                    selected={preferences.delivery_models ?? []}
                    onChange={(vals) => setPreferences({...preferences, delivery_models: vals})}
                    placeholder="Select models..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Payment Terms" hint={PREFERENCE_HINTS.paymentTerms} />
                  <input
                    type="text"
                    placeholder="e.g. 20% upfront, milestones..."
                    value={preferences.payment_terms ?? ''}
                    onChange={(e) => setPreferences({...preferences, payment_terms: e.target.value})}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Company Experience Document URL" />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={preferences.company_experience_doc_url ?? ''}
                    onChange={(e) => setPreferences({...preferences, company_experience_doc_url: e.target.value})}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {companyType === 'POWER_TRADER' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <FieldLabel field="License Type" hint={PREFERENCE_HINTS.licenseType} required />
                  <div className="relative">
                    <select required className={selectClass} value={preferences.license_type ?? ''} onChange={(e) => setPreferences({...preferences, license_type: e.target.value})}>
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
                  <FieldLabel field="Max Offtake Capacity (MW)" hint={PREFERENCE_HINTS.maxOfftakeCapacity} required />
                  <input type="number" min={0} step="any" required value={preferences.max_offtake_capacity_mw ?? ''} onChange={(e) => setPreferences({...preferences, max_offtake_capacity_mw: Number(e.target.value)})} className={inputClass} />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Preferred Technology Types" hint={PREFERENCE_HINTS.preferredTechnologyTypes} required />
                  <MultiSelect
                    options={SECTORS.map(s => ({ value: s.value, label: s.label }))}
                    selected={preferences.preferred_technology_types ?? []}
                    onChange={(vals) => setPreferences({...preferences, preferred_technology_types: vals})}
                    placeholder="Select technology types..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Regions of Interest" hint={PREFERENCE_HINTS.regionsOfInterest} required />
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.regions_of_interest ?? []}
                    onChange={(vals) => setPreferences({...preferences, regions_of_interest: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Min PPA Duration (Years)" hint={PREFERENCE_HINTS.minPpaDuration} required />
                  <input type="number" min={1} required value={preferences.min_ppa_duration_years ?? ''} onChange={(e) => setPreferences({...preferences, min_ppa_duration_years: Number(e.target.value)})} className={inputClass} />
                </div>
              </div>
            )}

            {companyType === 'GRANT_PROVIDER' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <FieldLabel field="Min Grant Size (ZMW)" hint={PREFERENCE_HINTS.minGrantSize} required />
                    <input type="number" min={0} step="any" required value={preferences.min_grant_size ?? ''} onChange={(e) => setPreferences({...preferences, min_grant_size: Number(e.target.value)})} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel field="Max Grant Size (ZMW)" hint={PREFERENCE_HINTS.maxGrantSize} required />
                    <input type="number" min={0} step="any" required value={preferences.max_grant_size ?? ''} onChange={(e) => setPreferences({...preferences, max_grant_size: Number(e.target.value)})} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Grant Types" hint={PREFERENCE_HINTS.grantTypes} required />
                  <MultiSelect
                    options={[
                      { value: 'TECHNICAL_ASSISTANCE', label: 'Technical Assistance' },
                      { value: 'FEASIBILITY_STUDY', label: 'Feasibility Study Support' },
                      { value: 'PROJECT_PREPARATION', label: 'Project Preparation Facility' },
                      { value: 'CAPACITY_BUILDING', label: 'Capacity Building' },
                      { value: 'INNOVATION', label: 'Innovation / Piloting' },
                      { value: 'BLENDED_FINANCE', label: 'Blended Finance' },
                    ]}
                    selected={preferences.grant_types ?? []}
                    onChange={(vals) => setPreferences({...preferences, grant_types: vals})}
                    placeholder="Select grant types..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Focus Sectors" hint={PREFERENCE_HINTS.focusSectors} required />
                  <MultiSelect
                    options={SECTORS}
                    selected={preferences.focus_sectors ?? []}
                    onChange={(vals) => setPreferences({...preferences, focus_sectors: vals})}
                    placeholder="Select sectors..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Geographic Focus" hint={PREFERENCE_HINTS.geographicFocus} required />
                  <MultiSelect
                    options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))}
                    selected={preferences.geographic_focus ?? []}
                    onChange={(vals) => setPreferences({...preferences, geographic_focus: vals})}
                    placeholder="Select provinces..."
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Typical Timeline (Months)" hint={PREFERENCE_HINTS.typicalTimeline} />
                  <input type="number" min={1} value={preferences.typical_timeline_months ?? ''} onChange={(e) => setPreferences({...preferences, typical_timeline_months: Number(e.target.value)})} className={inputClass} />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Eligibility Criteria" hint={PREFERENCE_HINTS.eligibilityCriteria} />
                  <textarea
                    placeholder="Describe eligibility requirements applicants must meet..."
                    value={preferences.eligibility_criteria ?? ''}
                    onChange={(e) => setPreferences({...preferences, eligibility_criteria: e.target.value})}
                    rows={3}
                    className={textareaClass}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel field="Application Process" hint={PREFERENCE_HINTS.applicationProcess} />
                  <textarea
                    placeholder="Briefly describe your application and selection process..."
                    value={preferences.application_process ?? ''}
                    onChange={(e) => setPreferences({...preferences, application_process: e.target.value})}
                    rows={3}
                    className={textareaClass}
                  />
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-none bg-green-800 hover:bg-green-700 text-white shadow-none flex gap-2 text-sm font-semibold">
              {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <>{editMode ? 'Update & Finalize' : 'Save & Finalize'} <Icons.arrowRight className="w-4 h-4" /></>}
            </Button>
          </form>
        )}

        {step === 'complete' && (
          <div className="p-12 md:p-16 text-center space-y-6">
            <div className="mx-auto size-14 bg-green-50 border border-green-100 flex items-center justify-center">
              <Icons.checkCircle2 className="size-10 text-green-800" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-slate-900">{editMode ? 'Changes Saved' : 'Setup Complete'}</h1>
              <p className="text-slate-500 font-medium max-w-md mx-auto">
                {editMode
                  ? 'Your updated organisation profile has been resubmitted for review. Our team will verify your changes shortly.'
                  : 'Your organisation is now registered and under review. Our team will verify your profile shortly. You\'ll receive an email once approved.'}
              </p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 flex items-center gap-3 text-amber-700 text-sm font-medium max-w-md mx-auto text-left">
              <Icons.info className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">What happens next?</p>
                <p className="font-normal mt-0.5">{editMode ? 'An administrator will review your updated profile. You\'ll receive an email once the review is complete.' : 'An administrator will review your organisation. You\'ll have limited access until verification is complete.'}</p>
              </div>
            </div>
            <Button onClick={finishOnboarding} loading={loading} className="w-full max-w-sm h-11 bg-green-800 hover:bg-green-700 text-white rounded-none shadow-none flex gap-2 text-sm font-semibold mx-auto">
              Go to Dashboard <Icons.arrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {loadingData && (
        <div className="p-4 bg-blue-50 border border-blue-100 flex items-center gap-3 text-blue-600 text-sm font-medium">
          <Icons.spinner className="w-5 h-5 animate-spin shrink-0" />
          <p>Loading your existing data...</p>
        </div>
      )}
    </div>
  );
}






