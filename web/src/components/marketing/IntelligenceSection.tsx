'use client';

import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/icons';

export function IntelligenceSection() {
  return (
    <section id="intelligence" className="py-28 md:py-36 bg-[#f5f6f3] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">

          {/* Mock Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
            className="relative"
          >
            <div className="bg-white border border-slate-200/80 shadow-[0_24px_80px_rgba(15,23,42,0.08)] p-7 relative overflow-hidden">
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-600 via-emerald-400 to-green-600" />

              {/* Header */}
              <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#052e1a] flex items-center justify-center">
                    <Icons.cpu className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">AI Analysis Engine</span>
                </div>
                <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 border border-green-100">
                  <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider">Live</span>
                </div>
              </div>

              {/* Readiness bars */}
              <div className="space-y-4 mb-7">
                {[
                  { label: 'Regulatory Readiness', value: 92, color: 'bg-green-600' },
                  { label: 'Financial Readiness', value: 78, color: 'bg-blue-500' },
                  { label: 'Technical Readiness', value: 85, color: 'bg-violet-500' },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-500">{bar.label}</span>
                      <span className="text-xs font-bold text-slate-900">{bar.value}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${bar.value}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, delay: 0.4 }}
                        className={`h-full ${bar.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Score cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 bg-slate-50 border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Overall Score</div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight">85<span className="text-sm text-slate-300 font-normal">/100</span></div>
                </div>
                <div className="p-4 bg-green-50 border border-green-100">
                  <div className="text-[9px] font-bold text-green-600 uppercase tracking-wider mb-1.5">Project Stage</div>
                  <div className="text-2xl font-bold text-green-800 tracking-tight">Stage 3</div>
                  <div className="text-[10px] text-green-600 font-medium mt-0.5">Full Feasibility</div>
                </div>
              </div>

              {/* Document check */}
              <div className="p-5 bg-[#041f12]">
                <div className="flex items-center gap-2 mb-3">
                  <Icons.shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Document Verification</span>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Feasibility Study', status: 'verified' },
                    { name: 'Environmental Impact', status: 'verified' },
                    { name: 'Grid Connection', status: 'pending' },
                  ].map((doc) => (
                    <div key={doc.name} className="flex items-center justify-between">
                      <span className="text-xs text-white/40">{doc.name}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${doc.status === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.75 }}
              className="absolute -bottom-5 -right-5 bg-white border border-slate-200 shadow-[0_16px_48px_rgba(15,23,42,0.12)] p-4 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-50 border border-green-100 flex items-center justify-center">
                  <Icons.trendingUp className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Score Improved</div>
                  <div className="text-sm font-bold text-green-600">+12% this week</div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Text Content */}
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-bold text-green-700 uppercase tracking-[0.22em] mb-4"
            >
              Intelligence
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-6"
            >
              Data Integrity
              <br />
              You Can Bank On.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.16 }}
              className="text-base text-slate-400 leading-relaxed mb-10 font-normal"
            >
              Our AI scoring engine analyzes technical specs, financial structures, and documentary evidence
              to ensure projects meet institutional investment standards.
            </motion.p>

            <div className="space-y-6">
              {[
                { icon: Icons.layers, title: 'Automated Data Rooms', description: 'Guided document collection ensures every project meets institutional disclosure requirements.' },
                { icon: Icons.cpu, title: 'AI Readiness Scoring', description: 'Multi-dimensional analysis across regulatory, financial, and technical readiness dimensions.' },
                { icon: Icons.shield, title: 'Vetted Network', description: 'KYC/KYB protocols ensure every connection on the platform is legitimate and verified.' },
                { icon: Icons.alertTriangle, title: 'Risk Detection', description: 'Automated identification of documentation gaps, compliance issues, and project risks.' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.12 + i * 0.08 }}
                  className="flex gap-4 group"
                >
                  <div className="w-10 h-10 bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 group-hover:bg-green-50 group-hover:border-green-100 transition-colors duration-200">
                    <feature.icon className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{feature.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
