'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function DeveloperDashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const projects = [
    {
      id: '1',
      name: 'West Texas Wind Farm B',
      location: 'Lubbock, Texas',
      type: 'WIND',
      capacity: '150 MW',
      roi: '8-12%',
      status: 'READY FOR INVESTMENT',
      image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80&w=800',
      statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: '2',
      name: 'Sahara Solar Phase 1',
      location: 'Ouarzazate, Morocco',
      type: 'SOLAR',
      capacity: '75 MW',
      roi: '10.5%',
      status: 'DUE DILIGENCE',
      image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=800',
      statusColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: '3',
      name: 'Nile River Hydro Plant',
      location: 'Jinja, Uganda',
      type: 'HYDRO',
      capacity: '400 MW',
      roi: '14%',
      status: 'FEASIBILITY',
      image: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&q=80&w=800',
      statusColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  ];

  const matches = [
    {
      id: '1',
      name: 'GreenGrowth Capital',
      type: 'Infrastructure Fund',
      score: 98,
      tags: ['Wind', 'Solar', '>$50M'],
      initials: 'GC',
      color: 'bg-slate-800',
    },
    {
      id: '2',
      name: 'Nordic Power Fund',
      type: 'Sovereign Wealth',
      score: 85,
      tags: ['Hydro', 'Africa'],
      initials: 'NP',
      color: 'bg-blue-900',
    },
    {
      id: '3',
      name: 'Silicon Ventures',
      type: 'Venture Capital',
      score: 72,
      tags: ['Tech', 'Early Stage'],
      initials: 'SV',
      color: 'bg-teal-800',
    },
  ];

  return (
    <div className="flex h-screen bg-[#f9faf9] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 h-full flex flex-col justify-between glass-panel border-r border-gray-200/50 z-20">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#2bee79] aspect-square rounded-lg w-10 h-10 flex items-center justify-center text-[#111814] font-bold text-lg">
              EC
            </div>
            <div className="flex flex-col">
              <h1 className="text-[#111814] text-sm font-bold leading-tight uppercase tracking-tight">Energy Capital</h1>
              <p className="text-[#618971] text-[10px] font-medium uppercase tracking-widest">Developer Portal</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1 mt-4">
            <SidebarLink icon="dashboard" label="Dashboard" active />
            <SidebarLink icon="projects" label="My Projects" />
            <SidebarLink icon="documents" label="Data Room" />
            <SidebarLink icon="messages" label="Messages" badge={3} />
            <SidebarLink icon="trending" label="Analytics" />
          </nav>
        </div>

        <div className="p-6 border-t border-gray-200/50">
          <button className="flex items-center gap-3 w-full px-4 py-2 rounded-lg hover:bg-white/50 text-[#618971] transition-all mb-2">
            <Icons.settings className="size-5" />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg hover:bg-red-50 text-[#618971] hover:text-red-600 transition-all mb-4 group"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:text-red-600">logout</span>
            <span className="text-sm font-medium">Log Out</span>
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="size-9 rounded-full bg-gray-200 overflow-hidden border border-gray-200">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="User avatar" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#111814]">{user?.email?.split('@')[0] || 'Sarah Jenkins'}</span>
              <span className="text-[10px] text-[#618971]">Lead Developer</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto bg-[#f9faf9] relative flex flex-col">
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#111814 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-[1200px] w-full mx-auto p-8 z-10 flex flex-col gap-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-[#111814] tracking-tight">Overview</h2>
              <p className="text-[#618971] mt-1">Welcome back. Here's what's happening with your energy portfolio.</p>
            </div>
            <button className="flex items-center justify-center gap-2 bg-[#111814] hover:bg-black text-white px-6 py-3 rounded-lg shadow-lg shadow-gray-200 transition-all transform hover:-translate-y-0.5">
              <Icons.plus className="size-4" />
              <span className="text-sm font-semibold">Create New Project</span>
            </button>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-panel rounded-xl p-6 shadow-sm border border-white/50 bg-white/70">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-bold text-[#111814]">Data Room Activity</h3>
                  <p className="text-xs text-[#618971]">Investor engagement over the last 7 days</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#2bee79]"></span>
                    <span className="text-[#618971]">Views</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-gray-200"></span>
                    <span className="text-[#618971]">Downloads</span>
                  </div>
                </div>
              </div>
              <div className="h-48 w-full flex items-end justify-between gap-4 px-2">
                {[40, 85, 45, 92, 55, 30, 25].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 group w-full">
                    <div className="relative w-full flex gap-1 h-32 items-end justify-center">
                      <div className="w-3 bg-gray-100 rounded-t-sm" style={{ height: `${h * 0.6}%` }}></div>
                      <div className="w-3 bg-[#2bee79] rounded-t-sm group-hover:bg-[#22bf61] transition-colors" style={{ height: `${h}%` }}></div>
                    </div>
                    <span className="text-[10px] text-[#618971] font-bold uppercase tracking-tighter">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6 shadow-sm flex flex-col justify-center relative overflow-hidden bg-white/70 border border-white/50">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#2bee79]/10 rounded-full blur-2xl"></div>
              <h3 className="text-[10px] font-bold text-[#618971] uppercase tracking-widest mb-2">Total Interest</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#111814]">145</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
              </div>
              <p className="text-[11px] text-[#618971] mt-3 leading-relaxed">Unique institutional views across all active projects.</p>
              
              <div className="mt-8 pt-8 border-t border-gray-100">
                <h3 className="text-[10px] font-bold text-[#618971] uppercase tracking-widest mb-3">Pending Actions</h3>
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                    <Icons.warning className="size-4" />
                  </div>
                  <span className="text-xs text-[#111814] font-bold">2 NDAs awaiting signature</span>
                </div>
              </div>
            </div>
          </div>

          {/* Projects Section */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <h3 className="text-xl font-black text-[#111814] tracking-tight">My Projects</h3>
              <button className="text-xs font-bold text-[#618971] hover:text-[#111814] flex items-center gap-1 transition-colors">
                VIEW ALL <Icons.arrowRight className="size-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {projects.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group flex flex-col h-full hover:-translate-y-1">
                  <div className="relative h-44 rounded-lg overflow-hidden mb-5 bg-gray-100">
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[9px] font-black text-[#111814] shadow-sm z-10 tracking-widest uppercase">
                      {p.type}
                    </div>
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className={cn("absolute bottom-3 right-3 px-2 py-0.5 rounded text-[9px] font-black border tracking-widest uppercase", p.statusColor)}>
                      {p.status}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-[#111814] mb-1 leading-tight">{p.name}</h4>
                    <p className="text-[#618971] text-xs flex items-center gap-1 mb-5">
                      <Icons.region className="size-3" /> {p.location}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-[#f9faf9] rounded-lg p-3 border border-gray-50">
                        <p className="text-[9px] text-[#618971] uppercase font-bold tracking-widest mb-1">Capacity</p>
                        <p className="text-sm font-black text-[#111814]">{p.capacity}</p>
                      </div>
                      <div className="bg-[#f9faf9] rounded-lg p-3 border border-gray-50">
                        <p className="text-[9px] text-[#618971] uppercase font-bold tracking-widest mb-1">Est. ROI</p>
                        <p className="text-sm font-black text-[#111814]">{p.roi}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="size-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] text-[#618971] font-bold">
                          {i === 3 ? '+4' : <Icons.user className="size-3" />}
                        </div>
                      ))}
                    </div>
                    <Link href={`/projects/${p.id}`}>
                      <button className="bg-[#2bee79]/20 hover:bg-[#2bee79] text-[#111814] text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all">
                        Manage Project
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Right Sidebar - Matches */}
      <aside className="w-80 h-full glass-panel border-l border-gray-200/50 flex-shrink-0 z-20 flex flex-col bg-white/40">
        <div className="p-6 border-b border-gray-200/50 bg-white/20">
          <h3 className="text-lg font-black text-[#111814] tracking-tight leading-none mb-2">Investor Matches</h3>
          <p className="text-[11px] text-[#618971] font-medium leading-tight">Institutional matches based on your portfolio criteria.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 no-scrollbar">
          {matches.map((m) => (
            <div key={m.id} className="bg-white/80 p-4 rounded-xl border border-white hover:bg-white transition-all shadow-sm hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("size-10 rounded-full flex items-center justify-center text-white font-black text-xs", m.color)}>
                    {m.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[#111814] leading-none mb-1">{m.name}</h4>
                    <p className="text-[10px] text-[#618971] font-bold uppercase tracking-wider">{m.type}</p>
                  </div>
                </div>
                <div className="relative size-11 flex items-center justify-center">
                  <svg className="size-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle className="text-gray-100" stroke="currentColor" strokeWidth="3" fill="none" cx="18" cy="18" r="16" />
                    <circle className="text-[#2bee79]" stroke="currentColor" strokeWidth="3" strokeDasharray={`${m.score}, 100`} strokeLinecap="round" fill="none" cx="18" cy="18" r="16" />
                  </svg>
                  <span className="absolute text-[10px] font-black text-[#111814]">{m.score}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {m.tags.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[#f9faf9] border border-gray-100 text-[#618971] text-[9px] font-bold rounded uppercase tracking-widest">{t}</span>
                ))}
              </div>
              <button className="w-full py-2.5 rounded-lg border-2 border-gray-100 text-[10px] font-black uppercase tracking-widest text-[#111814] hover:bg-[#111814] hover:text-white hover:border-[#111814] transition-all">
                Request Intro
              </button>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-gray-200/50 bg-white/20">
          <button className="w-full py-3.5 bg-[#111814] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2">
            View All Matches <Icons.arrowRight className="size-3" />
          </button>
        </div>
      </aside>
    </div>
  );
}

function SidebarLink({ icon, label, active = false, badge }: { icon: keyof typeof Icons, label: string, active?: boolean, badge?: number }) {
  const Icon = Icons[icon];
  return (
    <button className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group w-full",
      active 
        ? "bg-[#2bee79] text-[#111814] shadow-sm font-bold" 
        : "text-[#618971] hover:bg-white/50 hover:text-[#111814]"
    )}>
      <Icon className={cn("size-5", active ? "text-[#111814]" : "text-[#618971] group-hover:text-[#111814]")} />
      <span className="text-sm tracking-tight">{label}</span>
      {badge && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white">
          {badge}
        </span>
      )}
    </button>
  );
}
