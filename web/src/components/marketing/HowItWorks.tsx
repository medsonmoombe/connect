'use client';

import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/icons';

const STEPS = [
  {
    number: '01',
    icon: Icons.fileText,
    title: 'Register & Submit',
    description: 'Create your developer profile and submit project details with supporting documents.',
  },
  {
    number: '02',
    icon: Icons.cpu,
    title: 'AI Analysis',
    description: 'Our scoring engine evaluates regulatory, financial, and technical readiness automatically.',
  },
  {
    number: '03',
    icon: Icons.users,
    title: 'Partner Matching',
    description: 'Gap analysis identifies missing elements and recommends the right consultants and investors.',
  },
  {
    number: '04',
    icon: Icons.trendingUp,
    title: 'Close & Build',
    description: 'Engage partners, secure financing, and move your project through to construction.',
    highlight: true,
  },
];

export function HowItWorks() {
  return (
    <section className="py-28 md:py-36 bg-[#041f12] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.22em] mb-4"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-5"
          >
            From Idea to Investment
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="text-white/40 font-medium max-w-md mx-auto text-base"
          >
            Four steps to transform your project from concept to bankable opportunity.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-4 gap-5 relative">
          {/* Connector */}
          <div className="hidden md:block absolute top-[44px] left-[14%] right-[14%] h-px bg-gradient-to-r from-transparent via-emerald-700/50 to-transparent z-0" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative z-10 text-center group"
            >
              {/* Icon block */}
              <div className="relative mx-auto mb-7 w-fit">
                <div className={`w-[88px] h-[88px] flex items-center justify-center mx-auto border transition-colors duration-300 ${step.highlight ? 'bg-emerald-400 border-emerald-400 group-hover:bg-emerald-300' : 'bg-white/[0.05] border-white/[0.1] group-hover:bg-white/[0.09]'}`}>
                  <step.icon className={`size-8 ${step.highlight ? 'text-[#041f12]' : 'text-emerald-300'}`} />
                </div>
                <div className={`absolute -top-2.5 -right-2.5 w-7 h-7 flex items-center justify-center text-[10px] font-bold shadow-lg ${step.highlight ? 'bg-white text-[#041f12]' : 'bg-emerald-400 text-[#041f12]'}`}>
                  {step.number}
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-2.5 tracking-tight">{step.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed max-w-[200px] mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
