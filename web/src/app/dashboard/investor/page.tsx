'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { matchingApi } from '@/services/api';
import { CapitalMatchResult } from '@/types';

export default function InvestorDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [matches, setMatches] = useState<CapitalMatchResult[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') {
        // Redirect if not investor or admin
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchMatches() {
      // In a real scenario, we'd fetch matches for the investor's projects or general matches
      // For MVP, we'll try to find some matches if projects exist
      setLoadingMatches(true);
      try {
        // This is a placeholder since we don't have a specific "get matches for investor" endpoint yet
        // In a real app, we'd have matchingApi.getInvestorMatches(investorId)
        setMatches([]); 
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoadingMatches(false);
      }
    }

    if (user && activeTab === 'dashboard') {
      fetchMatches();
    }
  }, [user, activeTab]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.spinner className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-surface border-r border-gray-100 flex flex-col h-full z-20">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-10 text-primary">
              <Icons.logo className="w-full h-full" />
            </div>
            <span className="text-xl font-bold tracking-tight text-text-main leading-none">Afri Connect</span>
          </Link>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-13">Investor Portal</p>
        </div>

        <nav className="flex-grow px-4 space-y-2">
          <SidebarItem 
            icon={<Icons.layoutDashboard className="size-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem 
            icon={<Icons.search className="size-5" />} 
            label="Marketplace" 
            active={activeTab === 'marketplace'} 
            onClick={() => setActiveTab('marketplace')}
          />
          <SidebarItem 
            icon={<Icons.briefcase className="size-5" />} 
            label="Portfolio" 
            active={activeTab === 'portfolio'} 
            onClick={() => setActiveTab('portfolio')}
          />
          <SidebarItem 
            icon={<Icons.messageSquare className="size-5" />} 
            label="Messages" 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')}
            badge={5}
          />
          <SidebarItem 
            icon={<Icons.fileText className="size-5" />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="p-6 rounded-2xl bg-primary text-white border border-primary/20 mb-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-white/80">Portfolio Health</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-3xl font-black text-white">$450M</span>
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1.5">Deployed</span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden border border-white/10">
                <div className="bg-white h-full w-[65%] shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2">
            <div className="size-10 rounded-xl bg-gray-100 overflow-hidden border border-gray-200">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || 'Investor'}`} alt="User" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold text-text-main leading-none">{user.full_name || 'Investor'}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">Capital Partner</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-text-muted hover:text-error transition-colors p-2 rounded-lg hover:bg-slate-100"
              title="Logout"
            >
              <Icons.logOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-2">Investor Overview</h1>
              <p className="text-text-muted font-medium">Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}. Here are the top opportunities matching your criteria.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search projects..." 
                  className="h-12 pl-12 pr-6 rounded-xl border-none bg-surface shadow-soft text-sm font-medium w-64 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <Button className="h-12 px-6 bg-primary text-primary-content hover:bg-primary/90 font-bold rounded-xl shadow-lg transition-all flex gap-2">
                <Icons.plus className="size-5" />
                New Criteria
              </Button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Hero Highlight */}
              <div className="relative p-12 rounded-[40px] bg-slate-900 text-white overflow-hidden mb-12 shadow-2xl group">
                {/* Visual Background Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] translate-x-1/4 -translate-y-1/4 group-hover:bg-primary/30 transition-all duration-1000" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4" />
                
                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-green-400 border border-green-500/20 mb-8">
                    <Icons.zap className="size-3.5 fill-green-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Institutional Insight</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-[1.1]">New Opportunities <br /><span className="text-primary-light">Found for You.</span></h2>
                  <p className="text-lg text-slate-400 font-medium leading-relaxed mb-10">
                    We've identified 3 high-potential projects in West Africa matching your investment criteria for Q3 2024.
                  </p>
                  <div className="flex gap-4">
                    <Button className="h-14 px-10 bg-primary text-white font-black rounded-2xl hover:scale-105 hover:shadow-xl hover:shadow-primary/20 transition-all">
                      Review Matches
                    </Button>
                    <Button className="h-14 px-8 bg-transparent border border-slate-600 text-white hover:bg-white/10 font-bold rounded-2xl transition-all">
                      Adjust Criteria
                    </Button>
                  </div>
                </div>
              </div>

              {/* Filters & Grid */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex gap-2">
                  <FilterTag label="All Projects" active />
                  <FilterTag label="Solar PV" />
                  <FilterTag label="Wind Energy" />
                  <FilterTag label="Hydro" />
                </div>
                <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest text-text-muted flex gap-2">
                  <Icons.filter className="size-4" />
                  Sort & Filter
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <OpportunityCard 
                  name="50MW Solar Farm"
                  location="Kaduna, Nigeria"
                  capital="$35M"
                  readiness={94}
                  irr="18.5%"
                  tags={["Solar", "Nigeria", "Stage 3"]}
                />
                <OpportunityCard 
                  name="Coastal Wind Cluster"
                  location="Takoradi, Ghana"
                  capital="$120M"
                  readiness={82}
                  irr="14.2%"
                  tags={["Wind", "Ghana", "Stage 2"]}
                />
              </div>
            </>
          )}

          {activeTab === 'marketplace' && (
            <div className="space-y-8">
               <h2 className="text-2xl font-bold text-text-main">Marketplace</h2>
               <div className="p-12 text-center bg-surface rounded-3xl border border-dashed border-gray-200">
                  <Icons.search className="size-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-text-muted">Browse all available projects on the platform.</p>
               </div>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="space-y-8">
               <h2 className="text-2xl font-bold text-text-main">Your Portfolio</h2>
               <div className="p-12 text-center bg-surface rounded-3xl border border-dashed border-gray-200">
                  <Icons.briefcase className="size-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-text-muted">You haven't committed to any projects yet.</p>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-primary/10 text-primary font-bold shadow-sm" 
          : "text-text-muted hover:bg-gray-50 hover:text-text-main font-medium"
      )}
    >
      <div className={cn("transition-colors", active ? "text-primary" : "group-hover:text-primary")}>
        {icon}
      </div>
      <span className="text-sm flex-grow text-left">{label}</span>
      {badge && (
        <span className="size-5 rounded-full bg-primary text-[10px] font-black text-primary-content flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function FilterTag({ label, active }: { label: string, active?: boolean }) {
  return (
    <button className={cn(
      "px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
      active 
        ? "bg-text-main text-white shadow-lg shadow-text-main/10" 
        : "bg-surface text-text-muted hover:bg-gray-50 border border-gray-100"
    )}>
      {label}
    </button>
  );
}

function OpportunityCard({ name, location, capital, readiness, irr, tags }: { name: string, location: string, capital: string, readiness: number, irr: string, tags: string[] }) {
  return (
    <div className="p-8 rounded-3xl bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-text-main mb-2 group-hover:text-primary transition-colors">{name}</h3>
          <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
            <Icons.mapPin className="size-3" />
            {location}
          </div>
        </div>
        <div className="size-10 rounded-full border border-gray-100 flex items-center justify-center text-text-muted hover:text-primary cursor-pointer transition-colors">
          <Icons.bookmark className="size-4" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8 py-6 border-y border-gray-50">
        <div>
          <p className="text-meta mb-1">Capital Req.</p>
          <p className="text-sm font-bold text-text-main">{capital}</p>
        </div>
        <div>
          <p className="text-meta mb-1">Target IRR</p>
          <p className="text-sm font-bold text-primary">{irr}</p>
        </div>
        <div>
          <p className="text-meta mb-1">Readiness</p>
          <p className="text-sm font-bold text-text-main">{readiness}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-lg bg-background text-[10px] font-bold text-text-muted uppercase tracking-wider">
              {tag}
            </span>
          ))}
        </div>
        <Link href={`/projects/1`}>
          <Button className="h-10 px-6 rounded-xl bg-text-main text-white font-bold text-xs hover:bg-text-main/90 transition-all">
            Review Deal
          </Button>
        </Link>
      </div>
    </div>
  );
}


