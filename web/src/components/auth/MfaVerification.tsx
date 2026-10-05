'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';

interface MfaVerificationProps {
  email: string;
  onVerified: () => void;
  onSignOut: () => void;
}

export function MfaVerification({ email, onVerified, onSignOut }: MfaVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  // Set when the code email could not be delivered (code still exists).
  // Drives the explanatory header copy — distinct from wrong-code errors.
  const [sendError, setSendError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasSentRef = useRef(false);

  const expireSession = useCallback(() => {
    setError(null);
    onSignOut();
  }, [onSignOut]);

  const readJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  const isAuthExpired = (res: Response, data: any) =>
    res.status === 401 || data?.code === 'UNAUTHORIZED' || /session|sign in|unauthorized/i.test(String(data?.error || ''));

  const sendCode = useCallback(async () => {
    setSending(true);
    setError(null);
    setSendError(null);
    try {
      const res = await fetch('/api/auth/mfa/send-code', { method: 'POST' });
      const data = await readJson(res);
      if (isAuthExpired(res, data)) {
        expireSession();
        return;
      }
      if (!res.ok) throw new Error(data.error || data.warning || 'Failed to send code');
      setCodeSent(true);
      setCountdown(60);
      // Delivery problem but code exists (recoverable) — surface the warning,
      // keep the form usable instead of pretending the flow is broken.
      if (data.delivered === false && data.warning) {
        setSendError(data.warning);
        setError(data.warning);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
      setCodeSent(true);
    } finally {
      setSending(false);
    }
  }, [expireSession]);

  useEffect(() => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;
    sendCode();
  }, [sendCode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (codeSent) inputRefs.current[0]?.focus();
  }, [codeSent]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    setError(null);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...code];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? '';
    setCode(next);
    setError(null);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.join('');
    if (token.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await readJson(res);
      if (isAuthExpired(res, data)) {
        expireSession();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  if (!codeSent) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <LeafLoader size={72} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-7 flex items-start gap-4">
        <div className="flex size-11 items-center justify-center border border-green-100 bg-green-50 text-[#0b3b24]">
          <Icons.shield className="size-5" />
        </div>
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Two-factor verification</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {sendError ? (
              <>We couldn't deliver the code email. Enter a code if you have one, or <span className="font-medium text-slate-800">resend</span> below.</>
            ) : (
              <>A verification code was sent to <span className="font-medium text-slate-800">{email}</span></>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
          <Icons.alertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        <div className="flex justify-between gap-2">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              className="h-12 w-11 border border-slate-300 bg-white text-center text-lg font-semibold text-slate-950 transition-colors focus:border-[#0b3b24] focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/15 sm:w-12"
            />
          ))}
        </div>

        <Button type="submit" disabled={isLoading || code.join('').length !== 6}
          className="h-11 w-full text-sm font-semibold shadow-none disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading ? <Icons.spinner className="size-4 animate-spin" /> : 'Verify'}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
        <button type="button" onClick={sendCode} disabled={sending || countdown > 0}
          className="text-xs font-semibold text-[#0b3b24] transition-colors hover:text-[#0d4a2e] disabled:opacity-50">
          {sending ? 'Sending...' : countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
        </button>
        <button type="button" onClick={onSignOut}
          className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700">
          Use a different account
        </button>
      </div>
    </div>
  );
}
