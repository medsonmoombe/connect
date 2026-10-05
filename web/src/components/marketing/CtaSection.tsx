'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

export function CtaSection() {
  return (
    <section className="py-28 md:py-36 bg-[#041f12] relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="/raphael-cruz-IwY-27ceRCA-unsplash.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#041f12]/95 via-[#041f12]/80 to-[#041f12]" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.04] z-0"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-[-0.02em] mb-6"
        >
          Build the Future
          <br />
          of Energy.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.18 }}
          className="text-lg text-white/40 mb-12 max-w-md mx-auto font-normal"
        >
          Join the network of developers and investors shaping the next decade of African infrastructure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.26 }}
          className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-14"
        >
          <Link href="/register">
            <Button size="lg" className="bg-white hover:bg-emerald-50 text-[#041f12] px-10 h-13 shadow-2xl shadow-black/30 text-sm font-semibold rounded-none transition-all duration-200">
              Apply for Membership
              <Icons.arrowRight className="ml-2 size-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-white/[0.18] text-white/70 hover:bg-white/[0.08] hover:text-white px-10 h-13 bg-transparent text-sm font-medium rounded-none transition-all duration-200">
              Partner Portal
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.34 }}
          className="flex flex-wrap justify-center gap-7 text-white/25 text-xs font-medium"
        >
          {[
            { icon: Icons.shield, label: 'KYC/KYB Verified' },
            { icon: Icons.lock, label: 'Encrypted Data Rooms' },
            { icon: Icons.checkCircle, label: 'Institutional Grade' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
