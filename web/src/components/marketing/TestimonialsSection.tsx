'use client';

import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/icons';

const TESTIMONIALS = [
  {
    quote: 'Afri Connect transformed how we present our projects to investors. The AI scoring identified gaps we missed, and the structured data room saved months of back-and-forth.',
    name: 'Sarah Mwangi',
    role: 'Director of Project Finance',
    company: 'SolarScale Energy',
    avatar: 'SM',
  },
  {
    quote: 'For the first time, we can evaluate African energy projects with the same rigor as developed-market opportunities. The document verification is institutional grade.',
    name: 'James Okonkwo',
    role: 'Managing Partner',
    company: 'InfraCapital Africa',
    avatar: 'JO',
  },
  {
    quote: 'The platform connected us with three active solar projects in our region within weeks. The matching algorithm understands EPC capabilities better than most recruiters.',
    name: 'Maria da Silva',
    role: 'Business Development Lead',
    company: 'SunBuild Constructors',
    avatar: 'MS',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-28 md:py-36 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold text-green-700 uppercase tracking-[0.22em] mb-4"
          >
            Testimonials
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight"
          >
            Trusted by Industry Leaders
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white border border-slate-200/80 shadow-[0_8px_32px_rgba(15,23,42,0.05)] hover:shadow-[0_16px_48px_rgba(15,23,42,0.09)] p-8 flex flex-col transition-shadow duration-300 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex gap-0.5 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Icons.star key={s} className="size-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>

              <p className="text-sm text-slate-500 leading-relaxed flex-grow mb-7 font-normal">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                <div className="w-9 h-9 bg-[#052e1a] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-400 font-medium">{t.role}, {t.company}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
