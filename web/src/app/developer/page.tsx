'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { PageHero } from '@/components/ui/PageHero';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { OverviewDashboard } from '@/components/developer/OverviewDashboard';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import PageTitle from '@/components/PageTitle';

export default function DeveloperDashboardPage() {
  return (
    <>
      <PageTitle title="Developer Dashboard" />
      <DeveloperDashboard />
    </>
  );
}

function DeveloperDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const { unreadByEngagement } = useUnreadMessages();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user?.company_id) { setLoading(false); return; }
      try {
        const [projData, engData] = await Promise.all([
          projectService.getDeveloperProjects(user.company_id),
          engagementService.getCompanyEngagements(user.company_id),
        ]);
        setProjects(projData);
        setEngagements(engData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!user?.company_id) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-slate-600 font-medium">Your account is not linked to a company yet.</p>
          <Link href="/onboarding">
            <Button className="h-9 px-6 rounded-none">Complete Onboarding</Button>
          </Link>
        </div>
      </div>
    );
  }

  const scoredProjects = projects.filter(p => (p.scores?.capital_readiness_score ?? 0) > 0);
  const avgReadiness = scoredProjects.length > 0
    ? Math.round(scoredProjects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score ?? 0), 0) / scoredProjects.length)
    : 0;
  const totalCapital = projects.reduce((acc, p) => acc + (p.capital_required || 0), 0);
  const totalCapacity = projects.reduce((acc, p) => acc + p.project_size_mw, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Header (canonical dark-green) */}
      <PageHero
        eyebrow="Developer Overview"
        title={(() => {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
          return `${greeting}, ${user?.full_name?.split(' ')[0] || 'Partner'}`;
        })()}
        description={
          projects.length > 0
            ? `${projects.length} project${projects.length !== 1 ? 's' : ''} in your portfolio`
            : 'Start by creating your first project.'
        }
        actions={
          <Link href="/developer/submit">
            <Button className="h-9 px-4 bg-white text-[#0b3b24] hover:bg-emerald-50 border border-emerald-200/40" icon={<Icons.plus />}>
              New Project
            </Button>
          </Link>
        }
      />

      {/* Overview only — no tab switching */}
      <OverviewDashboard
        projects={projects}
        engagements={engagements}
        totalCapital={totalCapital}
        avgReadiness={avgReadiness}
        totalCapacity={totalCapacity}
        unreadByEngagement={unreadByEngagement}
      />
    </div>
  );
}