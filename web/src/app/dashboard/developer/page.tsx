'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export default function DeveloperDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const router = useRouter();

  const handleLogout = () => {
    // In a real app, you'd call your auth provider's logout method here
    router.push('/');
  };

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-surface border-r border-gray-100 flex flex-col h-full z-20">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-primary">
              <Icons.zap className="size-8" />
            </div>
            <span className="text-xl font-bold tracking-tight text-text-main leading-none">ECM Portal</span>
          </Link>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-11">Developer Unit</p>
        </div>

        <nav className="flex-grow px-4 space-y-2">
          <SidebarItem 
            icon={<Icons.layoutDashboard className="size-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem 
            icon={<Icons.folder className="size-5" />} 
            label="My Projects" 
            active={activeTab === 'projects'} 
            onClick={() => setActiveTab('projects')}
          />
          <SidebarItem 
            icon={<Icons.shieldCheck className="size-5" />} 
            label="Data Room" 
            active={activeTab === 'dataroom'} 
            onClick={() => setActiveTab('dataroom')}
          />
          <SidebarItem 
            icon={<Icons.messageSquare className="size-5" />} 
            label="Messages" 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')}
            badge={3}
          />
          <SidebarItem 
            icon={<Icons.pieChart className="size-5" />} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="p-4 rounded-2xl bg-background border border-gray-100 mb-6">
            <p className="text-meta mb-3">System Status</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-main">AI Scoring</span>
              <span className="text-[10px] font-bold text-primary uppercase">Active</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[85%]" />
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2">
            <div className="size-10 rounded-xl bg-gray-100 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="User" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold text-text-main leading-none">Sarah Jenkins</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">Lead Developer</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-text-muted hover:text-error transition-colors p-2 rounded-lg hover:bg-slate-800"
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
              <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-2">Overview</h1>
              <p className="text-text-muted font-medium">Welcome back, Sarah. Here's what's happening with your portfolio.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-12 px-6 rounded-xl border-gray-200 font-bold text-text-main hover:bg-gray-50">
                Generate Report
              </Button>
              <Button className="h-12 px-6 bg-text-main text-white hover:bg-text-main/90 font-bold rounded-xl shadow-lg transition-all flex gap-2">
                <Icons.plus className="size-5" />
                Create New Project
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <StatCard label="Total Projects" value="12" subValue="+2 this month" />
            <StatCard label="Capital Required" value="$450M" subValue="Across all stages" />
            <StatCard label="Active Matches" value="28" subValue="Institutional partners" />
            <StatCard label="Avg. Readiness" value="74/100" subValue="Institutional grade" progress={74} />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Active Projects List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between mb-2 px-2">
                <h2 className="text-xl font-bold text-text-main">Priority Projects</h2>
                <Link href="#" className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">View All Projects</Link>
              </div>
              
              <ProjectCard 
                name="Solar Phase II - Lagos"
                capacity="50 MW"
                location="Lagos, Nigeria"
                capital="$12.5M"
                stage="READY_TO_BUILD"
                score={88}
                matches={12}
              />
              <ProjectCard 
                name="Wind Harmattan Delta"
                capacity="120 MW"
                location="Accra, Ghana"
                capital="$84M"
                stage="FEASIBILITY"
                score={62}
                matches={4}
              />
              <ProjectCard 
                name="Hydro Power Blue Nile"
                capacity="25 MW"
                location="Addis Ababa, Ethiopia"
                capital="$45M"
                stage="UNDER_CONSTRUCTION"
                score={94}
                matches={8}
              />
            </div>

            {/* Sidebar Widgets */}
            <div className="space-y-8">
              {/* Notifications / Activity */}
              <div className="p-8 rounded-2xl bg-surface border border-gray-100 shadow-soft">
                <h3 className="text-lg font-bold text-text-main mb-6">Top Investor Matches</h3>
                <div className="space-y-6">
                  <MatchItem 
                    name="GreenGrowth Capital"
                    type="Infrastructure Fund"
                    score={98}
                    tags={["Solar", ">$50M"]}
                  />
                  <MatchItem 
                    name="Nordic Power Fund"
                    type="Sovereign Wealth"
                    score={85}
                    tags={["Hydro", "Africa"]}
                  />
                  <MatchItem 
                    name="Silicon Ventures"
                    type="Venture Capital"
                    score={72}
                    tags={["Wind", "Tech"]}
                  />
                </div>
                <Button variant="outline" className="w-full mt-8 h-12 rounded-xl border-gray-200 text-text-main font-bold hover:bg-gray-50">
                  View All Matches
                </Button>
              </div>

              {/* Data Room Activity */}
              <div className="p-8 rounded-2xl bg-primary text-primary-content shadow-xl shadow-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Icons.shieldCheck className="size-6" />
                  <h3 className="text-lg font-bold">Data Room Security</h3>
                </div>
                <p className="text-sm font-medium opacity-90 mb-6 leading-relaxed">
                  Your project documents are currently protected by institutional-grade encryption and access control.
                </p>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest bg-white/20 p-4 rounded-xl">
                  <span>Pending Requests</span>
                  <span className="size-6 rounded-full bg-white text-primary flex items-center justify-center">3</span>
                </div>
              </div>
            </div>
          </div>
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

function StatCard({ label, value, subValue, progress }: { label: string, value: string, subValue: string, progress?: number }) {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-gray-100 shadow-soft">
      <p className="text-meta mb-4">{label}</p>
      <h4 className="text-3xl font-extrabold text-text-main mb-2 tracking-tight">{value}</h4>
      <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{subValue}</p>
      {progress !== undefined && (
        <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ProjectCard({ name, capacity, location, capital, stage, score, matches }: { name: string, capacity: string, location: string, capital: string, stage: string, score: number, matches: number }) {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex gap-4">
          <div className="size-14 rounded-2xl bg-background flex flex-col items-center justify-center text-primary border border-gray-100">
            <Icons.zap className="size-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{name}</h4>
            <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-wider">
              <span className="flex items-center gap-1"><Icons.zap className="size-3" />{capacity}</span>
              <span className="flex items-center gap-1"><Icons.mapPin className="size-3" />{location}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-meta mb-1">Capital Required</p>
            <p className="text-sm font-bold text-text-main">{capital}</p>
          </div>
          <div className="text-right">
            <p className="text-meta mb-1">Score</p>
            <div className="flex items-center gap-2">
              <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${score}%` }} />
              </div>
              <span className="text-sm font-bold text-primary">{score}%</span>
            </div>
          </div>
          <Link href={`/projects/1`}>
            <Button size="icon" variant="ghost" className="rounded-xl hover:bg-primary/10 hover:text-primary">
              <Icons.chevronRight className="size-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MatchItem({ name, type, score, tags }: { name: string, type: string, score: number, tags: string[] }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-background border border-gray-100 flex items-center justify-center font-black text-text-muted text-xs group-hover:border-primary/50 group-hover:text-primary transition-all">
          {name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold text-text-main leading-tight">{name}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-xs font-black text-primary">{score}%</div>
        </div>
        <div className="size-8 rounded-full border-2 border-primary/20 flex items-center justify-center p-0.5">
          <div className="size-full rounded-full border-2 border-primary border-t-transparent animate-[spin_3s_linear_infinite]" />
        </div>
      </div>
    </div>
  );
}
