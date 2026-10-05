'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getRoleLabel } from '@/lib/role-labels';
import { companiesApi } from '@/services/api';
import { Company } from '@/types';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'team';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'profile', label: 'Profile', icon: Icons.building, desc: 'Company info & contact details' },
  { id: 'security', label: 'Security', icon: Icons.shieldCheck, desc: 'Password, MFA & org policies' },
  { id: 'notifications', label: 'Notifications', icon: Icons.bell, desc: 'Email & in-app preferences' },
  { id: 'team', label: 'Team', icon: Icons.users, desc: 'Members & invitations' },
];

// ─────────────────────────────────────────────────────────────
// Shared input styling — matches Profile page exactly
// ─────────────────────────────────────────────────────────────

const FIELD_CLASSES =
  'h-11 w-full rounded-none border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] placeholder:text-slate-400';

const TEXTAREA_CLASSES =
  'w-full rounded-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] placeholder:text-slate-400 resize-none';

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{children}</label>;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-[#0b3b24]' : 'bg-slate-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || 'profile');

  const setTab = useCallback(
    (tab: SettingsTab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  // ── Profile state ──
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    website: '',
    description: '',
    team_size: '',
    country: '',
    contact_email: '',
    contact_phone: '',
  });

  // ── Security state ──
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [togglingMfa, setTogglingMfa] = useState(false);
  const [confirmMfa, setConfirmMfa] = useState(false);

  // ── Notifications state ──
  type ChannelPrefs = { email: boolean; inApp: boolean };
  const defaultNotifPrefs: Record<string, ChannelPrefs> = {
    match_found: { email: true, inApp: true },
    engagement_updates: { email: true, inApp: true },
    project_status: { email: true, inApp: true },
    project_live: { email: true, inApp: true },
    project_rejected: { email: true, inApp: true },
    new_messages: { email: true, inApp: true },
  };
  const [notifPrefs, setNotifPrefs] = useState<Record<string, ChannelPrefs>>(defaultNotifPrefs);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSavingKey, setNotifSavingKey] = useState<string | null>(null);

  // ── Org (admin) state ──
  const isOrgAdmin = user?.is_org_admin && !user?.is_platform_admin;
  const [orgForm, setOrgForm] = useState({ mfa_enforced: false, password_expiry_days: 0, min_password_length: 8 });
  const [savingOrg, setSavingOrg] = useState(false);

  // ── Data fetching ──
  useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (!user?.company_id) {
      setLoadingData(false);
      return;
    }
    companiesApi
      .getById(user.company_id)
      .then(res => {
        if (res.data) {
          setCompany(res.data);
          setProfileForm({
            name: res.data.name || '',
            website: res.data.website || '',
            description: res.data.description || '',
            team_size: res.data.team_size?.toString() || '',
            country: res.data.country || '',
            contact_email: res.data.contact_email || '',
            contact_phone: res.data.contact_phone || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [user?.company_id]);

  useEffect(() => {
    if (!user) return;
    setMfaEnabled(user.mfa_enabled);
    setNotifLoading(true);
    fetch('/api/auth/profile')
      .then(r => r.json())
      .then(d => {
        if (d.notification_preferences) setNotifPrefs(d.notification_preferences);
      })
      .finally(() => setNotifLoading(false));
  }, [user]);

  useEffect(() => {
    if (!isOrgAdmin) return;
    fetch('/api/org/settings')
      .then(r => r.json())
      .then(d => {
        setOrgForm({
          mfa_enforced: d.settings?.mfa_enforced ?? false,
          password_expiry_days: d.settings?.password_expiry_days ?? 0,
          min_password_length: d.settings?.min_password_length ?? 8,
        });
      })
      .catch(() => {});
  }, [isOrgAdmin]);

  // ── Handlers ──
  const handleSaveProfile = useCallback(async () => {
    if (!user?.company_id) return;
    setSaving(true);
    try {
      await companiesApi.update(user.company_id, {
        name: profileForm.name,
        website: profileForm.website,
        description: profileForm.description,
        country: profileForm.country,
        team_size: profileForm.team_size ? parseInt(profileForm.team_size) : undefined,
        contact_email: profileForm.contact_email,
        contact_phone: profileForm.contact_phone,
      });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Couldn\u2019t update profile. Try again.');
    } finally {
      setSaving(false);
    }
  }, [user, profileForm]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (res.ok) {
        toast.success('Password updated');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        await refreshUser();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Couldn\u2019t update password');
      }
    } finally {
      setChangingPw(false);
    }
  };

  const handleMfaToggle = async () => {
    setTogglingMfa(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfa_enabled: !mfaEnabled }),
      });
      if (res.ok) {
        setMfaEnabled(!mfaEnabled);
        await refreshUser();
        toast.success(mfaEnabled ? 'MFA disabled' : 'MFA enabled');
      } else {
        toast.error('Couldn\u2019t update MFA setting');
      }
    } finally {
      setTogglingMfa(false);
      setConfirmMfa(false);
    }
  };

  const handleNotifToggle = async (key: string, channel: 'email' | 'inApp') => {
    const prev = notifPrefs[key] ?? { email: true, inApp: true };
    const updated = { ...notifPrefs, [key]: { ...prev, [channel]: !prev[channel] } };
    setNotifSavingKey(`${key}-${channel}`);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: updated }),
      });
      if (res.ok) {
        setNotifPrefs(updated);
        toast.success('Saved');
      } else {
        toast.error('Couldn\u2019t save preference');
      }
    } finally {
      setNotifSavingKey(null);
    }
  };

  const handleSaveOrgSettings = async () => {
    setSavingOrg(true);
    try {
      const res = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm),
      });
      if (res.ok) {
        toast.success('Organisation settings saved');
        await refreshUser();
      } else {
        toast.error('Couldn\u2019t save organisation settings');
      }
    } finally {
      setSavingOrg(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-36 bg-[#0b3b24] animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 animate-pulse" />
      </div>
    );
  }
  const passwordExpired = searchParams.get('notice') === 'password_expired';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageTitle title="Settings" />
      {/* ── Hero ── */}
      <PageHero
        eyebrow="Account Settings"
        title={user?.full_name || 'Settings'}
        description={user?.email || ''}
        actions={
          <div className="flex items-center gap-3">
            <div className="size-12 bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="size-12 object-cover" />
              ) : (
                <span className="text-sm font-black text-white">
                  {(user?.full_name || 'U')
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/15 text-[10px] font-bold text-emerald-200 tracking-wider">
                <Icons.shieldCheck className="size-3" />
                {user?.role ? getRoleLabel(user.role) : 'Member'}
              </span>
              {mfaEnabled && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-300 tracking-wider">
                  <Icons.lock className="size-3" /> MFA On
                </span>
              )}
            </div>
          </div>
        }
      />

      {/* ── Tab Pills ── */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                'h-10 px-4 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2',
                isActive
                  ? 'border-[#0b3b24] text-[#0b3b24]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
              )}
            >
              <tab.icon className="size-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {passwordExpired && (
        <div className="border border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
          <div className="size-10 bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
            <Icons.alertTriangle className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-800">Password expired</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Your organisation requires you to change your password. Please update it below.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PROFILE TAB                                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          {/* Company Details */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div className="flex items-center gap-3">
                <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                  <Icons.building className="size-3.5 text-g-700" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Organisation</p>
                  <h3 className="text-sm font-bold text-slate-900">Company Details</h3>
                </div>
              </div>
              {company && (
                <span className="px-2.5 py-1 bg-white/10 border border-white/15 text-[10px] font-bold text-g-700 tracking-wider uppercase shrink-0">
                  {company.type?.replace(/_/g, ' ') || 'Company'}
                </span>
              )}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {(
                [
                  { l: 'Company Name', k: 'name', t: 'text', p: 'Your company name', full: false },
                  { l: 'Website', k: 'website', t: 'url', p: 'https://example.com', full: false },
                  { l: 'Country', k: 'country', t: 'text', p: 'Country', full: false },
                  { l: 'Team Size', k: 'team_size', t: 'number', p: 'Number of employees', full: false },
                  { l: 'Contact Email', k: 'contact_email', t: 'email', p: 'contact@company.com', full: false },
                  { l: 'Contact Phone', k: 'contact_phone', t: 'tel', p: '+260 ...', full: false },
                  { l: 'Description', k: 'description', t: 'textarea', p: 'Describe your company...', full: true },
                ] as const
              ).map(f => (
                <div key={f.k} className={cn('space-y-2', f.full && 'md:col-span-2')}>
                  <FieldLabel>{f.l}</FieldLabel>
                  {f.t === 'textarea' ? (
                    <textarea
                      value={(profileForm as any)[f.k]}
                      onChange={e => setProfileForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                      rows={3}
                      className={TEXTAREA_CLASSES}
                      placeholder={f.p}
                    />
                  ) : (
                    <input
                      type={f.t}
                      value={(profileForm as any)[f.k]}
                      onChange={e => setProfileForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                      className={FIELD_CLASSES}
                      placeholder={f.p}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-medium">Changes are saved to your organisation profile</p>
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="h-10 px-6 bg-[#0b3b24] hover:bg-[#0b3b24]/90 text-white text-[11px] font-bold tracking-wider rounded-none shrink-0"
              >
                {saving ? (
                  <>
                    <Icons.spinner className="size-3.5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.check className="size-3.5 mr-2" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECURITY TAB                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          {/* Security Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: 'MFA Status',
                value: mfaEnabled ? 'Enabled' : 'Disabled',
                icon: Icons.shieldCheck,
                color: mfaEnabled
                  ? 'text-green-600 bg-green-50 border-green-100'
                  : 'text-amber-600 bg-amber-50 border-amber-100',
              },
              { label: 'Password', value: 'Set', icon: Icons.lock, color: 'text-blue-600 bg-blue-50 border-blue-100' },
              {
                label: 'Account',
                value: user?.is_platform_admin ? 'Platform Admin' : 'Standard',
                icon: Icons.user,
                color: 'text-violet-600 bg-violet-50 border-violet-100',
              },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 flex items-center gap-3"
              >
                <div className={cn('size-10 flex items-center justify-center border', stat.color)}>
                  <stat.icon className="size-5" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Change Password */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <Icons.lock className="size-3.5 text-g-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Security</p>
                <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              </div>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div className="space-y-2">
                <FieldLabel>Current Password</FieldLabel>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>New Password</FieldLabel>
                  <Input
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required
                    className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    required
                    className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button
                  type="submit"
                  disabled={changingPw}
                  className="h-10 px-6 bg-[#0b3b24] hover:bg-[#0b3b24]/90 text-white text-[11px] font-bold tracking-wider rounded-none"
                >
                  {changingPw ? (
                    <>
                      <Icons.spinner className="size-3.5 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* MFA */}
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <Icons.shieldCheck className="size-3.5 text-g-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Security</p>
                <h3 className="text-sm font-bold text-slate-900">Multi-Factor Authentication</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'size-9 flex items-center justify-center',
                      mfaEnabled ? 'bg-green-100' : 'bg-slate-200'
                    )}
                  >
                    <Icons.shieldCheck className={cn('size-4', mfaEnabled ? 'text-green-600' : 'text-slate-400')} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Email MFA Verification</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Require a verification code sent to your email when signing in
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={mfaEnabled}
                  onChange={() => {
                    if (mfaEnabled) setConfirmMfa(true);
                    else handleMfaToggle();
                  }}
                  disabled={togglingMfa}
                />
              </div>
            </div>
          </div>

          {/* Org Settings */}
          {isOrgAdmin && (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
                <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                  <Icons.building className="size-3.5 text-g-700" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Organisation</p>
                  <h3 className="text-sm font-bold text-slate-900">Organisation Security</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Enforce MFA for all members</p>
                    <p className="text-[11px] text-slate-400 font-medium">All organisation members must use MFA</p>
                  </div>
                  <Toggle checked={orgForm.mfa_enforced} onChange={handleSaveOrgSettings} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FieldLabel>Password Expiry</FieldLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={orgForm.password_expiry_days}
                        onChange={e =>
                          setOrgForm(p => ({
                            ...p,
                            password_expiry_days: Math.max(0, Math.min(365, Number(e.target.value))),
                          }))
                        }
                        className="h-11 w-24 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-center font-bold"
                      />
                      <span className="text-sm text-slate-500 font-medium">days</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Min Password Length</FieldLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={8}
                        max={128}
                        value={orgForm.min_password_length}
                        onChange={e =>
                          setOrgForm(p => ({
                            ...p,
                            min_password_length: Math.max(8, Math.min(128, Number(e.target.value))),
                          }))
                        }
                        className="h-11 w-24 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-center font-bold"
                      />
                      <span className="text-sm text-slate-500 font-medium">chars</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button
                    className="h-10 px-6 bg-[#0b3b24] hover:bg-[#0b3b24]/90 text-white text-[11px] font-bold tracking-wider rounded-none"
                    onClick={handleSaveOrgSettings}
                    disabled={savingOrg}
                  >
                    {savingOrg ? (
                      <>
                        <Icons.spinner className="size-3.5 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Organisation Settings'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="border border-red-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-6 py-5 border-b border-red-100 flex items-center gap-3">
              <div className="size-10 bg-red-50 border border-red-200 flex items-center justify-center">
                <Icons.alertTriangle className="size-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-800">Danger Zone</h3>
                <p className="text-[11px] text-red-400 font-medium">Irreversible account actions</p>
              </div>
            </div>
            <div className="px-6 py-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Delete your account and all associated data</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  This action cannot be undone. Contact support to proceed.
                </p>
              </div>
              <Button
                variant="outline"
                className="h-9 px-4 rounded-none text-[11px] font-bold text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                disabled
              >
                Request Deletion
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* NOTIFICATIONS TAB                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'notifications' && (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <Icons.bell className="size-3.5 text-g-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Preferences</p>
                <h3 className="text-sm font-bold text-slate-900">Notification Preferences</h3>
              </div>
            </div>
            <div className="p-6">
              {notifLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-6 w-11 ounded-full" />
                        <Skeleton className="h-6 w-11 ounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center px-4 pb-3 mb-2 border-b border-slate-100">
                    <div className="flex-1" />
                    <div className="w-24 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Email
                    </div>
                    <div className="w-24 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      In-App
                    </div>
                  </div>
                  {/* Rows */}
                  {(
                    [
                      { key: 'match_found', label: 'New match found', desc: 'When a new partner matches your profile', icon: Icons.target },
                      { key: 'engagement_updates', label: 'Engagement updates', desc: 'Status changes and milestone completions', icon: Icons.activity },
                      { key: 'project_status', label: 'Project status changes', desc: 'When your submitted projects are updated', icon: Icons.folder },
                      { key: 'project_live', label: 'Project goes live', desc: 'When your project is published to the marketplace', icon: Icons.eye },
                      { key: 'project_rejected', label: 'Project rejected', desc: 'When your submitted project is rejected', icon: Icons.alertTriangle },
                      { key: 'new_messages', label: 'New messages', desc: 'When you receive a new message from a partner', icon: Icons.messageSquare },
                    ] as const
                  ).map((item, idx) => {
                    const prefs = notifPrefs[item.key] ?? { email: true, inApp: true };
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50',
                          idx < 5 && 'border-b border-slate-50'
                        )}
                      >
                        <div className="size-9 bg-slate-100 flex items-center justify-center shrink-0">
                          <ItemIcon className="size-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-800">{item.label}</p>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{item.desc}</p>
                        </div>
                        {(['email', 'inApp'] as const).map(channel => (
                          <div key={channel} className="w-24 flex justify-center">
                            {notifSavingKey === `${item.key}-${channel}` ? (
                              <Icons.spinner className="size-3.5 animate-spin text-[#0b3b24]" />
                            ) : (
                              <Toggle checked={prefs[channel]} onChange={() => handleNotifToggle(item.key, channel)} />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TEAM TAB                                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div className="flex items-center gap-3">
                <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                  <Icons.users className="size-3.5 text-g-700" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Team</p>
                  <h3 className="text-sm font-bold text-slate-900">Team Members</h3>
                </div>
              </div>
              <Link href="/settings/team">
                <Button
                  className="h-9 px-5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-bold tracking-wider rounded-none shrink-0"
                  icon={<Icons.arrowRight className="size-3.5" />}
                >
                  Manage Team
                </Button>
              </Link>
            </div>
            <div className="p-6 space-y-4">
              {/* Current user */}
              <div className="flex items-center gap-4 p-4 bg-green-50/50 border border-green-100">
                <div className="relative">
                  <div className="size-12 bg-[#0b3b24] text-white flex items-center justify-center font-black text-sm">
                    {user?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-green-500 border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{user?.full_name || 'User'}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{user?.email}</p>
                </div>
                <span className="px-2.5 py-1 bg-[#0b3b24] text-white text-[9px] font-bold tracking-widest uppercase">
                  Owner
                </span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Your Role', value: user?.org_member_role || 'OWNER', color: 'text-[#0b3b24] bg-green-50 border-green-100' },
                  {
                    label: 'MFA',
                    value: mfaEnabled ? 'Enabled' : 'Disabled',
                    color: mfaEnabled ? 'text-green-700 bg-green-50 border-green-100' : 'text-amber-700 bg-amber-50 border-amber-100',
                  },
                  { label: 'Status', value: 'Active', color: 'text-green-700 bg-green-50 border-green-100' },
                ].map(stat => (
                  <div key={stat.label} className={cn('p-3 border text-center', stat.color)}>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">{stat.label}</p>
                    <p className="text-xs font-bold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="p-6 text-center border border-dashed border-slate-200 bg-slate-50/50">
                <div className="size-12 bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                  <Icons.users className="size-5 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">Grow your team</p>
                <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                  Invite colleagues to collaborate on projects, share insights, and manage your portfolio together.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmMfa}
        onClose={() => setConfirmMfa(false)}
        onConfirm={handleMfaToggle}
        title="Disable MFA"
        description="Are you sure you want to disable multi-factor authentication? This will reduce the security of your account."
        confirmLabel="Disable MFA"
        confirmVariant="danger"
        loading={togglingMfa}
      />
    </div>
  );
}