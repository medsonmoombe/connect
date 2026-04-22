'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminApi } from '@/services/admin';
import { UserRole } from '@/types';

const ROLES = [
  { id: 'DEVELOPER', name: 'Developer' },
  { id: 'CAPITAL_PARTNER', name: 'Capital Partner' },
  { id: 'TECHNICAL_PARTNER', name: 'Technical Partner' },
  { id: 'ADMIN', name: 'Admin' },
];

export default function UserProvisioningPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('DEVELOPER');
  const [sendInvitation, setSendInvitation] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await adminApi.provisionUser(email, role, password);
      
      if (response.error) {
        setMessage({ type: 'error', text: `Failed to provision user: ${response.error}` });
      } else {
        setMessage({ 
          type: 'success', 
          text: response.message || `Successfully provisioned ${email} as ${role.replace('_', ' ')}.` 
        });
        setEmail('');
        setPassword('');
        setRole('DEVELOPER');
        setSendInvitation(true);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">User Provisioning</h2>
        <p className="text-slate-500 max-w-2xl">
          Grant access to new team members and external partners by creating their accounts and assigning appropriate roles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Provisioning Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Provision New User</h3>
              <p className="text-sm text-slate-500">Complete the details below to initialize a new user account.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                  message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {message.type === 'success' ? (
                    <Icons.shieldCheck className="size-5" />
                  ) : (
                    <Icons.zap className="size-5" />
                  )}
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-semibold">Email Address</Label>
                <div className="relative">
                  <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-green-800/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password text-slate-700 font-semibold">Login Password</Label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="password"
                    type="text"
                    placeholder="Enter password (or leave blank to auto-generate)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-green-800/20"
                  />
                </div>
                <p className="text-xs text-slate-500 italic">This password must be shared with the user for their first login.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-700 font-semibold">Access Role</Label>
                <div className="relative">
                  <Icons.shield className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20 appearance-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center h-5">
                  <input
                    id="sendInvitation"
                    type="checkbox"
                    checked={sendInvitation}
                    onChange={(e) => setSendInvitation(e.target.checked)}
                    className="size-4 text-green-800 border-slate-300 rounded focus:ring-green-800"
                  />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="sendInvitation" className="text-sm font-bold text-slate-900 cursor-pointer">
                    Send Invitation Email
                  </Label>
                  <p className="text-xs text-slate-500 mt-1">
                    The user will receive an automated email with instructions to set their password.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl h-12 px-8 border-slate-200"
                  disabled={isLoading}
                  onClick={() => {
                    setEmail('');
                    setRole('DEVELOPER');
                    setSendInvitation(true);
                    setMessage(null);
                  }}
                >
                  Clear
                </Button>
                <Button 
                  type="submit" 
                  className="rounded-xl h-12 px-8 bg-green-800 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 min-w-[160px]"
                  disabled={isLoading || !email}
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Provision User'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-6">
          <div className="p-6 bg-green-800 rounded-3xl text-white shadow-xl shadow-green-900/20">
            <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
              <Icons.shieldCheck className="size-6 text-white" />
            </div>
            <h4 className="text-lg font-bold mb-2">Role Permissions</h4>
            <ul className="space-y-3">
              {[
                { r: 'Admin', d: 'Full platform access and management' },
                { r: 'Developer', d: 'Project creation and technical data' },
                { r: 'Capital Partner', d: 'Investment and project discovery' },
                { r: 'Technical Partner', d: 'Technical services and project delivery' },
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <div className="size-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">{item.r}:</span> <span className="text-green-100">{item.d}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Security Logs</h4>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Icons.user className="size-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 leading-tight">Recent Activity</p>
                  <p className="text-[10px] text-slate-500 mt-1">No recent provisioning activity recorded in this session.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
