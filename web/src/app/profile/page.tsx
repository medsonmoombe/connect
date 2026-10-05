'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: 'Developer',
  CAPITAL_PARTNER: 'Capital Partner',
  TECHNICAL_PARTNER: 'EPC / Operator',
  POWER_TRADER: 'Power Trader',
  GRANT_PROVIDER: 'Grant Provider',
  CONSULTANT: 'Consultant',
  ADMIN: 'Platform Admin',
};

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
  needs_update: 'bg-blue-50 text-blue-700 border-blue-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

interface ProfileState {
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  avatar_url: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{children}</label>;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-bold text-slate-800 text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider',
        STATUS_STYLES[status || ''] || 'bg-slate-50 text-slate-500 border-slate-200'
      )}
    >
      {status?.replace(/_/g, ' ') || '—'}
    </span>
  );
}

function SectionCard({
  eyebrow,
  title,
  icon,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div className="size-7 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">{eyebrow}</p>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
      </div>
      {children}
      {footer}
    </div>
  );
}

function Avatar({
  src,
  initials,
  size,
  loading,
  editable,
  onClick,
}: {
  src: string | null;
  initials: string;
  size: 'sm' | 'lg';
  loading?: boolean;
  editable?: boolean;
  onClick?: () => void;
}) {
  const dims = size === 'lg' ? 'size-20' : 'size-12';
  const textSize = size === 'lg' ? 'text-xl' : 'text-sm';

  return (
    <button
      type="button"
      onClick={editable ? onClick : undefined}
      disabled={!editable}
      aria-label={editable ? 'Change profile picture' : undefined}
      className={cn(
        'relative shrink-0 overflow-hidden group',
        dims,
        size === 'lg' ? 'border-2 border-slate-200' : 'rounded-none bg-white/10 border border-white/15',
        editable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2'
      )}
    >
      {src ? (
        <img src={src} alt="Your profile picture" className={cn(dims, 'object-cover')} />
      ) : (
        <div className={cn(dims, 'flex items-center justify-center', size === 'lg' ? 'bg-[#0b3b24]' : '')}>
          <span className={cn(textSize, 'font-black text-white')}>{initials}</span>
        </div>
      )}
      {editable && (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {loading ? (
            <Icons.spinner className="size-4 text-white animate-spin" />
          ) : (
            <Icons.camera className="size-4 text-white" />
          )}
        </div>
      )}
      {size === 'lg' && !loading && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 border-2 border-white" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [profile, setProfile] = useState<ProfileState>({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    avatar_url: '',
    created_at: '',
  });

  useEffect(() => {
    if (!user) return;
    setProfile({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
      avatar_url: user.avatar_url || '',
      created_at: user.created_at || '',
    });
    setLoading(false);
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone || null,
          job_title: profile.job_title || null,
        }),
      });
      if (res.ok) {
        await refreshUser();
        toast.success('Profile updated');
      } else {
        toast.error('Couldn\u2019t update profile. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Password updated');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      } else {
        toast.error(d.error || 'Couldn\u2019t update password');
      }
    } finally {
      setChangingPw(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image must be under 5MB');
      e.target.value = '';
      return;
    }
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Accepted formats: JPEG, PNG, WebP, GIF');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/auth/avatar', { method: 'POST', body: formData });
      if (res.ok) {
        const { avatar_url } = await res.json();
        setProfile(prev => ({ ...prev, avatar_url }));
        await refreshUser();
        toast.success('Profile picture updated');
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Upload failed. Try a different image.');
      }
    } finally {
      setAvatarPreview(null);
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const res = await fetch('/api/auth/avatar', { method: 'DELETE' });
      if (res.ok) {
        setProfile(prev => ({ ...prev, avatar_url: '' }));
        setAvatarPreview(null);
        await refreshUser();
        toast.success('Profile picture removed');
      } else {
        toast.error('Couldn\u2019t remove picture');
      }
    } catch {
      toast.error('Couldn\u2019t remove picture');
    }
  };

  const initials =
    (profile.full_name || 'U')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const avatarSrc = avatarPreview || profile.avatar_url || null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full" />
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const accessFacts: Array<{ label: string; value: ReactNode }> = [
    { label: 'Platform Role', value: ROLE_LABELS[user?.role || ''] || user?.role || '—' },
    { label: 'Org Role', value: user?.org_member_role || '—' },
    { label: 'MFA', value: user?.mfa_enabled ? 'Enabled' : 'Disabled' },
    { label: 'Platform Admin', value: user?.is_platform_admin ? 'Yes' : 'No' },
    { label: 'Org Admin', value: user?.is_org_admin ? 'Yes' : 'No' },
    { label: 'Verification', value: <StatusBadge status={user?.verification_status} /> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Profile" />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES.join(',')}
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* ── Hero ── */}
      <PageHero
        eyebrow="Account"
        title="My Profile"
        description="Manage your personal information, picture, and account security."
        actions={
          <div className="flex items-center gap-3">
            <Avatar src={avatarSrc} initials={initials} size="sm" loading={uploadingAvatar} />
            <div>
              <p className="text-sm font-bold text-white">{profile.full_name || 'User'}</p>
              <p className="text-[11px] text-emerald-200/60">{profile.email}</p>
            </div>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Left: Personal Info + Security ── */}
        <div className="lg:col-span-2 space-y-5">
          <SectionCard
            eyebrow="Personal"
            title="Personal Information"
            icon={<Icons.user className="size-3.5" />}
            footer={
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                <p className="text-[10px] text-slate-400 font-medium">
                  Changes apply to your personal account only
                </p>
                <Button
                  onClick={handleSave}
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
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            }
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <FieldLabel>Full Name</FieldLabel>
                <Input
                  value={profile.full_name}
                  onChange={e => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                  className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Email Address</FieldLabel>
                <Input
                  value={profile.email}
                  disabled
                  aria-readonly
                  className="h-11 rounded-none border-slate-200 bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Phone Number</FieldLabel>
                <Input
                  value={profile.phone}
                  onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+260 ..."
                  className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Job Title</FieldLabel>
                <Input
                  value={profile.job_title}
                  onChange={e => setProfile(prev => ({ ...prev, job_title: e.target.value }))}
                  placeholder="e.g. Project Manager"
                  className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                />
              </div>
            </div>
          </SectionCard>

          {/* Security — password change + MFA (previously only in Settings) */}
          <SectionCard
            eyebrow="Security"
            title="Password & Access"
            icon={<Icons.lock className="size-3.5" />}
            footer={
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                <p className="text-[10px] text-slate-400 font-medium">
                  {user?.mfa_enabled ? 'MFA is protecting this account' : 'Tip: enable MFA in Settings → Security'}
                </p>
                <Link
                  href="/settings?tab=security"
                  className="text-[10px] font-bold text-[#166b3b] hover:underline tracking-wider shrink-0"
                >
                  Security settings →
                </Link>
              </div>
            }
          >
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div className="space-y-2">
                <FieldLabel>Current Password</FieldLabel>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  autoComplete="current-password"
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
                    autoComplete="new-password"
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
                    autoComplete="new-password"
                    className="h-11 rounded-none border-slate-200 bg-slate-50 focus:bg-white focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] text-sm font-medium"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-medium">
                  Min 8 characters with upper, lower, number &amp; symbol
                </p>
                <Button
                  type="submit"
                  disabled={changingPw}
                  className="h-9 px-5 bg-[#0b3b24] hover:bg-[#0b3b24]/90 text-white text-[11px] font-bold rounded-none"
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
          </SectionCard>

          <SectionCard
            eyebrow="Access"
            title="Role & Permissions"
            icon={<Icons.shieldCheck className="size-3.5" />}
          >
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-3">
              {accessFacts.map(({ label, value }) => (
                <div key={label} className="p-3 border border-slate-100 bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-xs font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-5">
          <SectionCard
            eyebrow="Photo"
            title="Profile Picture"
            icon={<Icons.camera className="size-3.5" />}
          >
            <div className="p-6 flex flex-col items-center text-center">
              <div className="mb-4">
                <Avatar
                  src={avatarSrc}
                  initials={initials}
                  size="lg"
                  loading={uploadingAvatar}
                  editable
                  onClick={() => fileInputRef.current?.click()}
                />
              </div>
              <p className="text-sm font-bold text-slate-900">{profile.full_name || 'User'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-full">{profile.email}</p>
              <div className="flex gap-2 mt-4 w-full">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-[11px] font-bold border-slate-200 rounded-none"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Icons.spinner className="size-3 animate-spin mr-1.5" />
                  ) : (
                    <Icons.upload className="size-3 mr-1.5" />
                  )}
                  Upload
                </Button>
                {profile.avatar_url && (
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-[11px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-none"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-3">JPEG, PNG, WebP or GIF · Max 5MB</p>
            </div>
          </SectionCard>

          {user?.company_name && (
            <SectionCard
              eyebrow="Organisation"
              title={user.company_name}
              icon={<Icons.building className="size-3.5" />}
              footer={
                <Link
                  href="/settings/team"
                  className="block px-5 py-3 border-t border-slate-100 text-center text-[10px] font-bold text-[#166b3b] tracking-wider hover:underline"
                >
                  Manage team members →
                </Link>
              }
            >
              <div className="p-5">
                <InfoRow label="Company" value={user.company_name} />
                <InfoRow label="Verification" value={<StatusBadge status={user.verification_status} />} />
              </div>
            </SectionCard>
          )}

          <SectionCard
            eyebrow="Account"
            title="Account Details"
            icon={<Icons.shieldCheck className="size-3.5" />}
          >
            <div className="p-5">
              <InfoRow
                label="Member Since"
                value={
                  profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'
                }
              />
              <InfoRow
                label="MFA"
                value={
                  <span
                    className={cn(
                      'px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider',
                      user?.mfa_enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    )}
                  >
                    {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                }
              />
              <InfoRow label="Account Type" value={user?.is_platform_admin ? 'Platform Admin' : 'Standard'} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
