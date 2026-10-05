'use client';

import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/icons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const PILLARS = [
  {
    icon: Icons.database,
    title: 'Project Developers',
    subtitle: 'Make your project bankable',
    description: 'Structured data rooms, AI-driven readiness scoring, and automated gap analysis to prepare projects for institutional investment.',
    features: [
      { icon: Icons.fileText, text: 'Guided Document Upload' },
      { icon: Icons.cpu, text: 'AI Readiness Scoring' },
      { icon: Icons.alertTriangle, text: 'Gap Detection Engine' },
      { icon: Icons.users, text: 'Partner Matching' },
    ],
    href: '/register',
  },
  {
    icon: Icons.barChart2,
    title: 'Financiers & Investors',
    subtitle: 'Deploy with confidence',
    description: 'Verified deal flow with institutional-grade data rooms, risk analytics, and structured project intelligence for informed capital allocation.',
    features: [
      { icon: Icons.shield, text: 'KYC/KYB Verified Projects' },
      { icon: Icons.barChart2, text: 'Risk Analytics Dashboard' },
      { icon: Icons.layers, text: 'Structured Data Rooms' },
      { icon: Icons.messageSquare, text: 'Direct Engagement' },
    ],
    href: '/register',
    featured: true,
  },
  {
    icon: Icons.handshake,
    title: 'EPC & Consultants',
    subtitle: 'Find active projects',
    description: 'Connect with developers seeking technical expertise, EPC services, and advisory support across the project lifecycle.',
    features: [
      { icon: Icons.search, text: 'Project Discovery' },
      { icon: Icons.clipboardCheck, text: 'RFP Pipeline' },
      { icon: Icons.building, text: 'Service Matching' },
      { icon: Icons.shieldCheck, text: 'Verified Credentials' },
    ],
    href: '/register',
  },
];

export function FeaturesGrid() {
  return (
    <section id="platform" className="py-28 md:py-36 bg-[#f5f6f3] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold text-green-700 uppercase tracking-[0.22em] mb-4"
          >
            Platform
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-5"
          >
            One Ecosystem. Three Pillars.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="text-slate-400 font-medium max-w-md mx-auto text-base"
          >
            Standardizing the lifecycle of energy project finance across Africa.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 items-stretch">
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`bg-white border p-8 flex flex-col relative overflow-hidden group transition-shadow duration-300 ${
                pillar.featured
                  ? 'border-green-200 shadow-[0_24px_64px_rgba(22,101,52,0.1)] lg:scale-[1.02]'
                  : 'border-slate-200/80 shadow-[0_8px_32px_rgba(15,23,42,0.05)] hover:shadow-[0_16px_48px_rgba(15,23,42,0.09)]'
              }`}
            >
              {pillar.featured && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-600 via-emerald-400 to-green-600" />
              )}
              {pillar.featured && (
                <div className="absolute top-5 right-5 bg-[#052e1a] text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1">
                  Most Popular
                </div>
              )}

              <div className={`w-12 h-12 flex items-center justify-center mb-6 transition-all duration-300 ${
                pillar.featured ? 'bg-[#052e1a] text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-[#052e1a] group-hover:text-white'
              }`}>
                <pillar.icon className="size-6" />
              </div>

              <p className="text-[9px] font-bold text-green-700 uppercase tracking-[0.18em] mb-2">{pillar.subtitle}</p>
              <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">{pillar.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-7 flex-grow">{pillar.description}</p>

              <ul className="space-y-2.5 mb-8">
                {pillar.features.map((feat) => (
                  <li key={feat.text} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <div className="size-6 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <feat.icon className="size-3 text-slate-400" />
                    </div>
                    {feat.text}
                  </li>
                ))}
              </ul>

              <Link href={pillar.href}>
                <Button className={`w-full h-11 text-sm font-semibold rounded-none transition-all duration-200 ${
                  pillar.featured
                    ? 'bg-[#052e1a] hover:bg-green-800 text-white'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  Get Started
                  <Icons.arrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
