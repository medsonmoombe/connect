'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/ui/icons';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { PublicNavbar } from '@/components/marketing/PublicNavbar';

const BG_IMAGES = ['/grid-1.jpg', '/grid-2.jpg', '/grid-3.jpg'];

interface AuthSplitShellProps {
  eyebrow: string;
  title: string;
  description: string;
  points?: string[];
  children: React.ReactNode;
  footerLink?: { text: string; href: string; label: string };
  wide?: boolean;
}

export function AuthSplitShell({
  eyebrow,
  title,
  description,
  points = ['Verified counterparties', 'Project intelligence', 'Secure deal workflows'],
  children,
  footerLink,
  wide = false,
}: AuthSplitShellProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % BG_IMAGES.length);
        setFading(false);
      }, 700);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f3] font-sans selection:bg-green-100 selection:text-green-900">
      <PublicNavbar />

      <main className="px-4 pb-16 pt-28 md:px-6 md:pb-24">
        <div className={`mx-auto grid w-full gap-0 overflow-hidden shadow-[0_24px_80px_rgba(15,23,42,0.10)] ${wide ? 'max-w-6xl lg:grid-cols-[0.8fr_1.2fr]' : 'max-w-5xl lg:grid-cols-[0.9fr_1fr]'}`}>

          {/* ── LEFT PANEL ── */}
          <aside className="relative overflow-hidden min-h-[420px]">
            {/* Background images */}
            {BG_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-in-out ${
                  i === currentIdx ? (fading ? 'opacity-50' : 'opacity-65') : 'opacity-0'
                }`}
              />
            ))}

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#041f12]/75 via-[#052e1a]/65 to-[#041f12]/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#041f12]/60 via-transparent to-[#041f12]/30" />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full p-8 md:p-10">
              {/* Logo */}
              <Link href="/" className="inline-flex items-center gap-3 group w-fit mb-10">
                <div className="w-9 h-9 flex items-center justify-center bg-white text-[#0b3b24] group-hover:scale-105 transition-transform duration-200">
                  <Icons.logo className="w-full h-full" />
                </div>
                <span className="text-base font-bold tracking-tight text-white">
                  Afri <span className="text-emerald-300 font-extrabold">Connect</span>
                </span>
              </Link>

              {/* Copy */}
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.22em] mb-4">{eyebrow}</p>
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-[1.1] tracking-[-0.02em] mb-4">
                  {title}
                </h2>
                <p className="text-sm text-white/50 leading-relaxed max-w-xs font-normal mb-8">
                  {description}
                </p>

                {/* Points */}
                <div className="space-y-3">
                  {points.map((point) => (
                    <div key={point} className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center bg-emerald-400/15 border border-emerald-400/25 shrink-0">
                        <Icons.check className="size-3 text-emerald-400" />
                      </div>
                      <span className="text-sm text-white/70 font-medium">{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom — dots + footer link */}
              <div className="mt-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {BG_IMAGES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentIdx(i); setFading(false); }}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        i === currentIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/45'
                      }`}
                    />
                  ))}
                </div>
                {footerLink && (
                  <p className="text-[11px] text-white/35">
                    {footerLink.text}{' '}
                    <Link href={footerLink.href} className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors">
                      {footerLink.label}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* ── RIGHT PANEL ── */}
          <section className="bg-white border-l border-slate-200/60">
            {children}
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
