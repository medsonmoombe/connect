'use client';

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { toast } from 'sonner';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';

type ProfileType = 'DEVELOPER' | 'CAPITAL' | 'TECHNICAL' | 'CONSULTANT' | 'POWER_TRADER' | 'GRANT_PROVIDER';

const PROFILES: { value: ProfileType; icon: keyof typeof Icons; title: string; subtitle: string; points: string[] }[] = [
  { value: 'DEVELOPER', icon: 'zap', title: 'Project Developer', subtitle: 'Develop and own energy infrastructure projects seeking capital.', points: ['Project pipeline', 'Readiness scoring', 'Capital and partner matching'] },
  { value: 'CAPITAL', icon: 'dollarSign', title: 'Financier', subtitle: 'Investment firms deploying debt, equity, or grant capital.', points: ['Verified deal flow', 'Mandate matching', 'Risk context'] },
  { value: 'TECHNICAL', icon: 'hardHat', title: 'Technical Partner', subtitle: 'EPC, O&M, engineering, and specialist service providers.', points: ['Service matching', 'Delivery profile', 'Regional fit'] },
  { value: 'CONSULTANT', icon: 'briefcase', title: 'Consultant', subtitle: 'Feasibility, financial, environmental, and legal advisory firms.', points: ['Advisory matching', 'Project support', 'Direct engagement'] },
  { value: 'POWER_TRADER', icon: 'activity', title: 'Power Trader', subtitle: 'Offtake and power purchase agreement counterparties.', points: ['PPA opportunities', 'Capacity matching', 'Offtake pipeline'] },
  { value: 'GRANT_PROVIDER', icon: 'handshake', title: 'Grant Provider', subtitle: 'Development partners funding early-stage preparation.', points: ['Grant pipeline', 'Eligibility routing', 'Preparation support'] },
];

const inputClass = 'h-11 w-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 transition-colors duration-150 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8';
const labelClass = 'block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('type');
    if (from && PROFILES.some(p => p.value === from)) setProfileType(from as ProfileType);
  }, []);

  const selectedProfile = PROFILES.find(p => p.value === profileType) ?? null;

  const handleContinue = () => {
    if (!profileType) {
      setError('Please select the profile that best describes your organisation.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileType) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!acceptedTerms) {
      setError('You must accept the Terms & Conditions to continue.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, companyType: profileType, acceptedTerms: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }
      toast.success('Account created. Let us set up your organisation.');
      router.push(data.redirect || `/onboarding?type=${profileType}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSplitShell
      wide
      eyebrow="Membership application"
      title="Register your firm"
      description="Choose the organisation profile that matches how you participate in energy infrastructure. The next step sets up your firm profile for verification."
      points={['Select profile type', 'Create secure account', 'Complete onboarding']}
      footerLink={{ text: 'Already registered?', href: '/login', label: 'Sign in' }}
    >
      <div className="border-b border-slate-100 px-5 py-4 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Application progress</p>
          <p className="text-xs font-medium text-slate-500">Step {step} of 2</p>
        </div>
        <div className="mt-3 h-1 bg-slate-100">
          <div className="h-full bg-green-800 transition-all duration-500" style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>
      </div>

      <div className="p-5 md:p-8">
        {step === 1 ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">How does your organisation participate?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Select one profile. This controls the onboarding questions and the matching logic.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROFILES.map((p) => {
                const Icon = Icons[p.icon];
                const selected = profileType === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setProfileType(p.value); setError(null); }}
                    className={`group text-left border p-4 transition-colors ${selected ? 'border-green-800 bg-green-50/50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center border ${selected ? 'border-green-800 bg-green-800 text-white' : 'border-slate-200 bg-slate-50 text-green-800'}`}>
                        <Icon className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-semibold ${selected ? 'text-green-900' : 'text-slate-950'}`}>{p.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{p.subtitle}</span>
                      </span>
                      {selected && <Icons.checkCircle2 className="size-4 shrink-0 text-green-800" />}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      {p.points.map(point => (
                        <span key={point} className="border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600">{point}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <ErrorNotice message={error} />}

            <button type="button" onClick={handleContinue} className="inline-flex h-11 w-full items-center justify-center gap-2 bg-[#052e1a] hover:bg-green-800 text-sm font-semibold text-white transition-colors duration-200">
              Continue <Icons.arrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {selectedProfile && (
              <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center border border-slate-200 bg-white text-green-800">
                  {(() => { const Icon = Icons[selectedProfile.icon]; return <Icon className="size-5" />; })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Registering as</p>
                  <p className="text-sm font-semibold text-slate-950">{selectedProfile.title}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-green-700 hover:text-green-600">Change</button>
              </div>
            )}

            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Create your account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use a work email. Your organisation profile is completed after account creation.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className={labelClass}>Full Name</label>
                <input id="fullName" type="text" required disabled={isLoading} placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className={labelClass}>Work Email</label>
                <input id="email" type="email" required disabled={isLoading} placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className={labelClass}>Password</label>
                <div className="relative">
                  <input id="password" type={showPassword ? 'text' : 'password'} required minLength={8} disabled={isLoading} placeholder="Minimum 8 characters" value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-11`} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                    {showPassword ? <Icons.eyeOff className="size-4" /> : <Icons.eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => { setAcceptedTerms(e.target.checked); setError(null); }}
                  className="mt-0.5 size-4 border-slate-300 text-[#052e1a] focus:ring-[#052e1a]/10 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs leading-5 text-slate-600 cursor-pointer">
                  I have read and agree to the <Link href="/terms" target="_blank" className="font-semibold text-green-700 hover:underline">Terms & Conditions</Link> and <Link href="/privacy" target="_blank" className="font-semibold text-green-700 hover:underline">Privacy Policy</Link>.
                </label>
              </div>

              {error && <ErrorNotice message={error} />}

              <button type="submit" disabled={isLoading || !acceptedTerms} className="inline-flex h-11 w-full items-center justify-center gap-2 bg-[#052e1a] hover:bg-green-800 text-sm font-semibold text-white transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                {isLoading ? <Icons.spinner className="size-4 animate-spin" /> : <>Create Account <Icons.arrowRight className="size-4" /></>}
              </button>
            </form>


          </div>
        )}
      </div>
    </AuthSplitShell>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
      <Icons.alertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
