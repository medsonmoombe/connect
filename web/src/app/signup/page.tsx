'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/ui/icons';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('DEVELOPER');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signUp(email, password, fullName, role);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 font-sans overflow-hidden">
      {/* Visual Side */}
      <div className="relative hidden lg:flex flex-col bg-text-main p-16 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 flex flex-col h-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-primary-content">
              <Icons.zap className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">Energy Capital Match</span>
          </Link>
          
          <div className="mt-auto max-w-lg">
            <h2 className="text-5xl font-extrabold tracking-tight leading-[1.1] mb-8">Built for the next generation of Energy</h2>
            <p className="text-xl text-slate-300 font-medium leading-relaxed opacity-80">Streamlined workflows, AI matching, and secure intelligence for the energy transition.</p>
            
            <div className="mt-12 space-y-6">
              <BenefitItem text="Verified Institutional Partners" />
              <BenefitItem text="AI-Powered Readiness Scoring" />
              <BenefitItem text="Secure Virtual Data Rooms" />
            </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex items-center justify-center p-8 bg-background overflow-y-auto no-scrollbar">
        <div className="w-full max-w-[440px] space-y-10 py-12">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-text-main">Create Account</h1>
            <p className="text-meta">Select your role and enter your details to begin</p>
          </div>

          <div className="grid gap-8">
            <div className="grid grid-cols-2 gap-4">
              <RoleCard 
                role="DEVELOPER" 
                currentRole={role} 
                setRole={setRole} 
                icon={<Icons.building className="size-5" />} 
                label="Developer"
              />
              <RoleCard 
                role="CAPITAL_PARTNER" 
                currentRole={role} 
                setRole={setRole} 
                icon={<Icons.dollar className="size-5" />} 
                label="Capital Partner"
              />
              <RoleCard 
                role="TECHNICAL_PARTNER" 
                currentRole={role} 
                setRole={setRole} 
                icon={<Icons.settings className="size-5" />} 
                label="Technical Partner"
              />
              <RoleCard 
                role="GRANT_PROVIDER" 
                currentRole={role} 
                setRole={setRole} 
                icon={<Icons.handshake className="size-5" />} 
                label="Grant Provider"
              />
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-meta ml-1" htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  disabled={isLoading}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 rounded-xl border-gray-100 bg-surface shadow-soft focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-meta ml-1" htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-gray-100 bg-surface shadow-soft focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-meta ml-1" htmlFor="password">Secure Password</Label>
                <Input
                  id="password"
                  type="password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-gray-100 bg-surface shadow-soft focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600">
                  {error}
                </div>
              )}
              <Button disabled={isLoading} className="w-full h-12 bg-primary text-primary-content font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all mt-4">
                {isLoading ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Platform Account
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-4 text-meta">Or join with</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignup}
              className="h-12 rounded-xl border-gray-100 bg-surface font-bold text-xs shadow-soft hover:bg-gray-50 transition-all flex gap-3"
            >
              <Icons.google className="mr-2 h-4 w-4" /> Google Corporate Account
            </Button>
          </div>

          <p className="text-center text-meta">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in to dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-primary mt-1">
        <Icons.check className="size-3.5" />
      </div>
      <p className="text-sm font-bold uppercase tracking-widest text-slate-300">{text}</p>
    </div>
  );
}

function RoleCard({ role, currentRole, setRole, icon, label }: { role: UserRole, currentRole: UserRole, setRole: (r: UserRole) => void, icon: React.ReactNode, label: string }) {
  const active = currentRole === role;
  return (
    <div 
      onClick={() => setRole(role)}
      className={cn(
        "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 text-center",
        active 
          ? "bg-primary/10 border-primary shadow-lg shadow-primary/5 scale-105" 
          : "bg-surface border-gray-50 text-text-muted hover:border-primary/50"
      )}
    >
      <div className={cn("size-10 rounded-xl flex items-center justify-center transition-colors", active ? "bg-primary text-primary-content" : "bg-background text-text-muted")}>
        {icon}
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest leading-none", active ? "text-primary" : "text-text-muted")}>{label}</span>
    </div>
  );
}
