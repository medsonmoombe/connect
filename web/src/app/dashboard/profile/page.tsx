'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: 'Developer',
  CAPITAL_PARTNER: 'Capital Partner',
  TECHNICAL_PARTNER: 'Technical Partner',
  POWER_TRADER: 'Power Trader',
  GRANT_PROVIDER: 'Grant Provider',
  ADMIN: 'Platform Admin',
};

const STATUS_VARIANTS: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = {
  verified: 'green',
  pending_verification: 'yellow',
  needs_update: 'blue',
  rejected: 'red',
};

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="dash-card p-8 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    avatar_url: '',
    created_at: '',
    email_verified_at: '',
  });
  const [companyInfo, setCompanyInfo] = useState<{
    name: string;
    primary_role: string;
    verification_status: string;
    org_member_role: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setProfile({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
      avatar_url: user.avatar_url || '',
      created_at: user.created_at || '',
      email_verified_at: '',
    });
    setCompanyInfo({
      name: user.company_name || '',
      primary_role: user.role || '',
      verification_status: user.verification_status || '',
      org_member_role: user.org_member_role || '',
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
        toast.error('Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Accepted: JPEG, PNG, WebP, GIF');
      return;
    }

    // Local preview immediately
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
        setAvatarPreview(null);
        await refreshUser();
        toast.success('Profile picture updated');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Upload failed');
        setAvatarPreview(null);
      }
    } finally {
      setUploadingAvatar(false);
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
      }
    } catch {
      toast.error('Failed to remove picture');
    }
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <p className="dash-section-label mb-1">Account</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">View and manage your personal information.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="dash-card p-8">
            <h3 className="dash-section-label mb-6 flex items-center gap-2">
              <Icons.user className="size-3.5" />
              Personal Information
            </h3>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Full Name</Label>
                  <Input
                    value={profile.full_name}
                    onChange={e => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Email</Label>
                  <Input
                    value={profile.email}
                    disabled
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Phone</Label>
                  <Input
                    value={profile.phone}
                    onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+260 ..."
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Job Title</Label>
                  <Input
                    value={profile.job_title}
                    onChange={e => setProfile(prev => ({ ...prev, job_title: e.target.value }))}
                    placeholder="e.g. Project Manager"
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-5 border-t border-slate-100">
              <Button className="h-10 px-6 rounded-xl font-bold" onClick={handleSave} disabled={saving}>
                {saving ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Avatar */}
          <div className="dash-card p-6 flex flex-col items-center text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div className="relative shrink-0 mb-4 cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
              <div className="avatar-ring rounded-2xl">
                {avatarPreview || profile.avatar_url ? (
                  <img
                    src={avatarPreview || profile.avatar_url}
                    alt="Avatar"
                    className="size-20 rounded-xl object-cover"
                  />
                ) : (
                  <div className="size-20 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                    <span className="text-2xl font-bold text-white tracking-wide">
                      {(profile.full_name || 'U')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingAvatar ? (
                  <Icons.spinner className="size-5 text-white animate-spin" />
                ) : (
                  <Icons.camera className="size-5 text-white" />
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-green-500 border-2 border-white" />
            </div>
            <p className="text-sm font-bold text-slate-900">{profile.full_name || 'User'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{profile.email}</p>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? <Icons.spinner className="size-3 animate-spin mr-1" /> : <Icons.camera className="size-3 mr-1" />}
                Upload
              </Button>
              {profile.avatar_url && (
                <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Organisation */}
          {companyInfo && companyInfo.name && (
            <div className="dash-card p-6">
              <h3 className="dash-section-label mb-4 flex items-center gap-2">
                <Icons.building className="size-3.5" />
                Organisation
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Company</span>
                  <span className="text-sm font-semibold text-slate-900">{companyInfo.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Role</span>
                  <span className="text-sm font-semibold text-slate-900">{ROLE_LABELS[companyInfo.primary_role] ?? companyInfo.primary_role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Org Role</span>
                  <span className="text-sm font-semibold text-slate-900">{companyInfo.org_member_role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Verification</span>
                  <Badge variant={STATUS_VARIANTS[companyInfo.verification_status] || 'yellow'}>
                    {companyInfo.verification_status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Account Meta */}
          <div className="dash-card p-6">
            <h3 className="dash-section-label mb-4 flex items-center gap-2">
              <Icons.shieldCheck className="size-3.5" />
              Account Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Member Since</span>
                <span className="text-sm font-semibold text-slate-900">
                  {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Email Verified</span>
                <span className="text-sm font-semibold text-slate-900">
                  {profile.email_verified_at ? 'Yes' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
