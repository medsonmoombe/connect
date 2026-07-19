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
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasSentRef = useRef(false);

  const sendCode = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa/send-code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setCodeSent(true);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message);
      setCodeSent(true); // still show the form so user sees the error
    } finally {
      setSending(false);
    }
  }, []);

  // Auto-send code on mount (once)
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

  // Focus first input once the form is revealed
  useEffect(() => {
    if (codeSent) inputRefs.current[0]?.focus();
  }, [codeSent]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    setError(null);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...code];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? '';
    setCode(next);
    setError(null);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      onVerified();
    } catch (err: any) {
      setError(err.message);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  if (!codeSent) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LeafLoader size={80} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green-800 via-green-500 to-green-800" />

      <div className="w-full max-w-[400px] px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-green-800 flex items-center justify-center shadow-md shadow-green-900/20 mb-3">
            <Icons.shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            Afri <span className="text-green-700">Connect</span>
          </span>
          <span className="text-xs text-slate-400 mt-0.5">Partner Portal</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-100 p-7">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Two-factor verification</h1>
          <p className="text-sm text-slate-500 mb-5">
            A verification code was sent to <span className="font-medium text-slate-700">{email}</span>
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl border bg-red-50 border-red-100 text-red-600 flex items-start gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
              <Icons.alertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <div className="flex justify-center gap-2.5">
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
                  className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 focus:bg-white transition-all"
                />
              ))}
            </div>

            <Button type="submit" disabled={isLoading || code.join('').length !== 6}
              className="w-full h-11 bg-green-800 hover:bg-green-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-green-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading
                ? <Icons.spinner className="w-4 h-4 animate-spin" />
                : <><span>Verify</span><Icons.shieldCheck className="w-4 h-4" /></>}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button type="button" onClick={sendCode} disabled={sending || countdown > 0}
              className="text-[11px] font-semibold text-green-700 hover:text-green-600 transition-colors disabled:opacity-50">
              {sending ? 'Sending…' : countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <button type="button" onClick={onSignOut}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
              Use a different account
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-5">
          © 2026 Energy Capital Match &nbsp;·&nbsp; AES-256 Encrypted
        </p>
      </div>
    </div>
  );
}
