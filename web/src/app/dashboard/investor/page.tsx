'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Project, CapitalMatchResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import Link from 'next/link';

export default function InvestorDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  
  const [matches, setMatches] = useState<CapitalMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    const fetchMatches = async () => {
      try {
        setLoading(true);
        // Fetch matched projects for this capital partner
        // In a real scenario, we'd filter by the capital_partner_id linked to the user
        const { data, error } = await supabase
          .from('capital_match_results')
          .select('*, project:projects(*)')
          .order('compatibility_score', { ascending: false });

        if (error) throw error;
        setMatches(data as CapitalMatchResult[]);
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, authLoading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const stats = [
    { label: 'Active Engagements', value: '12', icon: 'handshake' },
    { label: 'Capital Deployed', value: '$450M', icon: 'payments' },
    { label: 'Avg. Match Score', value: '88%', icon: 'bolt' },
  ];

  const projectTypes = ['All', 'Solar PV', 'Wind Energy', 'Hydro', 'Green Hydrogen'];

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#102217]">
        <Icons.spinner className="h-8 w-8 animate-spin text-[#2bee79]" />
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 overflow-hidden h-screen flex">
      {/* Sidebar */}
      <aside className="w-72 h-full flex flex-col justify-between p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-white/20 dark:border-white/5 relative z-20 shadow-xl shrink-0 transition-all duration-300">
        <div className="flex flex-col gap-6">
          <div className="flex gap-3 items-center">
            <div className="size-10 shrink-0 bg-[#2bee79] rounded-full flex items-center justify-center text-slate-900">
              <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5z"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-slate-900 dark:text-white text-base font-bold leading-tight">Energy Capital Match</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Investor Portal</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2 mt-2">
            <Link href="/dashboard/investor" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#2bee79]/20 text-[#052e16] dark:text-white dark:bg-[#2bee79]/10 transition-colors group">
              <span className="material-symbols-outlined text-[#052e16] dark:text-[#2bee79]">dashboard</span>
              <span className="text-sm font-semibold">Dashboard</span>
            </Link>
            <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group">
              <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">business_center</span>
              <span className="text-sm font-medium">Projects</span>
            </Link>
            <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group">
              <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">chat</span>
              <span className="text-sm font-medium">Messages</span>
              <span className="ml-auto bg-[#2bee79] text-[#052e16] text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-gradient-to-br from-[#2bee79]/10 to-transparent p-4 rounded-lg border border-[#2bee79]/20">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Portfolio Status</p>
            <div className="w-full bg-white dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
              <div className="bg-[#2bee79] h-full rounded-full" style={{ width: '75%' }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Deployed</span>
              <span className="font-bold text-slate-900 dark:text-white">$450M</span>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 shrink-0 px-8 flex items-center justify-between bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Overview</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {user?.full_name || 'Partner'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
              </div>
              <input 
                className="block w-64 pl-10 pr-3 py-2.5 border-none rounded-lg leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2bee79] sm:text-sm shadow-sm transition-all" 
                placeholder="Search projects..." 
                type="text"
              />
            </div>
            <button className="relative p-2.5 bg-white dark:bg-slate-800 rounded-lg text-slate-500 hover:text-[#2bee79] transition-colors shadow-sm">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800"></span>
            </button>
            <div className="h-10 w-10 rounded-full bg-[#2bee79]/20 flex items-center justify-center text-[#2bee79] font-bold shadow-sm ring-2 ring-white dark:ring-slate-800">
              {user?.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 pb-20">
          {/* Hero Banner */}
          <div className="rounded-xl overflow-hidden bg-slate-900 shadow-sm mb-8 relative group min-h-[220px] flex flex-col justify-end p-8">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40 z-10"></div>
            <div className="relative z-20">
              <span className="inline-flex items-center rounded-full bg-[#2bee79]/20 px-2.5 py-0.5 text-xs font-medium text-[#2bee79] mb-3 w-fit backdrop-blur-md border border-[#2bee79]/30">
                Top Match
              </span>
              <h3 className="text-3xl font-bold text-white mb-2">New Opportunities Found</h3>
              <p className="text-slate-200 max-w-xl text-lg">We've identified {matches.length} projects matching your investment criteria for this quarter.</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                  <span className="material-symbols-outlined text-[#2bee79]">{stat.icon}</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Matching Opportunities</h3>
            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-2 bg-white dark:bg-slate-800">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Filter
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {projectTypes.map((type) => (
              <button 
                key={type}
                onClick={() => setFilter(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-sm transition-colors whitespace-nowrap
                  ${filter === type 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}
                `}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {matches.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-500">
                No matching projects found. Update your criteria to see more opportunities.
              </div>
            ) : (
              matches.map((match) => (
                <article 
                  key={match.id} 
                  className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-slate-100 dark:border-slate-700/50 flex flex-col h-full relative"
                >
                  <div className="absolute top-4 right-4">
                    <button className="text-slate-400 hover:text-[#2bee79] transition-colors">
                      <span className="material-symbols-outlined">bookmark</span>
                    </button>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-[#2bee79]/10 text-[#2bee79] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                        {match.project?.technology_type || 'Energy'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {match.project?.location_country}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{match.project?.name}</h4>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{match.project?.project_stage.replace('_', ' ')} phase</p>
                  </div>

                  <div className="flex items-center gap-6 mb-8">
                    {/* Progress Circle */}
                    <div className="relative w-20 h-20 shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="3" />
                        <circle 
                          cx="18" cy="18" r="16" fill="none" 
                          className="stroke-[#2bee79]" 
                          strokeWidth="3" 
                          strokeDasharray={`${match.compatibility_score}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{match.compatibility_score}%</span>
                        <span className="text-[8px] uppercase font-bold text-slate-400">Match</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">CapEx</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white">${(match.project?.capital_required || 0) / 1000000}M</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Capacity</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white">{match.project?.project_size_mw}MW</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <Link href={`/projects/${match.project_id}`}>
                      <Button className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white text-sm font-semibold">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
