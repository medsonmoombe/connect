'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface OrgSettings {
  mfa_enforced: boolean;
  password_expiry_days: number;
  min_password_length: number;
  project_submission_mode: 'direct' | 'internal_review';
  internal_reviewer_id: string | null;
}

interface OrgStats {
  totalMembers: number;
  mfaEnabled: number;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const isOrgAdmin = user?.is_org_admin && !user?.is_platform_admin;

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // MFA (user toggle)
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [togglingMfa, setTogglingMfa] = useState(false);
  const [confirmMfa, setConfirmMfa] = useState(false);

  // Org settings (admin only)
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [togglingOrgMfa, setTogglingOrgMfa] = useState(false);
  const [orgForm, setOrgForm] = useState({ mfa_enforced: false, password_expiry_days: 0, min_password_length: 8 });

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({ match_found: true, engagement_updates: true, project_status: true, new_messages: false });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSavingKey, setNotifSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setMfaEnabled(user.mfa_enabled);
  }, [user]);

  // Fetch notification preferences
  useEffect(() => {
    if (!user) return;
    setNotifLoading(true);
    fetch('/api/auth/profile')
      .then(r => r.json())
      .then(d => {
        if (d.notification_preferences) setNotifPrefs(d.notification_preferences);
      })
      .finally(() => setNotifLoading(false));
  }, [user]);

  // Fetch org settings if admin
  useEffect(() => {
    if (!isOrgAdmin) return;
    setOrgLoading(true);

    fetch('/api/org/settings').then(r => r.json()).then(settingsRes => {
      setOrgSettings(settingsRes.settings);
      setOrgStats(settingsRes.stats);
      setOrgForm({
        mfa_enforced: settingsRes.settings?.mfa_enforced ?? false,
        password_expiry_days: settingsRes.settings?.password_expiry_days ?? 0,
        min_password_length: settingsRes.settings?.min_password_length ?? 8,
      });
    }).finally(() => setOrgLoading(false));
  }, [isOrgAdmin]);

  // Password expiry notice
  const passwordExpired = searchParams.get('notice') === 'password_expired';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPw.length < (orgForm.min_password_length || 8)) {
      toast.error(`Password must be at least ${orgForm.min_password_length || 8} characters`);
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
        toast.error(d.error || 'Failed to update password');
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
        toast.error('Failed to update MFA setting');
      }
    } finally {
      setTogglingMfa(false);
      setConfirmMfa(false);
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
        toast.error('Failed to save settings');
      }
    } finally {
      setSavingOrg(false);
    }
  };

  const handleOrgMfaToggle = async () => {
    const newValue = !orgForm.mfa_enforced;
    setTogglingOrgMfa(true);
    try {
      const res = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfa_enforced: newValue }),
      });
      if (res.ok) {
        setOrgForm(prev => ({ ...prev, mfa_enforced: newValue }));
        await refreshUser();
        toast.success(newValue ? 'MFA enforced for all members' : 'MFA enforcement removed');
      } else {
        toast.error('Failed to update MFA enforcement');
      }
    } finally {
      setTogglingOrgMfa(false);
    }
  };

  const handleNotifToggle = async (key: string) => {
    const newValue = !notifPrefs[key as keyof typeof notifPrefs];
    const updated = { ...notifPrefs, [key]: newValue };
    setNotifSavingKey(key);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: updated }),
      });
      if (res.ok) {
        setNotifPrefs(updated);
        toast.success('Preference saved');
      } else {
        toast.error('Failed to save preference');
      }
    } finally {
      setNotifSavingKey(null);
    }
  };

  const mfaBlockedByOrg = isOrgAdmin && orgForm.mfa_enforced;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <p className="dash-section-label mb-1">Account</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">Manage your security, notifications, and preferences.</p>
      </div>

      {/* Password expired banner */}
      {passwordExpired && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <Icons.alertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Password expired</p>
            <p className="text-xs text-amber-600 mt-0.5">Your organisation requires you to change your password. Please update it below.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Password */}
          <div className="dash-card p-8">
            <h3 className="dash-section-label mb-6 flex items-center gap-2">
              <Icons.lock className="size-3.5" />
              Change Password
              {orgForm.password_expiry_days > 0 && (
                <Badge variant="yellow" className="ml-2">Expires every {orgForm.password_expiry_days} days</Badge>
              )}
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Current Password</Label>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  className="h-10 rounded-xl border-slate-200 max-w-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">New Password</Label>
                  <Input
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    required
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={changingPw} className="h-10 px-6 rounded-xl font-bold">
                  {changingPw ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </div>
            </form>
          </div>

          {/* MFA */}
          <div className="dash-card p-8">
            <h3 className="dash-section-label mb-6 flex items-center gap-2">
              <Icons.shieldCheck className="size-3.5" />
              Multi-Factor Authentication
            </h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">Email MFA Verification</p>
                <p className="text-xs text-slate-400 mt-0.5">Require a verification code sent to your email when signing in</p>
              </div>
              {mfaBlockedByOrg ? (
                <div className="flex items-center gap-2">
                  <Badge variant="green">Required by org</Badge>
                  <div className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-primary opacity-60 cursor-not-allowed">
                    <span className="pointer-events-none inline-block size-5 translate-x-5 transform rounded-full bg-white shadow ring-0" />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (mfaEnabled) setConfirmMfa(true);
                    else handleMfaToggle();
                  }}
                  disabled={togglingMfa}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    mfaEnabled ? 'bg-primary' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    mfaEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              )}
            </div>
            {mfaBlockedByOrg && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-700 font-medium">Your organisation requires MFA for all members. This cannot be disabled.</p>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="dash-card p-8">
            <h3 className="dash-section-label mb-6 flex items-center gap-2">
              <Icons.zap className="size-3.5" />
              Email Notifications
            </h3>
            {notifLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {([
                  { key: 'match_found', label: 'New match found', desc: 'When a new partner or project matches your profile' },
                  { key: 'engagement_updates', label: 'Engagement updates', desc: 'Milestone completions, status changes, reviews' },
                  { key: 'project_status', label: 'Project status changes', desc: 'When your submitted projects are updated' },
                  { key: 'new_messages', label: 'New messages', desc: 'When you receive a new message' },
                ] as const).map(item => {
                  const isSaving = notifSavingKey === item.key;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50/80 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                      {isSaving ? (
                        <div className="flex items-center gap-1.5">
                          <Icons.spinner className="size-3.5 animate-spin text-primary" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleNotifToggle(item.key)}
                          disabled={isSaving}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            notifPrefs[item.key] ? 'bg-primary' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Org Settings — only for org admins */}
          {isOrgAdmin && (
            <div className="dash-card p-8">
              <h3 className="dash-section-label mb-6 flex items-center gap-2">
                <Icons.building className="size-3.5" />
                Organisation Security Settings
              </h3>
              {orgLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* MFA Enforcement */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Enforce MFA for all members</p>
                      <p className="text-xs text-slate-400 mt-0.5">When enabled, all organisation members must use MFA. MFA will be auto-enabled for everyone.</p>
                    </div>
                    {togglingOrgMfa ? (
                      <div className="flex items-center gap-2">
                        <Icons.spinner className="size-4 animate-spin text-primary" />
                        <span className="text-xs text-slate-400 font-medium">Saving...</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleOrgMfaToggle}
                        disabled={togglingOrgMfa}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          orgForm.mfa_enforced ? 'bg-primary' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          orgForm.mfa_enforced ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    )}
                  </div>

                  {/* Password Expiry */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Password Expiry</p>
                      <p className="text-xs text-slate-400 mt-0.5">Force members to change their password periodically. Set to 0 for no expiry.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={orgForm.password_expiry_days}
                        onChange={e => setOrgForm(prev => ({ ...prev, password_expiry_days: Math.max(0, Math.min(365, Number(e.target.value))) }))}
                        className="h-10 w-24 rounded-xl border-slate-200 text-center font-bold"
                      />
                      <span className="text-sm text-slate-500 font-medium">days</span>
                      {orgForm.password_expiry_days > 0 && (
                        <Badge variant="yellow">Active</Badge>
                      )}
                    </div>
                  </div>

                  {/* Min Password Length */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Minimum Password Length</p>
                      <p className="text-xs text-slate-400 mt-0.5">Enforce a minimum password length for all members.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={8}
                        max={128}
                        value={orgForm.min_password_length}
                        onChange={e => setOrgForm(prev => ({ ...prev, min_password_length: Math.max(8, Math.min(128, Number(e.target.value))) }))}
                        className="h-10 w-24 rounded-xl border-slate-200 text-center font-bold"
                      />
                      <span className="text-sm text-slate-500 font-medium">characters</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <Button className="h-10 px-6 rounded-xl font-bold" onClick={handleSaveOrgSettings} disabled={savingOrg}>
                      {savingOrg ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
                      Save Organisation Settings
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* MFA Status Card */}
          <div className="dash-card p-6">
            <h3 className="dash-section-label mb-4 flex items-center gap-2">
              <Icons.shieldCheck className="size-3.5" />
              Security Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">MFA</span>
                <Badge variant={mfaEnabled || mfaBlockedByOrg ? 'green' : 'yellow'}>
                  {mfaEnabled || mfaBlockedByOrg ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {orgForm.password_expiry_days > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Password Expiry</span>
                  <Badge variant="blue">{orgForm.password_expiry_days}d</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="dash-card p-6 border border-red-100">
            <h3 className="text-[10px] font-bold text-red-600 uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <Icons.alertTriangle className="size-3.5" />
              Danger Zone
            </h3>
            <p className="text-xs text-slate-400 mb-4">Permanently delete your account and all associated data.</p>
            <Button variant="danger" className="w-full h-10 rounded-xl font-bold" disabled>
              Request Account Deletion
            </Button>
            <p className="text-[10px] text-slate-300 mt-2 text-center">Contact support to proceed</p>
          </div>
        </div>
      </div>

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
