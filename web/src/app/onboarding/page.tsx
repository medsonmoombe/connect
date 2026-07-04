'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { onboardingApi, companiesApi } from '@/services/api';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRole, Company } from '@/types';
import { clsx } from 'clsx';

type OnboardingStep = 'profile' | 'company' | 'preferences' | 'complete';

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [companySearch, setCompanySearch] = useState('');
  const [foundCompanies, setFoundCompanies] = useState<Company[]>([]);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    country: '',
    website: '',
    years_operating: 0,
    team_size: 0,
    is_new_company_with_experienced_team: false,
    management_team_experience: { years: 0, description: '' },
    type: user?.role === 'ADMIN' ? 'DEVELOPER' : (user?.role === 'CAPITAL_PARTNER' ? 'CAPITAL' : (user?.role === 'TECHNICAL_PARTNER' ? 'TECHNICAL' : (user?.role === 'POWER_TRADER' ? 'POWER_TRADER' : 'DEVELOPER'))) as any
  });

  const [preferences, setPreferences] = useState<any>({});

  const normalizeList = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);

  const updateManagementExperience = (years: number) => {
    const managementTeamExperience = {
      ...newCompany.management_team_experience,
      years,
    };
    const yearsOperating = Number(newCompany.years_operating || 0);
    setNewCompany({
      ...newCompany,
      management_team_experience: managementTeamExperience,
      is_new_company_with_experienced_team: yearsOperating < 2 && years >= 5,
    });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
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
    const { error } = await onboardingApi.joinCompany(user.id, companyId);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      await refreshUser();
      if (user.role === 'CAPITAL_PARTNER' || user.role === 'TECHNICAL_PARTNER' || user.role === 'POWER_TRADER') {
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
    setLoading(true);
    
    // Clean data
    const managementYears = Number(newCompany.management_team_experience?.years || 0);
    const companyData = {
      ...newCompany,
      years_operating: Number(newCompany.years_operating || 0),
      team_size: Number(newCompany.team_size || 0),
      is_new_company_with_experienced_team: Number(newCompany.years_operating || 0) < 2 && managementYears >= 5,
    };
    if (!companyData.website) {
      // @ts-ignore
      delete companyData.website;
    }
    
    const { data, error } = await onboardingApi.setupCompany(user.id, companyData as any);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      await refreshUser();
      if (user.role === 'CAPITAL_PARTNER' || user.role === 'TECHNICAL_PARTNER' || user.role === 'POWER_TRADER') {
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
    const { error } = await onboardingApi.saveRolePreferences(user.role, user.company_id, preferences);
    setLoading(false);
    if (error) setError(error);
    else setStep('complete');
  };

  const finishOnboarding = async () => {
    setLoading(true);
    await refreshUser();
    setLoading(false);
    router.push('/dashboard');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Progress Stepper */}
      <div className="flex justify-between mb-8 px-4">
        {['profile', 'company', 'preferences', 'complete'].map((s, idx) => {
          const isDone = ['profile', 'company', 'preferences', 'complete'].indexOf(step) > idx;
          const isActive = step === s;
          if (s === 'preferences' && user?.role !== 'CAPITAL_PARTNER' && user?.role !== 'TECHNICAL_PARTNER' && user?.role !== 'POWER_TRADER') return null;
          
          return (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                isDone ? "bg-[#166534] text-white" : isActive ? "ring-2 ring-[#166534] ring-offset-2 bg-white text-[#166534]" : "bg-slate-200 text-slate-400"
              )}>
                {isDone ? "✓" : idx + 1}
              </div>
              <span className={clsx("text-[10px] uppercase tracking-wider font-bold", isActive ? "text-[#166534]" : "text-slate-400")}>
                {s}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Welcome to the Network</h1>
              <p className="text-slate-500">Let's start by completing your professional profile.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  placeholder="John Doe" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  required 
                />
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-3">
                <Icons.info className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">Assigned Role: {user?.role}</p>
                  <p className="text-slate-500">Your account was provisioned with this role by an administrator. This determines your platform capabilities.</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#166534] hover:bg-[#14532d]" disabled={loading}>
              {loading ? <Icons.spinner className="animate-spin mr-2" /> : null}
              Continue to Company Setup
            </Button>
          </form>
        )}

        {step === 'company' && (
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Company Information</h1>
              <p className="text-slate-500">Link your account to an organization or create a new one.</p>
            </div>

            {!isCreatingCompany ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search for your company</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter company name..." 
                      value={companySearch} 
                      onChange={(e) => setCompanySearch(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={searchCompanies}>Search</Button>
                  </div>
                </div>

                {foundCompanies.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                    {foundCompanies.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleJoinCompany(c.id)}
                        className="w-full text-left p-3 hover:bg-slate-50 rounded-md transition-colors flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.country || 'Global'}</p>
                        </div>
                        <Icons.chevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#166534]" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or</span></div>
                </div>

                <Button variant="outline" className="w-full border-dashed" onClick={() => setIsCreatingCompany(true)}>
                  Create New Company Profile
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Company Name</Label>
                    <Input 
                      required 
                      value={newCompany.name} 
                      onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input 
                      required 
                      value={newCompany.country} 
                      onChange={(e) => setNewCompany({...newCompany, country: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Years Operating</Label>
                    <Input 
                      type="number"
                      value={newCompany.years_operating}
                      onChange={(e) => {
                        const years = Number(e.target.value || 0);
                        setNewCompany({...newCompany, years_operating: years});
                        updateManagementExperience(Number(newCompany.management_team_experience?.years || 0));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Team Size</Label>
                    <Input 
                      type="number"
                      value={newCompany.team_size}
                      onChange={(e) => setNewCompany({...newCompany, team_size: Number(e.target.value || 0)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website (Optional)</Label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={newCompany.website}
                      onChange={(e) => setNewCompany({...newCompany, website: e.target.value})}
                    />
                  </div>
                  {newCompany.type === 'TECHNICAL' && (
                    <div className="col-span-2 p-4 bg-slate-50 rounded-lg space-y-4 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="is_new_company_with_experienced_team"
                          checked={newCompany.is_new_company_with_experienced_team}
                          disabled
                        />
                        <Label htmlFor="is_new_company_with_experienced_team" className="font-semibold">Experienced Leadership Flag</Label>
                      </div>
                      <p className="text-xs text-slate-500">Calculated when the company has operated for less than 2 years and management experience is at least 5 years.</p>
                      <div className="space-y-2">
                        <Label>Management Team Total Experience (Years)</Label>
                        <Input 
                          type="number"
                          value={newCompany.management_team_experience.years}
                          onChange={(e) => updateManagementExperience(Number(e.target.value || 0))}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsCreatingCompany(false)}>Back to Search</Button>
                  <Button type="submit" className="flex-1 bg-[#166534] hover:bg-[#14532d]" disabled={loading}>
                    {loading ? <Icons.spinner className="animate-spin mr-2" /> : "Register Company"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === 'preferences' && (
          <form onSubmit={handlePreferenceSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Deployment Preferences</h1>
              <p className="text-slate-500">Help us match you with the right opportunities.</p>
            </div>

            {user?.role === 'CAPITAL_PARTNER' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Ticket Size ($)</Label>
                    <Input type="number" onChange={(e) => setPreferences({...preferences, min_ticket_size: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Ticket Size ($)</Label>
                    <Input type="number" onChange={(e) => setPreferences({...preferences, max_ticket_size: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Investment Sector Focus</Label>
                  <Input 
                    placeholder="Solar, Wind, Hydro..." 
                    onChange={(e) => setPreferences({...preferences, sector_focus: normalizeList(e.target.value)})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Geographic Focus</Label>
                  <Input 
                    placeholder="Nigeria, Ghana, Kenya..." 
                    onChange={(e) => setPreferences({...preferences, geographic_focus: normalizeList(e.target.value)})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Risk Tolerance</Label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                    onChange={(e) => setPreferences({...preferences, risk_tolerance: e.target.value})}
                  >
                    <option value="LOW">Low Risk (Stable/Operational)</option>
                    <option value="MEDIUM">Medium Risk (Development/Construction)</option>
                    <option value="HIGH">High Risk (Concept/Exploration)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Project Stages</Label>
                  <Input 
                    placeholder="FEASIBILITY, READY_TO_BUILD..." 
                    onChange={(e) => setPreferences({...preferences, preferred_project_stage: normalizeList(e.target.value).map(s => s.toUpperCase())})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Capital Structure</Label>
                  <Input 
                    placeholder="EQUITY, PROFIT_SHARING, LEASING, GRANT" 
                    onChange={(e) => setPreferences({...preferences, preferred_capital_structure: normalizeList(e.target.value).map(s => s.toUpperCase())})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Return Profile</Label>
                  <Input 
                    placeholder="e.g. 15-20% IRR" 
                    onChange={(e) => setPreferences({...preferences, expected_return_profile: e.target.value})} 
                  />
                </div>
              </div>
            )}

            {user?.role === 'TECHNICAL_PARTNER' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Years of Experience</Label>
                    <Input type="number" onChange={(e) => setPreferences({...preferences, years_of_experience: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Project Size (ZMW)</Label>
                    <Input type="number" onChange={(e) => setPreferences({...preferences, min_ticket_size_zmw: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Project Size (ZMW)</Label>
                    <Input type="number" onChange={(e) => setPreferences({...preferences, max_ticket_size_zmw: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Input placeholder="e.g. 20% upfront, milestones..." onChange={(e) => setPreferences({...preferences, payment_terms: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Specific Project Type Experience</Label>
                    <Input placeholder="Utility Scale Solar, Micro-grids..." onChange={(e) => setPreferences({...preferences, project_type_experience: normalizeList(e.target.value)})} />
                </div>
                <div className="space-y-2">
                    <Label>Service Categories (Comma separated)</Label>
                    <Input placeholder="EPC, O&M, Advisory..." onChange={(e) => setPreferences({...preferences, service_categories: normalizeList(e.target.value)})} />
                </div>
                <div className="space-y-2">
                    <Label>Regions of Operation</Label>
                    <Input placeholder="Copperbelt, Lusaka, Southern..." onChange={(e) => setPreferences({...preferences, regions_operated: normalizeList(e.target.value)})} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-[#166534] hover:bg-[#14532d]" disabled={loading}>
              {loading ? <Icons.spinner className="animate-spin mr-2" /> : "Save & Finalize"}
            </Button>
          </form>
        )}

        {step === 'complete' && (
          <div className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-[#166534]/10 rounded-full flex items-center justify-center mx-auto">
              <Icons.check className="w-10 h-10 text-[#166534]" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-slate-900">Setup Complete</h1>
              <p className="text-slate-500">Your professional profile is now verified and active. You are ready to access the Energy Capital Match ecosystem.</p>
            </div>
            <Button onClick={finishOnboarding} className="w-full bg-[#166534] hover:bg-[#14532d] h-12 text-lg">
              Enter Dashboard
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex gap-3 animate-in fade-in zoom-in-95">
          <Icons.alertTriangle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}


