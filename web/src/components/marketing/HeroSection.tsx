'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

const STATS = [
  { value: 25, prefix: '$', suffix: 'B+', label: 'Capital Pipeline', icon: Icons.trendingUp },
  { value: 450, suffix: 'MW+', label: 'Project Capacity', icon: Icons.zap },
  { value: 85, suffix: '+', label: 'Verified Partners', icon: Icons.users },
  { value: 12, suffix: '', label: 'Countries', icon: Icons.globe },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Full-bleed background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/raphael-cruz-IwY-27ceRCA-unsplash.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#041f12]/90 via-[#052e1a]/80 to-[#0a3d22]/85" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#041f12] via-transparent to-transparent" />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10 pt-40 pb-28 md:pt-48 md:pb-36 w-full">
        <div className="max-w-3xl">
          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-[72px] font-bold text-white leading-[1.08] tracking-[-0.02em] mb-7"
          >
            The Intelligence Layer
            <br />
            for{' '}
            <span className="text-emerald-300">African Infrastructure</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22 }}
            className="text-lg md:text-xl text-white/55 leading-relaxed mb-12 max-w-xl font-normal"
          >
            Bridging developers and institutional capital through AI-driven vetting,
            structured data rooms, and verified partner matching.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="flex flex-col sm:flex-row gap-3 items-start mb-20"
          >
            <Link href="/register">
              <Button size="lg" className="bg-white hover:bg-emerald-50 text-[#041f12] px-9 h-13 group shadow-2xl shadow-black/30 text-sm font-semibold rounded-none transition-all duration-200">
                Register Your Project
                <Icons.arrowRight className="ml-2 size-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/[0.18] text-white/80 hover:bg-white/[0.08] hover:text-white px-9 h-13 bg-transparent text-sm font-medium rounded-none transition-all duration-200">
                Partner Portal
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.08] border border-white/[0.08] max-w-2xl"
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-[#041f12]/60 backdrop-blur-sm px-5 py-5 hover:bg-white/[0.06] transition-colors duration-300">
                <stat.icon className="size-3.5 text-emerald-400/70 mb-3" />
                <div className="text-2xl font-bold text-white tracking-tight tabular-nums">
                  <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </div>
                <div className="text-[9px] font-semibold text-white/35 uppercase tracking-[0.15em] mt-1.5">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#041f12] to-transparent z-10 pointer-events-none" />
    </section>
  );
}
