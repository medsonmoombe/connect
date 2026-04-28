'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';
import { companiesApi, projectsApi, auditLogsApi } from '@/services/api';
import { AuditLog } from '@/types';

interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  icon: ReactNode;
}

function StatCard({ title, value, change, isPositive, icon }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-xl shadow-slate-200/50">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-xl text-green-800">
          {icon}
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {change}
        </span>
      </div>
      <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    projects: 0,
    companies: 0,
    capital: '$0'
  });
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [companiesRes, projectsRes, auditRes] = await Promise.all([
          companiesApi.getAll(),
          projectsApi.getAdminAll(),
          auditLogsApi.getAll()
        ]);

        const projectsCount = projectsRes.data?.length || 0;
        const companiesCount = companiesRes.data?.length || 0;
        const totalCapital = projectsRes.data?.reduce((acc, p) => acc + (p.capital_required || 0), 0) || 0;

        setStats({
          users: 1284, // Placeholder
          projects: projectsCount,
          companies: companiesCount,
          capital: totalCapital > 1000000000 
            ? `$${(totalCapital / 1000000000).toFixed(1)}B` 
            : `$${(totalCapital / 1000000).toFixed(0)}M`
        });

        setActivities(auditRes.data || []);
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return date.toLocaleDateString();
  };

  const getActionLabel = (log: AuditLog) => {
    switch (log.action_type) {
      case 'PROJECT_VIEW': return 'viewed project';
      case 'USER_VERIFIED': return 'verified user';
      case 'USER_REJECTED': return 'rejected user';
      case 'TRANSITION': return 'transitioned engagement';
      default: return log.action_type.toLowerCase().replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'}</h2>
          <p className="text-slate-500 mt-1">Here's a summary of the platform's current performance and status.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => window.print()}>
            <Icons.download className="mr-2 size-4" /> Export Report
          </Button>
          <Link href="/dashboard/admin/users">
            <Button className="rounded-xl bg-green-800 hover:bg-green-900 shadow-lg shadow-green-900/20">
              <Icons.plus className="mr-2 size-4" /> Provision User
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[140px]">
        <StatCard 
          title="Total Users" 
          value={loading ? "..." : stats.users} 
          change="+12.5%" 
          isPositive={true}
          icon={<Icons.shieldCheck className="size-6" />}
        />
        <StatCard 
          title="Active Projects" 
          value={loading ? "..." : stats.projects} 
          change="+8.2%" 
          isPositive={true}
          icon={<Icons.folder className="size-6" />}
        />
        <StatCard 
          title="Platform Companies" 
          value={loading ? "..." : stats.companies} 
          change="+3.1%" 
          isPositive={true}
          icon={<Icons.building className="size-6" />}
        />
        <StatCard 
          title="Total Capital Pipeline" 
          value={loading ? "..." : stats.capital} 
          change="+18.4%" 
          isPositive={true}
          icon={<Icons.dollar className="size-6" />}
        />
      </div>

      {/* Main Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-[20px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Recent System Activity</h3>
            <Link href="/dashboard/admin/users">
              <Button variant="ghost" size="sm" className="text-green-800 font-bold text-xs hover:bg-green-50">VIEW ALL</Button>
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="p-12 text-center"><Icons.spinner className="size-6 animate-spin mx-auto text-green-800" /></div>
            ) : activities.length > 0 ? activities.slice(0, 8).map((log, i) => (
              <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs uppercase">
                    {log.user?.full_name?.substring(0, 2) || 'AD'}
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-bold text-slate-900">{log.user?.full_name || 'System'}</span>
                      <span className="text-slate-500 mx-1">{getActionLabel(log)}</span>
                      <span className="font-medium text-green-700">{log.entity_type}</span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{formatTime(log.timestamp)}</p>
                  </div>
                </div>
                <div className="size-2 rounded-full bg-green-500" />
              </div>
            )) : (
              <div className="p-12 text-center text-slate-400 italic">No recent activity.</div>
            )}
          </div>
        </div>

        {/* System Health / Alerts */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-slate-900/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/20 transition-all duration-700"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-green-500/20 rounded-2xl text-green-400 border border-green-500/20">
                  <Icons.zap className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-none">Command Center</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Live Intelligence</p>
                </div>
              </div>
            
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">API Latency</span>
                    <span className="text-green-400 font-mono">24ms</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-[95%] shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">DB Load</span>
                    <span className="text-green-400 font-mono">12%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-[12%] shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verification Queue</span>
                    <span className="px-3 py-1 bg-green-500 text-slate-900 text-[10px] font-black rounded-full">14 PENDING</span>
                  </div>
                </div>
              </div>
            </div>

            <Link href="/dashboard/admin/settings">
              <Button className="w-full mt-8 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold">
                SYSTEM CONSOLE
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-[20px] border border-slate-100 p-6 shadow-xl shadow-slate-200/50">
            <h3 className="font-bold text-slate-900 mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/admin/users" className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-green-800/20 hover:bg-green-50/50 transition-all group">
                <Icons.shieldCheck className="size-5 text-slate-400 group-hover:text-green-800 mb-2" />
                <p className="text-xs font-bold text-slate-900">User Audit</p>
              </Link>
              <Link href="/dashboard/admin/users" className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-green-800/20 hover:bg-green-50/50 transition-all group">
                <Icons.settings className="size-5 text-slate-400 group-hover:text-green-800 mb-2" />
                <p className="text-xs font-bold text-slate-900">Settings</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

