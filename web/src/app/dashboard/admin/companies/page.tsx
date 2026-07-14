'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as ReactDOM from 'react-dom';
import { DataTable, Column } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { Badge, BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type OrgStatus = 'pending_verification' | 'verified' | 'rejected' | 'needs_update' | 'deactivated';

interface OrgMember {
  role: string;
  user_id: string;
  user_profiles: { id: string; full_name: string; email: string; avatar_url?: string; created_at?: string; job_title?: string } | null;
}

interface OrgProject {
  id: string;
  name: string;
  technology_type: string;
  status: string;
  location_country?: string;
  created_at: string;
}

interface OrgRecord {
  id: string;
  name: string;
  primary_role: string;
  country: string;
  status: OrgStatus;
  created_at: string;
  admin_note?: string;
  description?: string;
  website?: string;
  location?: string;
  size?: number;
  logo_url?: string;
  company_members: OrgMember[];
  preferences?: Record<string, any> | null;
  projects?: OrgProject[];
}

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  pending_verification: { variant: 'yellow', label: 'Pending' },
  verified:             { variant: 'green',  label: 'Verified' },
  rejected:             { variant: 'red',    label: 'Rejected' },
  needs_update:         { variant: 'orange', label: 'Needs Update' },
  deactivated:          { variant: 'slate',  label: 'Deactivated' },
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER:         'Developer',
  CAPITAL_PARTNER:   'Capital Partner',
  TECHNICAL_PARTNER: 'Technical Partner',
  GRANT_PROVIDER:    'Grant Provider',
  POWER_TRADER:      'Power Trader',
};

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'members_desc', label: 'Most Members' },
] as const;

type MgmtTab = 'Overview' | 'Members' | 'Projects' | 'Investment Pipeline' | 'Service Pipeline' | 'Offtake Pipeline' | 'Grant Pipeline' | 'Preferences';

function getTabsForRole(role: string): MgmtTab[] {
  switch (role) {
    case 'CAPITAL_PARTNER':   return ['Overview', 'Members', 'Investment Pipeline', 'Preferences'];
    case 'TECHNICAL_PARTNER': return ['Overview', 'Members', 'Service Pipeline', 'Preferences'];
    case 'POWER_TRADER':      return ['Overview', 'Members', 'Offtake Pipeline', 'Preferences'];
    case 'GRANT_PROVIDER':    return ['Overview', 'Members', 'Grant Pipeline'];
    default:                  return ['Overview', 'Members', 'Projects', 'Preferences'];
  }
}

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
  { value: 'PRE_CONSTRUCTION', label: 'Pre-Construction' },
  { value: 'READY_TO_BUILD', label: 'Ready to Build' },
  { value: 'UNDER_CONSTRUCTION', label: 'Under Construction' },
  { value: 'OPERATIONAL', label: 'Operational' },
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

const COUNTRIES = [
  'Zambia', 'Democratic Republic of Congo', 'Zimbabwe', 'Mozambique', 'Botswana',
  'Namibia', 'Malawi', 'Angola', 'Tanzania', 'Kenya', 'Nigeria', 'South Africa',
  'Ghana', 'Uganda', 'Rwanda', 'Senegal', 'Ethiopia', 'Egypt',
];

const COUNTRY_REGIONS: Record<string, string[]> = {
  'Zambia': ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western'],
  'Nigeria': ['Abuja', 'Lagos', 'Kano', 'Rivers', 'Oyo', 'Kaduna', 'Enugu', 'Anambra', 'Delta', 'Ogun'],
  'Kenya': ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Nyeri', 'Eldoret', 'Machakos', 'Kiambu', 'Meru', 'Kilifi'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'],
  'Tanzania': ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza', 'Mbeya', 'Zanzibar', 'Tanga', 'Morogoro', 'Kilimanjaro', 'Rukwa'],
  'Ghana': ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Northern', 'Volta', 'Eastern', 'Brong-Ahafo', 'Upper East', 'Upper West'],
  'Uganda': ['Central', 'Eastern', 'Northern', 'Western'],
  'Rwanda': ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'],
  'Ethiopia': ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'SNNPR', 'Somali', 'Benishangul-Gumuz', 'Gambela', 'Dire Dawa'],
  'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Port Said', 'Suez', 'Ismailia', 'Red Sea', 'Matrouh'],
  'Mozambique': ['Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Zambezia', 'Nampula', 'Cabo Delgado', 'Niassa', 'Tete', 'Manica'],
  'Zimbabwe': ['Harare', 'Bulawayo', 'Midlands', 'Manicaland', 'Mashonaland West', 'Mashonaland Central', 'Mashonaland East', 'Masvingo', 'Matabeleland North', 'Matabeleland South'],
  'Botswana': ['Gaborone', 'Francistown', 'Selebi-Phikwe', 'Maun', 'Kasane', 'Serowe', 'Palapye', 'Molepolole', 'Mochudi', 'Lobatse'],
  'Namibia': ['Windhoek', 'Walvis Bay', 'Swakopmund', 'Oshakati', 'Rundu', 'Grootfontein', 'Katima Mulilo', 'Keetmanshoop', 'Otjiwarongo', 'Gobabis'],
  'Malawi': ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi', 'Karonga', 'Nkhotakota', 'Ntcheu', 'Balaka', 'Mulanje'],
  'Angola': ['Luanda', 'Benguela', 'Huíla', 'Huambo', 'Lunda Norte', 'Lunda Sul', 'Cabinda', 'Uíge', 'Malanje', 'Bié'],
  'Senegal': ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba', 'Mbour', 'Rufisque', 'Diourbel', 'Fatick'],
  'Democratic Republic of Congo': ['Kinshasa', 'Haut-Katanga', 'Kivu du Nord', 'Kivu du Sud', 'Kasaï-Oriental', 'Kasaï-Central', 'Équateur', 'Tshopo', 'Maniema', 'Haut-Uélé'],
};

const ZAMBIAN_PROVINCES = COUNTRY_REGIONS['Zambia'];

const inputClass = "w-full h-9 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm";
const selectClass = "w-full h-9 px-4 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm appearance-none";
const labelClass = "text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1";

// ── MultiSelect ──────────────────────────────────────────────────────────────

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
          className={cn(selectClass, "h-8 text-xs")}
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

// ── Portal-based RowMenu ──────────────────────────────────────────────────

function RowMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[]
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; origin: string }>({ top: 0, right: 0, origin: 'top' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const MENU_HEIGHT = items.length * 36 + 8;

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < MENU_HEIGHT;
      setPos({
        top: openUp ? rect.top - MENU_HEIGHT : rect.bottom + 4,
        right: window.innerWidth - rect.right,
        origin: openUp ? 'bottom' : 'top',
      });
    }
    setOpen(v => !v);
  };

  return (
    <>
      <button ref={triggerRef} onClick={toggle} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <Icons.moreVertical className="size-4" />
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, transformOrigin: pos.origin }}
          className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in duration-150"
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                item.disabled ? 'text-slate-300 cursor-not-allowed'
                  : item.danger ? 'text-red-600 hover:bg-red-50'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Info card helper ──────────────────────────────────────────────────────

function InfoCard({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className="dash-section-label mb-1">{label}</p>
      {children ?? <p className="text-sm font-bold text-slate-900">{value ?? '—'}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminCompaniesPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name_asc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<OrgRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mgmtTab, setMgmtTab] = useState<MgmtTab>('Overview');

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState<OrgStatus | null>(null);

  // Loading states
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingDeactivate, setLoadingDeactivate] = useState(false);
  const [loadingReactivate, setLoadingReactivate] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Edit details state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', website: '', location: '', size: '' });
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Invite member state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [loadingInvite, setLoadingInvite] = useState(false);

  // Status note
  const [statusNote, setStatusNote] = useState('');

  // ── Project creation stepper state ────────────────────────────────────────
  type ProjectStep = 1 | 2 | 3 | 4 | 5;
  const [projectMode, setProjectMode] = useState(false);
  const [projectStep, setProjectStep] = useState<ProjectStep>(1);
  const [loadingProject, setLoadingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    technology_type: 'Solar',
    location_country: '',
    location_region: '',
    project_size_mw: 0,
    capital_required: 0,
    capital_structure_type: 'EQUITY' as string,
    project_stage: 'CONCEPT' as string,
    target_financial_close_date: '',
    target_cod: '',
    governance_terms: '',
    risk_disclosures: '',
    has_secured_land: false,
    land_title_status: 'Not Applicable' as string,
    has_reached_financial_close: false,
    regulatory_approvals: [] as string[],
  });
  const [techReqs, setTechReqs] = useState({
    terrain_complexity: 'SIMPLE',
    grid_status: 'PENDING',
    budget_preference: 'FIXED',
  });

  // ── Preferences edit state ────────────────────────────────────────────────
  const [prefEditMode, setPrefEditMode] = useState(false);
  const [prefForm, setPrefForm] = useState<Record<string, any>>({});
  const [loadingPref, setLoadingPref] = useState(false);

  // ── Pipeline / Matches state ─────────────────────────────────────────────
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchCompany, setMatchCompany] = useState<any>(null);

  const [loadingEngagement, setLoadingEngagement] = useState(false);
  const [loadingRunMatch, setLoadingRunMatch] = useState(false);

  // Fetch orgs — always verified only
  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'verified' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/organizations?${params}`);
      const { data } = await res.json();
      setOrgs(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Refetch a single org's full data
  const refetchOrg = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/organizations/${id}`);
    const { data } = await res.json();
    if (data) {
      setSelected(data);
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    }
  }, []);

  // Fetch matches/pipeline data for an org
  const fetchMatches = useCallback(async (orgId: string) => {
    setLoadingMatches(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/matches`);
      const json = await res.json();
      console.log('[fetchMatches]', { status: res.status, matchCount: json.data?.matches?.length ?? 0, error: json.error });
      if (res.ok) {
        setMatches(json.data?.matches ?? []);
        setMatchCompany(json.data?.company ?? null);
      } else {
        toast.error(json.error || 'Failed to load pipeline');
        setMatches([]);
      }
    } catch (e) {
      console.error('[fetchMatches] network error:', e);
      toast.error('Network error loading pipeline');
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  // Fetch ALL matches globally (used after run matching)
  const fetchGlobalMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch('/api/admin/matches');
      const json = await res.json();
      console.log('[fetchGlobalMatches]', { status: res.status, matchCount: json.data?.matches?.length ?? 0, error: json.error });
      if (res.ok) {
        setMatches(json.data?.matches ?? []);
        setMatchCompany(null);
      } else {
        toast.error(json.error || 'Failed to load matches');
        setMatches([]);
      }
    } catch (e) {
      console.error('[fetchGlobalMatches] network error:', e);
      toast.error('Network error loading matches');
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  // Open drawer
  const openDrawer = (org: OrgRecord) => {
    setSelected(org);
    setMgmtTab('Overview');
    setEditMode(false);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('MEMBER');
    setStatusNote('');
    setProjectMode(false);
    setProjectStep(1);
    setPrefEditMode(false);
    setMatches([]);
    setMatchCompany(null);
    setDrawerOpen(true);
    refetchOrg(org.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setEditMode(false);
    setInviteOpen(false);
    setProjectMode(false);
    setPrefEditMode(false);
    setConfirmDelete(false);
    setConfirmDeactivate(false);
    setConfirmReactivate(false);
    setConfirmStatusChange(null);
    setStatusNote('');
    setMatches([]);
    setMatchCompany(null);
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selected) return;
    setLoadingDelete(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${selected.name}" deleted`);
        setOrgs(prev => prev.filter(o => o.id !== selected.id));
        closeDrawer();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete organisation');
      }
    } finally { setLoadingDelete(false); }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setLoadingDeactivate(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', reason: statusNote || undefined }),
      });
      if (res.ok) {
        toast.success(`"${selected.name}" deactivated`);
        await refetchOrg(selected.id);
        fetchOrgs();
        setConfirmDeactivate(false);
        setStatusNote('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to deactivate');
      }
    } finally { setLoadingDeactivate(false); }
  };

  const handleReactivate = async () => {
    if (!selected) return;
    setLoadingReactivate(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate', status: 'verified', note: statusNote || undefined }),
      });
      if (res.ok) {
        toast.success(`"${selected.name}" reactivated`);
        await refetchOrg(selected.id);
        fetchOrgs();
        setConfirmReactivate(false);
        setStatusNote('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to reactivate');
      }
    } finally { setLoadingReactivate(false); }
  };

  const handleStatusChange = async () => {
    if (!selected || !confirmStatusChange) return;
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: confirmStatusChange, note: statusNote || undefined }),
      });
      if (res.ok) {
        toast.success(`Status updated to ${STATUS_BADGE[confirmStatusChange]?.label ?? confirmStatusChange}`);
        await refetchOrg(selected.id);
        fetchOrgs();
        setConfirmStatusChange(null);
        setStatusNote('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update status');
      }
    } finally { setLoadingStatus(false); }
  };

  const handleEditSave = async () => {
    if (!selected) return;
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          name: editForm.name,
          description: editForm.description,
          website: editForm.website,
          location: editForm.location,
          size: editForm.size ? parseInt(editForm.size) : undefined,
        }),
      });
      if (res.ok) {
        toast.success('Details updated');
        await refetchOrg(selected.id);
        setEditMode(false);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update details');
      }
    } finally { setLoadingEdit(false); }
  };

  const handleInvite = async () => {
    if (!selected || !inviteEmail) return;
    setLoadingInvite(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, membershipRole: inviteRole }),
      });
      if (res.ok) {
        toast.success(`Invite sent to ${inviteEmail}`);
        setInviteOpen(false);
        setInviteEmail('');
        setInviteRole('MEMBER');
        await refetchOrg(selected.id);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send invite');
      }
    } finally { setLoadingInvite(false); }
  };

  // ── Project creation ─────────────────────────────────────────────────────

  const updateProjectForm = (data: Partial<typeof projectForm>) => {
    setProjectForm(prev => ({ ...prev, ...data }));
  };

  const handleProjectSubmit = async () => {
    if (!selected) return;
    setLoadingProject(true);
    try {
      const isEditing = !!editingProjectId;
      const url = isEditing ? `/api/projects/${editingProjectId}` : '/api/projects';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projectForm,
          developer_id: selected.id,
        }),
      });

      if (res.ok) {
        const { data: project } = await res.json();

        // Save tech requirements
        if (project?.id) {
          await fetch(`/api/projects/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _resource: 'tech_requirements', ...techReqs, project_id: project.id }),
          });
        }

        toast.success(isEditing ? 'Project updated' : 'Project created');
        setProjectMode(false);
        setProjectStep(1);
        setEditingProjectId(null);
        setProjectForm({
          name: '', technology_type: 'Solar', location_country: '', location_region: '',
          project_size_mw: 0, capital_required: 0, capital_structure_type: 'EQUITY',
          project_stage: 'CONCEPT', target_financial_close_date: '', target_cod: '',
          governance_terms: '', risk_disclosures: '', has_secured_land: false,
          land_title_status: 'Not Applicable', has_reached_financial_close: false,
          regulatory_approvals: [],
        });
        setTechReqs({ terrain_complexity: 'SIMPLE', grid_status: 'PENDING', budget_preference: 'FIXED' });
        await refetchOrg(selected.id);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save project');
      }
    } finally { setLoadingProject(false); }
  };

  // ── Run matching engine ─────────────────────────────────────────────────

  const handleRunMatch = async (runAll = false) => {
    setLoadingRunMatch(true);
    try {
      const body = runAll
        ? { run_all: true }
        : { project_id: selected?.id };
      const res = await fetch('/api/matching/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { data } = await res.json();
        toast.success(`Matching complete: ${data.capital_matches} capital, ${data.technical_matches} technical matches across ${data.projects} projects`);
        console.log('[handleRunMatch] result:', data);
        fetchGlobalMatches();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Matching failed');
      }
    } finally { setLoadingRunMatch(false); }
  };

  // ── Preferences save ─────────────────────────────────────────────────────

  const handlePrefSave = async () => {
    if (!selected) return;
    setLoadingPref(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_preferences', preferences: prefForm }),
      });
      if (res.ok) {
        toast.success('Preferences updated');
        await refetchOrg(selected.id);
        setPrefEditMode(false);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update preferences');
      }
    } finally { setLoadingPref(false); }
  };

  // ── Filtered + sorted list (client-side, instant) ───────────────────────

  const filteredOrgs = useMemo(() => {
    let result = orgs;

    if (typeFilter !== 'all') {
      result = result.filter(o => o.primary_role === typeFilter);
    }
    if (countryFilter !== 'all') {
      result = result.filter(o => o.country === countryFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':  return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'newest':    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'members_desc': return (b.company_members?.length ?? 0) - (a.company_members?.length ?? 0);
        default: return 0;
      }
    });

    return result;
  }, [orgs, typeFilter, countryFilter, sortBy]);

  // ── Table columns ─────────────────────────────────────────────────────

  const columns: Column<OrgRecord>[] = [
    {
      key: 'name',
      header: 'Organisation',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.logo_url ? (
            <img src={row.logo_url} alt="" className="size-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
              {row.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-bold text-slate-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <span className="text-sm text-slate-600">{ROLE_LABELS[row.primary_role] ?? row.primary_role}</span>,
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => {
        const o = row.company_members?.find(m => m.role === 'OWNER')?.user_profiles;
        return <span className="text-sm text-slate-600">{o?.full_name ?? '—'}</span>;
      },
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => <span className="text-sm text-slate-600">{row.country ?? row.location ?? '—'}</span>,
    },
    {
      key: 'members',
      header: 'Members',
      className: 'text-center',
      render: (row) => <span className="text-sm font-bold text-slate-900">{row.company_members?.length ?? 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const s = STATUS_BADGE[row.status] ?? { variant: 'slate' as BadgeVariant, label: row.status };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      render: (row) => {
        const isDeactivated = row.status === 'deactivated';
        const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [
          {
            label: 'Open organisation',
            icon: <Icons.eye className="size-3.5" />,
            onClick: () => openDrawer(row),
          },
        ];

        if (isDeactivated) {
          menuItems.push({
            label: 'Reactivate',
            icon: <Icons.refreshCw className="size-3.5" />,
            onClick: () => { setSelected(row); setConfirmReactivate(true); },
          });
        } else {
          menuItems.push({
            label: 'Deactivate',
            icon: <Icons.lock className="size-3.5" />,
            onClick: () => { setSelected(row); setConfirmDeactivate(true); },
          });
        }

        menuItems.push({
          label: 'Delete',
          icon: <Icons.trash className="size-3.5" />,
          danger: true,
          onClick: () => { setSelected(row); setConfirmDelete(true); },
        });

        return <RowMenu items={menuItems} />;
      },
    },
  ];

  // ── Members table columns ──────────────────────────────────────────────

  const memberColumns: Column<OrgMember>[] = [
    {
      key: 'name',
      header: 'Member',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-green-800 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white">
              {(row.user_profiles?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{row.user_profiles?.full_name ?? '—'}</p>
            <p className="text-[10px] text-slate-400">{row.user_profiles?.email ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant={row.role === 'OWNER' ? 'green' : row.role === 'ADMIN' ? 'blue' : 'slate'}>
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (row) => (
        <span className="text-sm text-slate-500">
          {row.user_profiles?.created_at ? new Date(row.user_profiles.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      ),
    },
  ];

  const projectColumns: Column<OrgProject>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{row.name}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{row.technology_type?.replace(/_/g, ' ')}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <span className="text-sm text-slate-500">{row.location_country ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'submitted' ? 'green' : row.status === 'draft' ? 'slate' : 'blue'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (row) => (
        <RowMenu items={[
          { label: 'View', icon: <Icons.eye className="size-4" />, onClick: () => router.push(`/projects/${row.id}`) },
          {
            label: 'Edit', icon: <Icons.pencil className="size-4" />, onClick: async () => {
              const res = await fetch(`/api/projects/${row.id}`);
              if (!res.ok) { toast.error('Failed to load project'); return; }
              const { data: p } = await res.json();
              setProjectForm({
                name: p.name ?? '',
                technology_type: p.technology_type ?? 'Solar',
                location_country: p.location_country ?? '',
                location_region: p.location_region ?? '',
                project_size_mw: p.project_size_mw ?? 0,
                capital_required: p.capital_required ?? 0,
                capital_structure_type: p.capital_structure_type ?? 'EQUITY',
                project_stage: p.project_stage ?? 'CONCEPT',
                target_financial_close_date: p.target_financial_close_date ?? '',
                target_cod: p.target_cod ?? '',
                governance_terms: p.governance_terms ?? '',
                risk_disclosures: p.risk_disclosures ?? '',
                has_secured_land: p.has_secured_land ?? false,
                land_title_status: p.land_title_status ?? 'Not Applicable',
                has_reached_financial_close: p.has_reached_financial_close ?? false,
                regulatory_approvals: p.regulatory_approvals ?? [],
              });
              setTechReqs({
                terrain_complexity: p.tech_requirements?.terrain_complexity ?? 'SIMPLE',
                grid_status: p.tech_requirements?.grid_status ?? 'PENDING',
                budget_preference: p.tech_requirements?.budget_preference ?? 'FIXED',
              });
              setEditingProjectId(row.id);
              setProjectMode(true);
              setProjectStep(1);
            },
          },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Organisation Management</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Organisations</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Verified organisations on the platform.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{loading ? '—' : filteredOrgs.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredOrgs.length === 1 ? 'Organisation' : 'Organisations'}</p>
        </div>
      </div>

      {/* Search + Filters bar */}
      <div className="dash-card">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search organisations..."
              className="w-full h-9 pl-10 pr-4 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <Icons.close className="size-3.5" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Country filter */}
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors appearance-none cursor-pointer"
          >
            <option value="all">All Countries</option>
            {[...new Set(orgs.map(o => o.country).filter(Boolean))].sort().map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="h-6 w-px bg-slate-200" />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors appearance-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Active filter chips */}
          {(typeFilter !== 'all' || countryFilter !== 'all') && (
            <>
              <div className="h-6 w-px bg-slate-200" />
              <button
                onClick={() => { setTypeFilter('all'); setCountryFilter('all'); }}
                className="h-7 px-2.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-center">Members</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg shrink-0" /><Skeleton className="h-4 w-32" /></div></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="size-7 rounded-lg ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredOrgs}
            rowKey={(r) => r.id}
            emptyTitle="No organisations found"
            emptyDescription="Try a different filter"
            pageSize={8}
          />
        )}
      </div>

      {/* ── Management Drawer ──────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selected?.name ?? ''}
        description={ROLE_LABELS[selected?.primary_role ?? ''] ?? selected?.primary_role}
        size="xl"
      >
        {selected && (
          <div className="space-y-6">
            {/* Drawer header actions */}
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_BADGE[selected.status]?.variant ?? 'slate'}>
                {STATUS_BADGE[selected.status]?.label ?? selected.status}
              </Badge>
              <div className="flex gap-2">
                {selected.status === 'deactivated' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => setConfirmReactivate(true)}
                  >
                    <Icons.refreshCw className="size-3 mr-1" />
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => setConfirmDeactivate(true)}
                  >
                    <Icons.lock className="size-3 mr-1" />
                    Deactivate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg text-xs font-bold border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icons.trash className="size-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {getTabsForRole(selected.primary_role).map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setMgmtTab(tab);
                    setEditMode(false);
                    setInviteOpen(false);
                    setProjectMode(false);
                    setPrefEditMode(false);
                    if (tab !== 'Overview' && tab !== 'Members' && tab !== 'Projects' && tab !== 'Preferences') {
                      fetchMatches(selected.id);
                    }
                  }}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                    mgmtTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ──────────────────────────────────── */}
            {mgmtTab === 'Overview' && (
              <div className="space-y-6">
                {editMode ? (
                  <div className="space-y-4">
                    <p className="dash-section-label">Edit Details</p>
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Name</label>
                        <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={cn(inputClass, "h-11")} />
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Website</label>
                          <input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} className={cn(inputClass, "h-11")} />
                        </div>
                        <div>
                          <label className={labelClass}>Location</label>
                          <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className={cn(inputClass, "h-11")} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Team Size</label>
                        <input type="number" value={editForm.size} onChange={e => setEditForm(f => ({ ...f, size: e.target.value }))} className={cn(inputClass, "h-11")} />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button className="flex-1 h-10 rounded-xl font-bold bg-green-800 hover:bg-green-700" onClick={handleEditSave} loading={loadingEdit}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <p className="dash-section-label">Organisation Details</p>
                        <button
                          onClick={() => {
                            setEditForm({
                              name: selected.name ?? '',
                              description: selected.description ?? '',
                              website: selected.website ?? '',
                              location: selected.location ?? selected.country ?? '',
                              size: selected.size?.toString() ?? '',
                            });
                            setEditMode(true);
                          }}
                          className="text-xs font-bold text-green-700 hover:text-green-800"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoCard label="Status">
                          <Badge variant={STATUS_BADGE[selected.status]?.variant ?? 'slate'}>
                            {STATUS_BADGE[selected.status]?.label ?? selected.status}
                          </Badge>
                        </InfoCard>
                        <InfoCard label="Type" value={ROLE_LABELS[selected.primary_role] ?? selected.primary_role} />
                        <InfoCard label="Country" value={selected.country} />
                        <InfoCard label="Location" value={selected.location} />
                        <InfoCard label="Team Size" value={selected.size ? `${selected.size} people` : '—'} />
                        <InfoCard label="Created" value={new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                      </div>
                    </section>

                    {selected.logo_url && (
                      <section>
                        <p className="dash-section-label mb-3">Logo</p>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                          <img src={selected.logo_url} alt="" className="size-16 rounded-xl object-cover" />
                          <a href={selected.logo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-700 hover:underline">View full size</a>
                        </div>
                      </section>
                    )}

                    {selected.description && (
                      <section>
                        <p className="dash-section-label mb-3">Description</p>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                        </div>
                      </section>
                    )}

                    {selected.website && (
                      <section>
                        <p className="dash-section-label mb-3">Website</p>
                        <a
                          href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 underline underline-offset-2"
                        >
                          {selected.website}
                          <Icons.arrowUpRight className="size-3.5" />
                        </a>
                      </section>
                    )}

                    {selected.admin_note && (
                      <section>
                        <p className="dash-section-label mb-3" style={{ color: '#d97706' }}>Admin Note</p>
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                          <p className="text-sm text-amber-800 leading-relaxed">{selected.admin_note}</p>
                        </div>
                      </section>
                    )}

                    {(() => {
                      const owner = selected.company_members?.find(m => m.role === 'OWNER');
                      if (!owner?.user_profiles) return null;
                      return (
                        <section>
                          <p className="dash-section-label mb-3">Owner</p>
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                            <div className="size-10 rounded-xl bg-green-800 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-white">
                                {(owner.user_profiles.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">{owner.user_profiles.full_name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{owner.user_profiles.email}</p>
                            </div>
                          </div>
                        </section>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Members ───────────────────────────────────── */}
            {mgmtTab === 'Members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="dash-section-label">
                    Team Members ({selected.company_members?.length ?? 0})
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold"
                    onClick={() => setInviteOpen(!inviteOpen)}
                  >
                    <Icons.plus className="size-3 mr-1" />
                    Invite
                  </Button>
                </div>

                {/* Invite form */}
                {inviteOpen && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100 space-y-3">
                    <p className="text-xs font-bold text-green-800">Invite a new member</p>
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      type="email"
                      className={cn(inputClass, "h-10 border-green-200 bg-white")}
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className={cn(selectClass, "h-10 border-green-200 bg-white")}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Owner</option>
                    </select>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs font-bold" onClick={() => { setInviteOpen(false); setInviteEmail(''); }}>Cancel</Button>
                      <Button className="flex-1 h-9 rounded-xl text-xs font-bold bg-green-800 hover:bg-green-700" onClick={handleInvite} loading={loadingInvite} disabled={!inviteEmail}>Send Invite</Button>
                    </div>
                  </div>
                )}

                {/* Members DataTable */}
                <div className="dash-card overflow-hidden">
                  <DataTable
                    columns={memberColumns}
                    data={selected.company_members ?? []}
                    rowKey={(r) => r.user_id}
                    emptyTitle="No members"
                    emptyDescription="This organisation has no members yet."
                    pageSize={6}
                  />
                </div>
              </div>
            )}

            {/* ── Tab: Projects ─────────────────────────────────── */}
            {mgmtTab === 'Projects' && !projectMode && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="dash-section-label">
                    Projects ({selected.projects?.length ?? 0})
                  </p>
                  <Button
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-green-800 hover:bg-green-700 text-white"
                    onClick={() => { setProjectMode(true); setProjectStep(1); }}
                  >
                    <Icons.plus className="size-3 mr-1" />
                    Create Project
                  </Button>
                </div>
                {selected.projects === undefined ? (
                  <div className="dash-card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 py-3">Project</th>
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                            <td className="px-4 py-3"><Skeleton className="size-7 rounded-lg" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (selected.projects?.length ?? 0) > 0 ? (
                  <div className="dash-card overflow-hidden">
                    <DataTable
                      columns={projectColumns}
                      data={selected.projects!}
                      rowKey={(r) => r.id}
                      emptyTitle="No projects"
                      emptyDescription="This organisation has no projects yet."
                      pageSize={6}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Icons.folder className="size-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No projects yet.</p>
                    <p className="text-xs text-slate-300 mt-1">Create a project to get started.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Project Creation Stepper ──────────────────────────── */}
            {mgmtTab === 'Projects' && projectMode && (
              <div className="space-y-6">
                {/* Back button */}
                <button
                  onClick={() => { setProjectMode(false); setEditingProjectId(null); }}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                >
                  <Icons.arrowLeft className="size-3" />
                  Back to Projects
                </button>

                {/* Step indicators */}
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="flex items-center gap-3 flex-1">
                      <div
                        className={cn(
                          "size-8 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2 shrink-0",
                          projectStep === s
                            ? "bg-green-800 text-white border-green-800 shadow-lg shadow-green-800/20"
                            : projectStep > s
                              ? "bg-green-800/10 text-green-800 border-green-800/20"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                        )}
                      >
                        {projectStep > s ? <Icons.check className="size-4" /> : s}
                      </div>
                      {s < 5 && (
                        <div className={cn("h-0.5 flex-1 rounded-full", projectStep > s ? 'bg-green-800/20' : 'bg-slate-200')} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Step titles */}
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">
                    {projectStep === 1 && "Project Identity"}
                    {projectStep === 2 && "Scale & Financials"}
                    {projectStep === 3 && "Timeline & Status"}
                    {projectStep === 4 && "Technical Requirements"}
                    {projectStep === 5 && "Narrative & Submission"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {projectStep === 1 && "Provide basic details about the infrastructure opportunity."}
                    {projectStep === 2 && "Define the capacity and capital structure of the project."}
                    {projectStep === 3 && "Help partners understand the current stage and expected milestones."}
                    {projectStep === 4 && "Specify what technical services and conditions apply to this site."}
                    {projectStep === 5 && "Add governance details and finalize your submission."}
                  </p>
                </div>

                {/* Step 1: Project Identity */}
                {projectStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Project Name</label>
                        <input placeholder="e.g. Lusaka South Solar II" value={projectForm.name} onChange={e => updateProjectForm({ name: e.target.value })} className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Technology Type</label>
                        <select value={projectForm.technology_type} onChange={e => updateProjectForm({ technology_type: e.target.value })} className={selectClass}>
                          <option>Solar</option><option>Wind</option><option>Hydro</option><option>Biomass</option><option>Geothermal</option><option>Hybrid</option><option>Other</option>
                        </select>
                        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Country</label>
                        <div className="relative">
                          <select value={projectForm.location_country} onChange={e => updateProjectForm({ location_country: e.target.value, location_region: '' })} className={selectClass}>
                            <option value="">Select country...</option>
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Region / City</label>
                        {COUNTRY_REGIONS[projectForm.location_country] ? (
                          <div className="relative">
                            <select
                              value={projectForm.location_region}
                              onChange={e => updateProjectForm({ location_region: e.target.value })}
                              className={selectClass}
                            >
                              <option value="">Select region...</option>
                              {COUNTRY_REGIONS[projectForm.location_country].map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        ) : (
                          <input
                            placeholder="e.g. Lusaka District"
                            value={projectForm.location_region}
                            onChange={e => updateProjectForm({ location_region: e.target.value })}
                            className={inputClass}
                          />
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <p className="dash-section-label flex items-center gap-2">
                        <Icons.checkCircle2 className="size-3.5 text-green-700" />
                        Project Readiness Checklist
                      </p>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" id="secured_land" checked={projectForm.has_secured_land} onChange={e => updateProjectForm({ has_secured_land: e.target.checked })} className="size-4 rounded border-gray-300 text-green-800 focus:ring-green-800" />
                            <label htmlFor="secured_land" className="text-sm font-bold text-slate-700 cursor-pointer">Have you secured the land?</label>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-7">Land Title Status</label>
                            <select value={projectForm.land_title_status} onChange={e => updateProjectForm({ land_title_status: e.target.value })} className={cn(selectClass, "h-8 text-xs ml-7 w-[calc(100%-1.75rem)]")}>
                              <option value="Traditional">Traditional</option><option value="Titled">Titled</option><option value="Not Applicable">Not Applicable</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" id="fin_close" checked={projectForm.has_reached_financial_close} onChange={e => updateProjectForm({ has_reached_financial_close: e.target.checked })} className="size-4 rounded border-gray-300 text-green-800 focus:ring-green-800" />
                            <label htmlFor="fin_close" className="text-sm font-bold text-slate-700 cursor-pointer">Reached financial close?</label>
                          </div>
                          <div className="space-y-2 ml-7">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Regulatory Approvals</label>
                            {['ZEMA approval letter', 'Grid Connection Agreement', 'Power Purchase Agreement (PPA)', 'Construction Permit'].map(approval => (
                              <div key={approval} className="flex items-center gap-2">
                                <input type="checkbox" checked={projectForm.regulatory_approvals.includes(approval)} onChange={e => {
                                  const approvals = e.target.checked ? [...projectForm.regulatory_approvals, approval] : projectForm.regulatory_approvals.filter(a => a !== approval);
                                  updateProjectForm({ regulatory_approvals: approvals });
                                }} className="size-3.5 rounded border-gray-300 text-green-800 focus:ring-green-800" />
                                <span className="text-xs text-slate-500">{approval}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Scale & Financials */}
                {projectStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Project Size (MW)</label>
                        <input type="number" placeholder="e.g. 50" value={projectForm.project_size_mw || ''} onChange={e => { const val = e.target.value; updateProjectForm({ project_size_mw: val === '' ? 0 : parseFloat(val) }); }} className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Capital Required (ZMW)</label>
                        <input type="number" placeholder="e.g. 500000000" value={projectForm.capital_required || ''} onChange={e => { const val = e.target.value; updateProjectForm({ capital_required: val === '' ? 0 : parseFloat(val) }); }} className={inputClass} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Capital Structure Type</label>
                      <div className="relative">
                        <select value={projectForm.capital_structure_type} onChange={e => updateProjectForm({ capital_structure_type: e.target.value })} className={selectClass}>
                          <option value="EQUITY">Equity</option><option value="PROFIT_SHARING">Profit Sharing</option><option value="LEASING">Leasing</option><option value="GRANT">Grant</option>
                        </select>
                        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Timeline & Status */}
                {projectStep === 3 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Project Stage</label>
                      <div className="relative">
                        <select value={projectForm.project_stage} onChange={e => updateProjectForm({ project_stage: e.target.value })} className={selectClass}>
                          <option value="CONCEPT">Concept</option><option value="FEASIBILITY">Feasibility</option><option value="PRE_CONSTRUCTION">Pre-Construction</option><option value="READY_TO_BUILD">Ready to Build</option><option value="UNDER_CONSTRUCTION">Under Construction</option><option value="OPERATIONAL">Operational</option>
                        </select>
                        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Target Financial Close</label>
                        <input type="date" value={projectForm.target_financial_close_date} onChange={e => updateProjectForm({ target_financial_close_date: e.target.value })} className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Target Project Go-Live</label>
                        <input type="date" value={projectForm.target_cod} onChange={e => updateProjectForm({ target_cod: e.target.value })} className={inputClass} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Technical Requirements */}
                {projectStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Terrain Complexity</label>
                        <div className="relative">
                          <select value={techReqs.terrain_complexity} onChange={e => setTechReqs(r => ({ ...r, terrain_complexity: e.target.value }))} className={selectClass}>
                            <option value="SIMPLE">Simple</option><option value="MODERATE">Moderate</option><option value="COMPLEX">Complex</option>
                          </select>
                          <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Grid Status</label>
                        <div className="relative">
                          <select value={techReqs.grid_status} onChange={e => setTechReqs(r => ({ ...r, grid_status: e.target.value }))} className={selectClass}>
                            <option value="CONNECTED">Connected</option><option value="PENDING">Pending</option><option value="OFF_GRID">Off Grid</option>
                          </select>
                          <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Budget Preference</label>
                      <div className="relative">
                        <select value={techReqs.budget_preference} onChange={e => setTechReqs(r => ({ ...r, budget_preference: e.target.value }))} className={selectClass}>
                          <option value="FIXED">Fixed Price</option><option value="MILESTONE">Milestone Based</option><option value="NEGOTIABLE">Negotiable</option>
                        </select>
                        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Narrative & Submission */}
                {projectStep === 5 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Governance Terms</label>
                      <textarea placeholder="e.g. Board seat requirements, voting rights..." value={projectForm.governance_terms} onChange={e => updateProjectForm({ governance_terms: e.target.value })} className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Risk Disclosures</label>
                      <textarea placeholder="e.g. Environmental concerns, local grid instability..." value={projectForm.risk_disclosures} onChange={e => updateProjectForm({ risk_disclosures: e.target.value })} className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20" />
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => projectStep > 1 && setProjectStep((projectStep - 1) as ProjectStep)}
                      disabled={projectStep === 1 || loadingProject}
                      className="h-10 px-4 rounded-xl font-bold text-slate-400 hover:text-slate-600"
                    >
                      <Icons.arrowLeft className="size-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setProjectMode(false);
                        setProjectStep(1);
                        setEditingProjectId(null);
                        setProjectForm({
                          name: '', technology_type: 'Solar', location_country: '', location_region: '',
                          project_size_mw: 0, capital_required: 0, capital_structure_type: 'EQUITY',
                          project_stage: 'CONCEPT', target_financial_close_date: '', target_cod: '',
                          governance_terms: '', risk_disclosures: '', has_secured_land: false,
                          land_title_status: 'Not Applicable', has_reached_financial_close: false,
                          regulatory_approvals: [],
                        });
                        setTechReqs({ terrain_complexity: 'SIMPLE', grid_status: 'PENDING', budget_preference: 'FIXED' });
                      }}
                      disabled={loadingProject}
                      className="h-10 px-4 rounded-xl font-bold text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </Button>
                  </div>
                  {projectStep < 5 ? (
                    <Button
                      onClick={() => projectStep < 5 && setProjectStep((projectStep + 1) as ProjectStep)}
                      className="h-10 px-6 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20 flex gap-2 text-sm"
                    >
                      Next Step
                      <Icons.arrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleProjectSubmit}
                      disabled={loadingProject || !projectForm.name}
                      className="h-10 px-6 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20 flex gap-2 text-sm"
                    >
                      {loadingProject ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.check className="size-4" />}
                      {editingProjectId ? 'Update Project' : 'Create Project'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── Pipeline Tabs (Investment / Service / Offtake / Grant) ────── */}
            {(mgmtTab === 'Investment Pipeline' || mgmtTab === 'Service Pipeline' || mgmtTab === 'Offtake Pipeline' || mgmtTab === 'Grant Pipeline') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="dash-section-label">{mgmtTab}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 px-3 rounded-lg text-xs font-bold bg-green-800 hover:bg-green-700 text-white"
                      disabled={loadingRunMatch}
                      onClick={() => handleRunMatch(true)}
                    >
                      {loadingRunMatch ? <Icons.spinner className="size-3 mr-1 animate-spin" /> : <Icons.zap className="size-3 mr-1" />}
                      Run Matching
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 rounded-lg text-xs font-bold"
                      onClick={() => fetchMatches(selected.id)}
                      disabled={loadingMatches}
                    >
                      <Icons.refreshCw className={cn("size-3 mr-1", loadingMatches && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {loadingMatches ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                        <Skeleton className="size-10 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : matches.length === 0 ? (
                  <div className="text-center py-12">
                    <Icons.search className="size-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-medium">No matches found</p>
                    <p className="text-xs text-slate-300 mt-1">
                      {mgmtTab === 'Offtake Pipeline'
                        ? 'No open projects available for offtake matching yet.'
                        : mgmtTab === 'Grant Pipeline'
                          ? 'No projects seeking grants found yet.'
                          : 'Run the matching engine to find compatible projects.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matches.map((m: any, idx: number) => {
                      const project = m.project;
                      if (!project) return null;

                      const stageLabel = PROJECT_STAGES.find(s => s.value === project.project_stage)?.label ?? project.project_stage;
                      const structLabel = CAPITAL_STRUCTURES.find(s => s.value === project.capital_structure_type)?.label ?? project.capital_structure_type;

                      return (
                        <div key={m.match_id ?? idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 truncate">{project.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {project.technology_type} · {project.location_country}
                                {project.location_region ? `, ${project.location_region}` : ''}
                                {project.project_size_mw ? ` · ${project.project_size_mw} MW` : ''}
                              </p>
                            </div>
                            {m.score != null && (
                              <div className="text-right shrink-0">
                                <p className="text-lg font-bold text-green-800">{m.score}%</p>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Match</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 text-[10px]">
                            <Badge variant={project.status === 'submitted' ? 'green' : project.status === 'draft' ? 'slate' : 'blue'}>
                              {project.status}
                            </Badge>
                            <Badge variant="slate">{stageLabel}</Badge>
                            {structLabel && <Badge variant="slate">{structLabel}</Badge>}
                            {m.developer && <span className="text-slate-400 font-medium">by {m.developer.name}</span>}
                          </div>

                          {/* Score breakdown (for capital/technical matches) */}
                          {m.score_breakdown && typeof m.score_breakdown === 'object' && Object.keys(m.score_breakdown).length > 0 && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-slate-100">
                              {Object.entries(m.score_breakdown as Record<string, number>).map(([key, val]) => (
                                <span key={key} className="text-[10px] text-slate-400">
                                  {key.replace(/_/g, ' ')}: <span className="font-bold text-slate-600">{val}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Tech requirements (for service pipeline) */}
                          {m.tech_requirements && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                              {m.tech_requirements.required_services?.map((s: string) => (
                                <span key={s} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">{s.replace(/_/g, ' ')}</span>
                              ))}
                              {m.tech_requirements.grid_status && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                                  Grid: {m.tech_requirements.grid_status}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 rounded-lg text-[10px] font-bold"
                              onClick={() => {
                                toast.info('Project detail view coming soon');
                              }}
                            >
                              <Icons.eye className="size-3 mr-1" />
                              View Project
                            </Button>
                            {(mgmtTab === 'Investment Pipeline' || mgmtTab === 'Service Pipeline') && (
                              <Button
                                size="sm"
                                className="h-7 px-3 rounded-lg text-[10px] font-bold bg-green-800 hover:bg-green-700 text-white"
                                disabled={loadingEngagement}
                                onClick={async () => {
                                  setLoadingEngagement(true);
                                  try {
                                    const counterpartyType = mgmtTab === 'Investment Pipeline' ? 'CAPITAL' : 'TECHNICAL';
                                    const res = await fetch(`/api/admin/organizations/${selected.id}/matches`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        action: 'create_engagement',
                                        project_id: project.id,
                                        counterparty_type: counterpartyType,
                                      }),
                                    });
                                    if (res.ok) {
                                      toast.success('Engagement created');
                                    } else {
                                      const err = await res.json();
                                      toast.error(err.error || 'Failed to create engagement');
                                    }
                                  } finally {
                                    setLoadingEngagement(false);
                                  }
                                }}
                              >
                                <Icons.send className="size-3 mr-1" />
                                Create Engagement
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Preferences ──────────────────────────────── */}
            {mgmtTab === 'Preferences' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="dash-section-label">
                    {ROLE_LABELS[selected.primary_role] ?? selected.primary_role} Preferences
                  </p>
                  {!prefEditMode && selected.primary_role !== 'DEVELOPER' && (
                    <button
                      onClick={() => {
                        const raw = { ...(selected.preferences || {}) };
                        delete raw.id;
                        delete raw.company_id;
                        delete raw.created_at;
                        delete raw.updated_at;
                        setPrefForm(raw);
                        setPrefEditMode(true);
                      }}
                      className="text-xs font-bold text-green-700 hover:text-green-800"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {selected.primary_role === 'DEVELOPER' ? (
                  <div className="text-center py-8">
                    <Icons.building className="size-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Developers do not have configurable preferences.</p>
                  </div>
                ) : prefEditMode ? (
                  <div className="space-y-5">
                    {/* ── Capital Partner Preferences ────────────── */}
                    {selected.primary_role === 'CAPITAL_PARTNER' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className={labelClass}>Min Ticket Size (ZMW)</label>
                            <input type="number" min={0} value={prefForm.min_ticket_size ?? ''} onChange={e => setPrefForm(f => ({ ...f, min_ticket_size: Number(e.target.value) }))} className={inputClass} />
                          </div>
                          <div className="space-y-2">
                            <label className={labelClass}>Max Ticket Size (ZMW)</label>
                            <input type="number" min={0} value={prefForm.max_ticket_size ?? ''} onChange={e => setPrefForm(f => ({ ...f, max_ticket_size: Number(e.target.value) }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Investment Sector Focus</label>
                          <MultiSelect options={SECTORS} selected={prefForm.sector_focus ?? []} onChange={vals => setPrefForm(f => ({ ...f, sector_focus: vals }))} placeholder="Select sectors..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Geographic Focus</label>
                          <MultiSelect options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))} selected={prefForm.geographic_focus ?? []} onChange={vals => setPrefForm(f => ({ ...f, geographic_focus: vals }))} placeholder="Select provinces..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Risk Tolerance</label>
                          <div className="relative">
                            <select value={prefForm.risk_tolerance ?? ''} onChange={e => setPrefForm(f => ({ ...f, risk_tolerance: e.target.value }))} className={selectClass}>
                              <option value="">Select risk level...</option>
                              {RISK_LEVELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Governance Preference</label>
                          <div className="relative">
                            <select value={prefForm.governance_preference ?? ''} onChange={e => setPrefForm(f => ({ ...f, governance_preference: e.target.value }))} className={selectClass}>
                              <option value="">Select preference...</option>
                              {GOVERNANCE_PREFERENCES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Preferred Project Stages</label>
                          <MultiSelect options={PROJECT_STAGES} selected={prefForm.preferred_project_stage ?? []} onChange={vals => setPrefForm(f => ({ ...f, preferred_project_stage: vals }))} placeholder="Select stages..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Preferred Capital Structures</label>
                          <MultiSelect options={CAPITAL_STRUCTURES} selected={prefForm.preferred_capital_structure ?? []} onChange={vals => setPrefForm(f => ({ ...f, preferred_capital_structure: vals }))} placeholder="Select structures..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Expected Return Profile</label>
                          <input type="text" placeholder="e.g. 15-20% IRR" value={prefForm.expected_return_profile ?? ''} onChange={e => setPrefForm(f => ({ ...f, expected_return_profile: e.target.value }))} className={inputClass} />
                        </div>
                      </>
                    )}

                    {/* ── Technical Partner Preferences ──────────── */}
                    {selected.primary_role === 'TECHNICAL_PARTNER' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className={labelClass}>Years of Experience</label>
                            <input type="number" min={0} value={prefForm.years_of_experience ?? ''} onChange={e => setPrefForm(f => ({ ...f, years_of_experience: Number(e.target.value) }))} className={inputClass} />
                          </div>
                          <div className="space-y-2">
                            <label className={labelClass}>Min Project Size (ZMW)</label>
                            <input type="number" min={0} value={prefForm.min_ticket_size_zmw ?? ''} onChange={e => setPrefForm(f => ({ ...f, min_ticket_size_zmw: Number(e.target.value) }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className={labelClass}>Max Project Size (ZMW)</label>
                            <input type="number" min={0} value={prefForm.max_ticket_size_zmw ?? ''} onChange={e => setPrefForm(f => ({ ...f, max_ticket_size_zmw: Number(e.target.value) }))} className={inputClass} />
                          </div>
                          <div className="space-y-2">
                            <label className={labelClass}>Max MW Capacity</label>
                            <input type="number" min={0} value={prefForm.max_mw_capacity ?? ''} onChange={e => setPrefForm(f => ({ ...f, max_mw_capacity: Number(e.target.value) }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Service Categories</label>
                          <MultiSelect options={SERVICE_CATEGORIES} selected={prefForm.service_categories ?? []} onChange={vals => setPrefForm(f => ({ ...f, service_categories: vals }))} placeholder="Select categories..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Sector Experience</label>
                          <MultiSelect options={SECTORS} selected={prefForm.sector_experience ?? []} onChange={vals => setPrefForm(f => ({ ...f, sector_experience: vals }))} placeholder="Select sectors..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Regions of Operation</label>
                          <MultiSelect options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))} selected={prefForm.regions_operated ?? []} onChange={vals => setPrefForm(f => ({ ...f, regions_operated: vals }))} placeholder="Select provinces..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Preferred Delivery Models</label>
                          <MultiSelect options={DELIVERY_MODELS} selected={prefForm.delivery_models ?? []} onChange={vals => setPrefForm(f => ({ ...f, delivery_models: vals }))} placeholder="Select models..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Payment Terms</label>
                          <input type="text" placeholder="e.g. 20% upfront, milestones..." value={prefForm.payment_terms ?? ''} onChange={e => setPrefForm(f => ({ ...f, payment_terms: e.target.value }))} className={inputClass} />
                        </div>
                      </>
                    )}

                    {/* ── Power Trader Preferences ────────────────── */}
                    {selected.primary_role === 'POWER_TRADER' && (
                      <>
                        <div className="space-y-2">
                          <label className={labelClass}>License Type</label>
                          <div className="relative">
                            <select value={prefForm.license_type ?? ''} onChange={e => setPrefForm(f => ({ ...f, license_type: e.target.value }))} className={selectClass}>
                              <option value="">Select license type...</option>
                              <option value="GENERATION">Generation License</option><option value="TRADING">Trading License</option><option value="DISTRIBUTION">Distribution License</option><option value="TRANSMISSION">Transmission License</option><option value="SUPPLIER">Supplier License</option>
                            </select>
                            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Max Offtake Capacity (MW)</label>
                          <input type="number" min={0} value={prefForm.max_offtake_capacity_mw ?? ''} onChange={e => setPrefForm(f => ({ ...f, max_offtake_capacity_mw: Number(e.target.value) }))} className={inputClass} />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Preferred Technology Types</label>
                          <MultiSelect options={SECTORS.map(s => ({ value: s.value, label: s.label }))} selected={prefForm.preferred_technology_types ?? []} onChange={vals => setPrefForm(f => ({ ...f, preferred_technology_types: vals }))} placeholder="Select technology types..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Regions of Interest</label>
                          <MultiSelect options={ZAMBIAN_PROVINCES.map(p => ({ value: p, label: p }))} selected={prefForm.regions_of_interest ?? []} onChange={vals => setPrefForm(f => ({ ...f, regions_of_interest: vals }))} placeholder="Select provinces..." />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Min PPA Duration (Years)</label>
                          <input type="number" min={1} value={prefForm.min_ppa_duration_years ?? ''} onChange={e => setPrefForm(f => ({ ...f, min_ppa_duration_years: Number(e.target.value) }))} className={inputClass} />
                        </div>
                      </>
                    )}

                    <div className="flex gap-3 pt-3">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold" onClick={() => setPrefEditMode(false)}>Cancel</Button>
                      <Button className="flex-1 h-10 rounded-xl font-bold bg-green-800 hover:bg-green-700" onClick={handlePrefSave} loading={loadingPref}>Save Preferences</Button>
                    </div>
                  </div>
                ) : (
                  /* ── Read-only preferences ──────────────────────── */
                  <div className="space-y-4">
                    {selected.preferences && Object.keys(selected.preferences).length > 2 ? (
                      <div className="dash-card p-5 space-y-4">
                        {Object.entries(selected.preferences).map(([key, value]) => {
                          if (key === 'id' || key === 'company_id' || key === 'created_at' || key === 'updated_at') return null;
                          if (value === null || value === undefined || value === '') return null;
                          const displayValue = Array.isArray(value)
                            ? value.length > 0 ? value.join(', ') : '—'
                            : typeof value === 'object' ? JSON.stringify(value) : String(value);
                          if (displayValue === '—' || displayValue === '0' || displayValue === 'false') return null;
                          const prefLabel = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                          return (
                            <div key={key} className="flex justify-between items-start gap-4 py-2 border-b border-slate-50 last:border-0">
                              <span className="dash-section-label shrink-0">{prefLabel}</span>
                              <span className="text-sm font-medium text-slate-700 text-right">{displayValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Icons.settings className="size-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No preferences recorded.</p>
                        <button onClick={() => {
                          const raw = { ...(selected.preferences || {}) };
                          delete raw.id; delete raw.company_id; delete raw.created_at; delete raw.updated_at;
                          setPrefForm(raw);
                          setPrefEditMode(true);
                        }} className="text-xs font-bold text-green-700 hover:text-green-800 mt-2">
                          Add Preferences
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Confirm: Delete ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Organisation"
        description={`Permanently delete "${selected?.name}"? All members, projects, and data will be removed. This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={loadingDelete}
      />

      {/* ── Confirm: Deactivate ──────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => { setConfirmDeactivate(false); setStatusNote(''); }}
        onConfirm={handleDeactivate}
        title="Deactivate Organisation"
        description={`Deactivate "${selected?.name}"? All members will be blocked from accessing the site until reactivated.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={loadingDeactivate}
      >
        <div className="mt-3">
          <textarea
            value={statusNote}
            onChange={e => setStatusNote(e.target.value)}
            placeholder="Reason (optional, sent to members)..."
            className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20"
          />
        </div>
      </ConfirmDialog>

      {/* ── Confirm: Reactivate ──────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmReactivate}
        onClose={() => { setConfirmReactivate(false); setStatusNote(''); }}
        onConfirm={handleReactivate}
        title="Reactivate Organisation"
        description={`Reactivate "${selected?.name}"? Members will regain access to the platform.`}
        confirmLabel="Reactivate"
        confirmVariant="default"
        loading={loadingReactivate}
      />

      {/* ── Confirm: Status Change ───────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmStatusChange}
        onClose={() => { setConfirmStatusChange(null); setStatusNote(''); }}
        onConfirm={handleStatusChange}
        title={`Change Status to ${STATUS_BADGE[confirmStatusChange ?? '']?.label ?? confirmStatusChange}`}
        description={`Update "${selected?.name}" status to ${STATUS_BADGE[confirmStatusChange ?? '']?.label ?? confirmStatusChange}?`}
        confirmLabel="Update Status"
        confirmVariant={confirmStatusChange === 'rejected' ? 'danger' : 'default'}
        loading={loadingStatus}
      >
        <div className="mt-3">
          <textarea
            value={statusNote}
            onChange={e => setStatusNote(e.target.value)}
            placeholder="Note (optional, sent via email)..."
            className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-800/20"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
