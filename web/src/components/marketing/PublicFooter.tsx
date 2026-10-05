'use client';

import Link from 'next/link';
import { Icons } from '@/components/ui/icons';

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Solutions',
    links: [
      { label: 'Capital Matching', href: '/#platform' },
      { label: 'Scoring Engine', href: '/#intelligence' },
      { label: 'Technical Network', href: '/#platform' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Methodology', href: '/#intelligence' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Regulatory', href: '/#intelligence' },
    ],
  },
];

const FOOTER_POINTS = ['Capital', 'Technical partners', 'Project intelligence'];

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-green-900 bg-[#052e1a] text-white">
      <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_0.8fr_0.8fr] md:gap-12">
          <div className="max-w-xl">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex size-10 items-center justify-center bg-white text-[#0b3b24]">
                <Icons.logo className="size-8" />
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Afri <span className="text-emerald-200">Connect</span>
              </span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-6 text-emerald-50/75">
              An institutional marketplace connecting energy projects with aligned capital, specialist execution partners, and decision-grade intelligence.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {FOOTER_POINTS.map((point) => (
                <span key={point} className="border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-50/80">
                  {point}
                </span>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h5 className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200/70">{col.title}</h5>
              <ul className="mt-5 space-y-3 text-sm font-medium text-emerald-50/70">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                      <span className="h-px w-3 bg-emerald-300/40" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-y border-white/10 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Ready to move an energy opportunity forward?</p>
              <p className="mt-1 text-sm text-emerald-50/65">Create a profile, complete verification, and start matching with the right counterparties.</p>
            </div>
            <Link
              href="/register"
              className="inline-flex h-10 items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-green-950 transition-colors hover:bg-emerald-50"
            >
              Get Started
              <Icons.arrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-xs font-medium text-emerald-50/55 md:flex-row md:items-center md:justify-between">
          <div>&copy; 2026 Afri Connect Ltd. All rights reserved.</div>
          <div className="flex gap-6 uppercase tracking-widest">
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            {/* <Link href="/usage" className="transition-colors hover:text-white">Usage Policy</Link> */}
          </div>
        </div>
      </div>
    </footer>
  );
}
