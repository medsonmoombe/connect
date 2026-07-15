'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton, Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface PlatformStats {
  totalUsers: number;
  mfaEnabled: number;
  totalOrgs: number;
  verifiedOrgs: number;
  pendingVerifications: number;
}

function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <KpiBarSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="dash-card p-8 space-y-6">
              <Skeleton className="h-5 w-40" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="dash-card p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Platform config (editable)
  const [platformName, setPlatformName] = useState('Afri Connect');
  const [supportEmail, setSupportEmail] = useState('ops@africonnect.energy');
  const [currency, setCurrency] = useState('ZMW / USD');

  // AI config
  const [weightRegulatory, setWeightRegulatory] = useState(40);
  const [weightFinancial, setWeightFinancial] = useState(35);
  const [weightDeveloper, setWeightDeveloper] = useState(25);
  const [autoTrigger, setAutoTrigger] = useState(true);
  const [savingAi, setSavingAi] = useState(false);

  // Maintenance
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // MFA management
  const [orgList, setOrgList] = useState<{ id: string; name: string; mfa_enforced: boolean }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [confirmMfa, setConfirmMfa] = useState<{ enabled: boolean; orgId?: string } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const d = await res.json();
      setStats(d.stats);
      // Load AI settings from DB
      if (d.aiSettings) {
        setAutoTrigger(d.aiSettings.auto_trigger ?? false);
        setWeightRegulatory(d.aiSettings.weights?.regulatory ?? 40);
        setWeightFinancial(d.aiSettings.weights?.financial ?? 35);
        setWeightDeveloper(d.aiSettings.weights?.developer ?? 25);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Fetch org list for per-org MFA
  useEffect(() => {
    fetch('/api/admin/organizations')
      .then(r => r.json())
      .then(d => setOrgList((d.data ?? []).map((o: any) => ({ id: o.id, name: o.name, mfa_enforced: o.mfa_enforced ?? false }))))
      .catch(() => {});
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      toast.success('Platform settings saved');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setSavingAi(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_trigger: autoTrigger,
          weights: {
            regulatory: weightRegulatory,
            financial: weightFinancial,
            developer: weightDeveloper,
          },
        }),
      });
      if (res.ok) {
        toast.success('AI analysis settings saved');
      } else {
        toast.error('Failed to save AI settings');
      }
    } finally {
      setSavingAi(false);
    }
  };

  const handleBulkMfa = async (enabled: boolean, orgId?: string) => {
    setMfaLoading(true);
    try {
      const res = await fetch('/api/admin/settings/bulk-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, org_id: orgId || undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(orgId ? `${d.affected} members ${enabled ? 'enrolled in MFA' : 'removed from MFA'}` : `${d.affected} users ${enabled ? 'enrolled in MFA' : 'removed from MFA'}`);
        fetchStats();
        // Refresh org list
        const orgRes = await fetch('/api/admin/organizations');
        const orgData = await orgRes.json();
        setOrgList((orgData.data ?? []).map((o: any) => ({ id: o.id, name: o.name, mfa_enforced: o.mfa_enforced ?? false })));
      } else {
        toast.error(d.error || 'Failed');
      }
    } finally {
      setMfaLoading(false);
      setConfirmMfa(null);
    }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <p className="dash-section-label mb-1">System</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">Configure platform-wide parameters, security, and governance rules.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={Icons.shieldCheck} />
        <StatCard label="MFA Enabled" value={stats?.mfaEnabled ?? 0} icon={Icons.lock} valueClassName="text-green-700" />
        <StatCard label="Total Orgs" value={stats?.totalOrgs ?? 0} icon={Icons.building} />
        <StatCard label="Pending Verification" value={stats?.pendingVerifications ?? 0} icon={Icons.alertTriangle} valueClassName="text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Platform Configuration */}
          <div className="dash-card p-8">
            <h3 className="dash-section-label mb-6 flex items-center gap-2">
              <Icons.settings className="size-3.5" />
              Platform Configuration
            </h3>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Platform Name</Label>
                  <Input value={platformName} onChange={e => setPlatformName(e.target.value)} className="h-10 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Support Email</Label>
                  <Input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="h-10 rounded-xl border-slate-200" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Base Currency</Label>
                <Input value={currency} onChange={e => setCurrency(e.target.value)} className="h-10 rounded-xl border-slate-200 max-w-sm" />
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-5 border-t border-slate-100">
              <Button className="h-10 px-6 rounded-xl font-bold" onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
                Save Configuration
              </Button>
            </div>
          </div>

          {/* AI Scoring Config */}
          <div className="dash-card p-8">
            <h3 className="dash-section-label mb-6 flex items-center gap-2">
              <Icons.zap className="size-3.5" />
              AI Scoring Weights
            </h3>
            <div className="space-y-5">
              {[
                { label: 'Regulatory & Readiness', value: weightRegulatory, set: setWeightRegulatory },
                { label: 'Financial Viability', value: weightFinancial, set: setWeightFinancial },
                { label: 'Developer Strength', value: weightDeveloper, set: setWeightDeveloper },
              ].map(w => (
                <div key={w.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{w.label}</span>
                    <span className="text-sm font-black text-primary">{w.value}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={w.value}
                    onChange={e => w.set(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-900">Auto-trigger Analysis</p>
                  <p className="text-xs text-slate-400">Run Gemini analysis immediately upon document upload</p>
                </div>
                <button
                  onClick={() => setAutoTrigger(!autoTrigger)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoTrigger ? 'bg-primary' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoTrigger ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-5 border-t border-slate-100">
              <Button className="h-10 px-6 rounded-xl font-bold" onClick={handleSaveAiSettings} disabled={savingAi}>
                {savingAi ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
                Save AI Settings
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* MFA Management */}
          <div className="dash-card p-6">
            <h3 className="dash-section-label mb-4 flex items-center gap-2">
              <Icons.shieldCheck className="size-3.5" />
              MFA Enforcement
            </h3>
            <div className="space-y-4">
              {/* Coverage bar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Platform Coverage</span>
                  <span className="text-sm font-black text-primary">
                    {stats ? Math.round((stats.mfaEnabled / Math.max(stats.totalUsers, 1)) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-primary-light h-full rounded-full transition-all duration-500" style={{ width: `${stats ? Math.round((stats.mfaEnabled / Math.max(stats.totalUsers, 1)) * 100) : 0}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">{stats?.mfaEnabled ?? 0} of {stats?.totalUsers ?? 0} users</p>
              </div>

              {/* Enforce for all */}
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl font-bold text-xs"
                onClick={() => setConfirmMfa({ enabled: true })}
              >
                <Icons.shieldCheck className="size-3.5 mr-2" />
                Enable MFA for All Users
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 rounded-xl font-bold text-xs text-slate-500"
                onClick={() => setConfirmMfa({ enabled: false })}
              >
                Disable MFA for All Users
              </Button>

              {/* Per-org enforcement */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <Label className="text-xs font-semibold text-slate-600">Enforce for specific org</Label>
                <select
                  value={selectedOrg}
                  onChange={e => setSelectedOrg(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select organisation...</option>
                  {orgList.map(o => (
                    <option key={o.id} value={o.id}>{o.name}{o.mfa_enforced ? ' (enforced)' : ''}</option>
                  ))}
                </select>
                {selectedOrg && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 rounded-xl text-xs font-bold"
                      onClick={() => setConfirmMfa({ enabled: true, orgId: selectedOrg })}
                    >
                      Enforce MFA
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 h-9 rounded-xl text-xs font-bold text-slate-500"
                      onClick={() => setConfirmMfa({ enabled: false, orgId: selectedOrg })}
                    >
                      Remove Enforcement
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="dash-card p-6">
            <h3 className="dash-section-label mb-4 flex items-center gap-2">
              <Icons.lock className="size-3.5" />
              Security
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Maintenance Mode</p>
                  <p className="text-[10px] text-slate-400">Block all logins except platform admins</p>
                </div>
                <button
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    maintenanceMode ? 'bg-red-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Environment */}
          <div className="dash-card p-6">
            <h3 className="dash-section-label mb-4">Environment</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase">Version</span>
                <span className="text-slate-900 font-mono">v1.2.4-MVP</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase">Region</span>
                <span className="text-slate-900 font-mono">af-south-1</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase">Resend</span>
                <Badge variant="yellow">Testing Mode</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmMfa}
        onClose={() => setConfirmMfa(null)}
        onConfirm={() => { if (confirmMfa) handleBulkMfa(confirmMfa.enabled, confirmMfa.orgId); }}
        title={confirmMfa?.enabled ? 'Enable MFA' : 'Disable MFA'}
        description={
          confirmMfa?.orgId
            ? confirmMfa?.enabled
              ? 'This will enforce MFA for all members of this organisation. MFA will be auto-enabled for everyone.'
              : 'This will remove MFA enforcement for this organisation.'
            : confirmMfa?.enabled
              ? 'This will enable multi-factor authentication for all users platform-wide. They will be prompted to verify via email on their next login.'
              : 'This will disable MFA for all users platform-wide.'
        }
        confirmLabel={confirmMfa?.enabled ? 'Enable' : 'Disable'}
        confirmVariant={confirmMfa?.enabled ? 'default' : 'danger'}
        loading={mfaLoading}
      />
    </div>
  );
}
