'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { projectsApi } from '@/services/api';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';

export default function ProjectAnalyticsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      if (!projectId) return;
      setLoading(true);
      try {
        const [projData, analyticsRes] = await Promise.all([
          projectService.getProjectDetails(projectId),
          projectsApi.getAnalytics(projectId)
        ]);
        setProject(projData);
        setAnalytics(analyticsRes.data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.spinner className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) return <div>Project not found</div>;

  const funnelSteps = [
    { label: 'Introductions', value: analytics?.funnel.intro || 0, color: 'bg-blue-400' },
    { label: 'NDA Signed', value: analytics?.funnel.nda || 0, color: 'bg-indigo-400' },
    { label: 'Due Diligence', value: analytics?.funnel.dueDiligence || 0, color: 'bg-purple-400' },
    { label: 'Term Sheet', value: analytics?.funnel.termSheet || 0, color: 'bg-pink-400' },
    { label: 'Closed', value: analytics?.funnel.closed || 0, color: 'bg-green-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm">
                <Icons.arrowLeft className="size-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{project.name}</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Deal Analytics</p>
            </div>
          </div>
          <Button className="bg-slate-900 text-white rounded-xl h-12 px-6 font-bold shadow-xl">
            Download Audit Report
          </Button>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Analytics Card */}
          <div className="lg:col-span-2 space-y-8">
            <div className="p-8 rounded-[40px] bg-white border border-slate-100 shadow-xl shadow-slate-200/40">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-10 flex items-center gap-3">
                <div className="size-2 rounded-full bg-primary" />
                Conversion Funnel
              </h3>
              
              <div className="space-y-4">
                {funnelSteps.map((step, idx) => {
                  const percentage = analytics?.funnel.intro > 0 ? (step.value / analytics.funnel.intro) * 100 : 0;
                  return (
                    <div key={idx} className="relative">
                      <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{step.label}</span>
                        <span className="text-sm font-black text-slate-900">{step.value} <span className="text-slate-300 ml-1 font-medium">PARTNERS</span></span>
                      </div>
                      <div className="w-full h-12 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                        <div 
                          className={cn("h-full transition-all duration-1000 ease-out flex items-center px-4", step.color)}
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        >
                          {percentage > 15 && <span className="text-[10px] font-black text-white uppercase tracking-widest">{Math.round(percentage)}%</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-xl shadow-slate-200/40">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Profile Velocity</h3>
                <div className="h-40 flex items-end justify-between gap-2">
                  {[30, 45, 25, 60, 80, 55, 90].map((h, i) => (
                    <div key={i} className="flex-grow bg-slate-50 rounded-t-lg relative group">
                      <div className="absolute bottom-0 left-0 right-0 bg-primary/20 rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>
              <div className="p-8 rounded-[32px] bg-slate-900 text-white shadow-xl shadow-slate-900/20">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Engagement Score</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-black text-white">8.4</p>
                    <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mt-1">+12% vs last week</p>
                  </div>
                  <div className="size-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                    <div className="size-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-8 uppercase tracking-wider">
                  Calculated based on average time spent in data room and document interactions.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-8">
            <StatSmall label="Total Impressions" value={analytics?.totalViews || 0} icon={<Icons.globe className="size-4" />} />
            <StatSmall label="Data Room Access" value={analytics?.dataroomAccess || 0} icon={<Icons.lock className="size-4" />} />
            
            <div className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-xl shadow-slate-200/40">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Recent Activity</h3>
              <div className="space-y-6">
                <ActivityItem label="Capital Partner Viewed" time="2 hours ago" />
                <ActivityItem label="NDA Request Received" time="5 hours ago" />
                <ActivityItem label="Document Downloaded" time="1 day ago" />
                <ActivityItem label="New Match Identified" time="2 days ago" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatSmall({ label, value, icon }: { label: string, value: number | string, icon: any }) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-lg shadow-slate-200/30 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
      <div className="p-3 bg-slate-50 rounded-xl text-slate-400">
        {icon}
      </div>
    </div>
  );
}

function ActivityItem({ label, time }: { label: string, time: string }) {
  return (
    <div className="flex gap-4">
      <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
      <div>
        <p className="text-xs font-bold text-slate-900">{label}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight">{time}</p>
      </div>
    </div>
  );
}
