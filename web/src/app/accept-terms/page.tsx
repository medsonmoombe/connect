'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';
import { toast } from 'sonner';

export default function AcceptTermsPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/accept-terms', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to record acceptance');
      toast.success('Terms accepted. Welcome!');
      router.push('/dashboard');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitShell
      eyebrow="Platform access"
      title="Terms & Conditions"
      description="Review and accept the platform terms to continue. This is required for all participants in the AfriConnect marketplace."
      points={['Secure data handling', 'Verified counterparties', 'Governed deal workflows']}
    >
      <div className="p-8 md:p-10 h-full flex flex-col justify-center">

        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Required action</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accept Terms & Conditions</h1>
          <p className="mt-1.5 text-sm text-slate-400 font-normal">
            We have updated our platform terms. Please review and accept to continue.
          </p>
        </div>

        <div className="border border-slate-200 bg-slate-50 p-5 mb-6 space-y-3">
          <p className="text-xs leading-6 text-slate-500">
            By using the AfriConnect platform you agree to our{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-green-700 hover:text-green-600 transition-colors">
              Terms & Conditions
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-green-700 hover:text-green-600 transition-colors">
              Privacy Policy
            </Link>
            . These govern your use of the platform, data handling, project submissions, and counterparty interactions.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <a
              href="/terms"
              target="_blank"
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-green-700 hover:text-green-600 transition-colors"
            >
              <Icons.fileText className="size-3.5" />
              Read Terms & Conditions
            </a>
            <a
              href="/privacy"
              target="_blank"
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-green-700 hover:text-green-600 transition-colors"
            >
              <Icons.fileText className="size-3.5" />
              Read Privacy Policy
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-6">
          <input
            id="accept"
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            className="mt-0.5 size-4 border-slate-300 text-[#052e1a] focus:ring-[#052e1a]/10 cursor-pointer"
          />
          <label htmlFor="accept" className="text-sm leading-5 text-slate-600 cursor-pointer select-none">
            I have read and agree to the{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-green-700 hover:text-green-600 transition-colors">
              Terms & Conditions
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-green-700 hover:text-green-600 transition-colors">
              Privacy Policy
            </Link>.
          </label>
        </div>

        <button
          onClick={handleAccept}
          disabled={!accepted || loading}
          className="w-full h-11 bg-[#052e1a] hover:bg-green-800 text-white text-sm font-semibold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading
            ? <Icons.spinner className="size-4 animate-spin" />
            : <><span>Accept & Continue</span><Icons.arrowRight className="ml-2 size-4" /></>
          }
        </button>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Protected by enterprise-grade encryption and KYC/KYB verification.
          </p>
        </div>

      </div>
    </AuthSplitShell>
  );
}
