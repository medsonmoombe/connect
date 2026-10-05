'use client';

import { motion } from 'framer-motion';

const PARTNERS = [
  { name: 'ZESCO', subtitle: 'National Utility' },
  { name: 'IFC', subtitle: 'World Bank Group' },
  { name: 'CDB', subtitle: 'Development Bank' },
  { name: 'EAPP', subtitle: 'Energy Association' },
  { name: 'ARE', subtitle: 'Renewable Energy' },
  { name: 'AFDB', subtitle: 'African Dev. Bank' },
];

export function SocialProofBar() {
  return (
    <section className="py-12 bg-[#041f12] border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-[9px] font-bold text-white/20 uppercase tracking-[0.25em] mb-8">
          Trusted by leading energy institutions
        </p>
        <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
          {PARTNERS.map((partner, i) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="flex items-center gap-2.5 opacity-30 hover:opacity-60 transition-opacity duration-300 cursor-default select-none"
            >
              <div className="w-8 h-8 bg-white/[0.07] border border-white/[0.08] flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white/60">{partner.name.slice(0, 2)}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white/70 leading-none">{partner.name}</div>
                <div className="text-[9px] text-white/30 font-medium mt-0.5">{partner.subtitle}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
