import React from 'react';
import Link from 'next/link';
import {
  Icons,
  ArrowUpRight,
  Shield,
  Globe, 
  Cpu, 
  Layers, 
  Handshake, 
  BarChart2, 
  CheckCircle2,
  Lock,
  ChevronRight,
  Database,
  ArrowRight,
  MapPin,
  Zap,
  Droplet,
  Wind
} from '@/components/ui/icons';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-green-100 selection:text-green-900 overflow-x-hidden">
      {/* Texture Overlay (Trailing) */}
      <div className="fixed inset-0 texture-overlay opacity-[0.04] pointer-events-none z-[100]"></div>
      
      {/* Background Grid Pattern (Trailing) */}
      <div className="absolute inset-0 grid-pattern opacity-[0.3] pointer-events-none z-0"></div>

      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 text-green-700">
              <Icons.logo className="w-full h-full" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Afri <span className="text-green-700 font-extrabold tracking-tighter">Connect</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-10 text-[12px] font-bold text-slate-500 uppercase tracking-wider">
            <Link href="/#platform" className="hover:text-green-700 transition-colors">Platform</Link>
            <Link href="/#marketplace" className="hover:text-green-700 transition-colors">Marketplace</Link>
            <Link href="/#intelligence" className="hover:text-green-700 transition-colors">Intelligence</Link>
            <div className="h-4 w-[1px] bg-slate-200" />
            <Link href="/login" className="hover:text-green-700 transition-colors">Login</Link>
            <Link href="/signup">
              <Button size="sm" className="bg-green-800 hover:bg-green-700 text-white rounded-full px-7 shadow-lg shadow-green-800/10">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-40 overflow-hidden bg-slate-50/50">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/raphael-cruz-IwY-27ceRCA-unsplash.jpg"
            alt="Solar Infrastructure Background"
            className="w-full h-full object-cover opacity-[0.22] mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-transparent to-slate-50/80"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-50/60 via-transparent to-slate-50/60"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center text-balance">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.15] tracking-tight mb-8">
              The Intelligence Layer for <span className="text-green-800">African Infrastructure</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 leading-relaxed mb-12 max-w-2xl mx-auto font-medium">
              Bridging the gap between developers and institutional capital through AI-driven vetting and structured data rooms.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
              <Link href="/signup">
                <Button size="lg" className="bg-green-800 hover:bg-green-700 text-white px-10 rounded-full h-15 group shadow-xl shadow-green-900/10">
                  Register Opportunity
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-900 px-10 rounded-full h-15 shadow-sm bg-white">
                  Partner Portal
                </Button>
              </Link>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/80 backdrop-blur-md border border-white p-6 rounded-[24px] shadow-soft flex flex-col items-center">
                <div className="text-4xl font-extrabold text-slate-900">$1.2B+</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Capital Pipeline</div>
              </div>
              <div className="bg-white/80 backdrop-blur-md border border-white p-6 rounded-[24px] shadow-soft flex flex-col items-center border-green-100 shadow-green-800/5">
                <div className="text-4xl font-extrabold text-slate-900">450MW+</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Project Capacity</div>
              </div>
              <div className="bg-white/80 backdrop-blur-md border border-white p-6 rounded-[24px] shadow-soft flex flex-col items-center">
                <div className="text-4xl font-extrabold text-slate-900">85+</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Verified Partners</div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Features Grid (Three Pillars) */}
      <section id="platform" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">One Ecosystem. Three Pillars.</h2>
            <p className="text-lg text-slate-500 font-medium">
              Standardizing the lifecycle of energy project finance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {/* Developer Card */}
            <div className="premium-card p-10 flex flex-col group">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-green-800 transition-colors duration-500">
                <Database className="w-7 h-7 text-green-800 group-hover:text-white transition-colors duration-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 h-8 flex items-center">Project Developers</h3>
              <p className="text-slate-500 leading-relaxed mb-8 flex-grow text-sm">
                Structured data rooms and AI-driven TRL scoring to make projects bankable.
              </p>
              <ul className="space-y-3 font-bold text-slate-700 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Deal Automation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Readiness Scoring</span>
                </li>
              </ul>
            </div>

            {/* Investor Card */}
            <div className="premium-card p-10 flex flex-col group border-green-100 shadow-xl">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-green-800 transition-colors duration-500">
                <BarChart2 className="w-7 h-7 text-green-800 group-hover:text-white transition-colors duration-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 h-8 flex items-center">Capital Partners</h3>
              <p className="text-slate-500 leading-relaxed mb-8 flex-grow text-sm">
                Deploy capital with confidence using verified intelligence and risk frameworks.
              </p>
              <ul className="space-y-3 font-bold text-slate-700 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Verified Deal Flow</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Risk Analytics</span>
                </li>
              </ul>
            </div>

            {/* Technical Card */}
            <div className="premium-card p-10 flex flex-col group">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-green-800 transition-colors duration-500">
                <Handshake className="w-7 h-7 text-green-800 group-hover:text-white transition-colors duration-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 h-8 flex items-center">Technical Partners</h3>
              <p className="text-slate-500 leading-relaxed mb-8 flex-grow text-sm">
                Connect with active projects seeking EPC, O&M, and advisory services.
              </p>
              <ul className="space-y-3 font-bold text-slate-700 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>RFP Pipeline</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Service Matching</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Live Opportunities (Marketplace Preview) */}
      <section id="marketplace" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Live Opportunities</h2>
              <p className="text-slate-500 font-medium">Verified projects currently seeking investment</p>
            </div>
            <Link href="/marketplace" className="flex items-center gap-2 text-green-700 font-bold text-sm hover:translate-x-1 transition-transform">
              View Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Project Card 1 */}
            <div className="premium-card overflow-hidden group">
              <div className="h-48 relative bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1566024287286-457247b70310?auto=format&fit=crop&q=80&w=800"
                  alt="Kafue Solar Park"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-green-700 border border-green-100 shadow-sm">
                  98% Match
                </div>
              </div>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-1">Kafue Solar Park</h4>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5" /> Kafue, Zambia
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600 border border-green-100">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Capacity</div>
                      <div className="text-lg font-bold text-slate-900">50 MW</div>
                   </div>
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funding Needed</div>
                      <div className="text-lg font-bold text-slate-900">$32M</div>
                   </div>
                </div>
              </div>
            </div>

            {/* Project Card 2 */}
            <div className="premium-card overflow-hidden group border-green-100 shadow-xl">
              <div className="h-48 relative bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80&w=800"
                  alt="Lusaka South Solar"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-green-700 border border-green-100 shadow-sm">
                  92% Match
                </div>
              </div>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-1">Lusaka South Solar</h4>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5" /> Lusaka, Zambia
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 border border-yellow-100">
                    <Icons.sun className="w-5 h-5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Capacity</div>
                      <div className="text-lg font-bold text-slate-900">310 MW</div>
                   </div>
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funding Needed</div>
                      <div className="text-lg font-bold text-slate-900">$85M</div>
                   </div>
                </div>
              </div>
            </div>

            {/* Project Card 3 */}
            <div className="premium-card overflow-hidden group">
              <div className="h-48 relative bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&q=80&w=800"
                  alt="Kariba Solar Expansion"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-green-700 border border-green-100 shadow-sm">
                  88% Match
                </div>
              </div>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-1">Kariba Solar Expansion</h4>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5" /> Siavonga, Zambia
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 border border-orange-100">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Capacity</div>
                      <div className="text-lg font-bold text-slate-900">120 MW</div>
                   </div>
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funding Needed</div>
                      <div className="text-lg font-bold text-slate-900">$140M</div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence Section */}
      <section id="intelligence" className="py-24 bg-slate-50/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
               <div className="premium-card p-8 relative overflow-hidden border-slate-200 max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-10">
                     <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-green-700" />
                        <span className="text-xs font-bold text-slate-900 uppercase">AI Engine</span>
                     </div>
                     <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full uppercase">Live Analysis</span>
                  </div>
                  
                  <div className="space-y-6 mb-10">
                     <div className="h-32 bg-slate-100 rounded-xl flex items-end gap-2 p-4 border border-slate-200">
                        <div className="h-[30%] w-full bg-slate-300 rounded-t-sm"></div>
                        <div className="h-[60%] w-full bg-slate-300 rounded-t-sm"></div>
                        <div className="h-[80%] w-full bg-green-600 rounded-t-sm shadow-[0_0_15px_rgba(22,101,52,0.2)]"></div>
                        <div className="h-[50%] w-full bg-slate-300 rounded-t-sm"></div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                           <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Tech Score</div>
                           <div className="text-xl font-bold text-slate-900">88.4%</div>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                           <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Readiness</div>
                           <div className="text-xl font-bold text-green-700">92.1%</div>
                        </div>
                     </div>
                  </div>

                  <div className="p-4 bg-slate-900 rounded-xl">
                     <p className="text-slate-300 text-xs italic leading-relaxed">
                       "Project TRL-7 verified. High stability. Aligns with 2026 standards."
                     </p>
                  </div>
               </div>
            </div>

            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-8">
                Data Integrity <br /> You Can Bank On.
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-10 font-medium">
                Our AI Scoring Engine analyzes technical specs and financial structures to ensure projects are investment-ready.
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-5">
                   <div className="w-10 h-10 bg-white shadow-soft rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
                      <Layers className="w-5 h-5 text-green-700" />
                   </div>
                   <div>
                      <h4 className="text-base font-bold text-slate-900 mb-1">Automated Data Rooms</h4>
                      <p className="text-sm text-slate-500">Guides developers through institutional disclosure requirements.</p>
                   </div>
                </div>
                <div className="flex gap-5">
                   <div className="w-10 h-10 bg-white shadow-soft rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
                      <Shield className="w-5 h-5 text-green-700" />
                   </div>
                   <div>
                      <h4 className="text-base font-bold text-slate-900 mb-1">Vetted Network</h4>
                      <p className="text-sm text-slate-500">KYC/KYB protocols ensure connection with legitimate partners.</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 bg-slate-50/50 relative overflow-hidden border-t border-slate-200">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/raphael-cruz-IwY-27ceRCA-unsplash.jpg"
            alt="Solar Infrastructure Background"
            className="w-full h-full object-cover opacity-[0.18] mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-transparent to-slate-50/80"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-50/60 via-transparent to-slate-50/60"></div>
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-green-100 text-green-800 text-[10px] font-bold uppercase tracking-widest mb-10 shadow-sm">
             <Globe className="w-3.5 h-3.5" />
             Join the African Network
          </div>
          <h2 className="text-4xl md:text-7xl font-bold text-slate-900 leading-tight mb-10">
            Build the Future <br /> of Energy.
          </h2>
          <p className="text-xl md:text-2xl text-slate-500 mb-14 max-w-2xl mx-auto font-medium">
            Join the network of developers and investors shaping the next decade.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-green-800 hover:bg-green-700 text-white px-14 rounded-full h-18 shadow-2xl shadow-green-900/20 text-lg">
                Apply for Membership
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-slate-200 text-slate-900 px-14 rounded-full h-18 shadow-lg bg-white text-lg">
                Talk to Strategy Team
              </Button>
            </Link>
          </div>
        </div>
        
      </section>

      {/* Footer */}
      <footer className="py-20 bg-white border-t border-slate-100 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16 text-center md:text-left">
            <div className="col-span-2">
               <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                  <div className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center">
                     <Icons.logo className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base font-bold text-slate-900 tracking-tight">Afri Connect</span>
               </div>
               <p className="text-slate-500 max-w-sm mx-auto md:mx-0 leading-relaxed font-medium">
                 The institutional marketplace for energy infrastructure. 
                 Bridging capital and capacity.
               </p>
            </div>
            <div>
               <h5 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-[10px]">Solutions</h5>
               <ul className="space-y-3 text-slate-500 text-sm font-semibold">
                  <li><Link href="/#platform" className="hover:text-green-700">Capital Matching</Link></li>
                  <li><Link href="/#intelligence" className="hover:text-green-700">Scoring Engine</Link></li>
                  <li><Link href="/#platform" className="hover:text-green-700">Technical Network</Link></li>
               </ul>
            </div>
            <div>
               <h5 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-[10px]">Company</h5>
               <ul className="space-y-3 text-slate-500 text-sm font-semibold">
                  <li><Link href="/#intelligence" className="hover:text-green-700">Methodology</Link></li>
                  <li><Link href="/contact" className="hover:text-green-700">Contact Us</Link></li>
                  <li><Link href="/#intelligence" className="hover:text-green-700">Regulatory</Link></li>
               </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="text-slate-400 text-xs font-bold uppercase tracking-tighter">© 2026 Afri Connect Ltd.</div>
             <div className="flex gap-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <Link href="#" className="hover:text-slate-900 transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-slate-900 transition-colors">Terms</Link>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
