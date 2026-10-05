'use client';

import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/icons';
import Link from 'next/link';

const PROJECTS = [
  {
    name: 'Kafue Solar Park',
    location: 'Kafue, Zambia',
    capacity: '50 MW',
    funding: '$42M',
    stage: 'Full Feasibility',
    readiness: 88,
    image: '/grid-1.jpg',
    match: 94,
  },
  {
    name: 'Lake Kariba Hydro',
    location: 'Siavonga, Zambia',
    capacity: '120 MW',
    funding: '$180M',
    stage: 'PPA Ready',
    readiness: 92,
    image: '/grid-2.jpg',
    match: 91,
  },
  {
    name: 'Lusaka Wind Farm',
    location: 'Lusaka, Zambia',
    capacity: '30 MW',
    funding: '$28M',
    stage: 'Concept',
    readiness: 45,
    image: '/grid-3.jpg',
    match: 78,
  },
];

const STAGE_STYLE: Record<string, string> = {
  'Concept': 'bg-white/10 text-white/60 border border-white/15',
  'Full Feasibility': 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30',
  'PPA Ready': 'bg-emerald-400 text-[#041f12] border border-emerald-400',
};

export function MarketplacePreview() {
  return (
    <section id="marketplace" className="py-28 md:py-36 bg-[#041f12] relative overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.22em] mb-4"
            >
              Marketplace
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="text-4xl md:text-5xl font-bold text-white tracking-tight"
            >
              Live Opportunities
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-white/40 font-medium mt-3 text-base"
            >
              Verified projects currently seeking investment and technical partners
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-emerald-300 font-semibold text-sm hover:gap-3 transition-all duration-200 group"
            >
              View Full Marketplace
              <Icons.arrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Image-forward grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {PROJECTS.map((project, i) => (
            <motion.div
              key={project.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              className="group relative overflow-hidden bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-500 cursor-pointer"
            >
              {/* Image — tall editorial crop */}
              <div className="relative h-56 overflow-hidden">
                <img
                  src={project.image}
                  alt={project.name}
                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#041f12] via-[#041f12]/30 to-transparent" />

                {/* Match badge — top right */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-sm">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-300 tracking-wider">{project.match}% Match</span>
                </div>

                {/* Stage badge — bottom left */}
                <div className={`absolute bottom-4 left-4 px-2.5 py-1 text-[10px] font-bold tracking-wider ${STAGE_STYLE[project.stage] ?? 'bg-white/10 text-white/60 border border-white/15'}`}>
                  {project.stage}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h4 className="text-base font-bold text-white mb-1.5 tracking-tight">{project.name}</h4>
                    <div className="flex items-center gap-1.5 text-white/35 text-xs font-medium">
                      <Icons.mapPin className="w-3 h-3" />
                      {project.location}
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                    <Icons.zap className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.07]">
                  <div>
                    <div className="text-[9px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Capacity</div>
                    <div className="text-sm font-bold text-white">{project.capacity}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Funding</div>
                    <div className="text-sm font-bold text-white">{project.funding}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Readiness</div>
                    <div className={`text-sm font-bold ${project.readiness >= 80 ? 'text-emerald-400' : project.readiness >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {project.readiness}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
