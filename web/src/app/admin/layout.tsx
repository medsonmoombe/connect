'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { ReactNode, useEffect, useState } from 'react';
import { DashboardSidebar, SidebarNavItem, NavSection } from '@/components/dashboard/Sidebar';
import { DashboardNavbar } from '@/components/dashboard/Navbar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut, mfa_verified } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);



  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!user.is_platform_admin) {

    
        switch (user.role) {
          case 'DEVELOPER': router.push('/developer'); break;
          case 'CAPITAL_PARTNER': router.push('/investor'); break;
          case 'TECHNICAL_PARTNER': router.push('/technical'); break;
          case 'POWER_TRADER': router.push('/trader'); break;
          case 'GRANT_PROVIDER': router.push('/grant'); break;
          default: router.push('/dashboard');
        }
      }
    }
  }, [user, loading, router]);

  // Step-up verification happens on the dedicated /verify-otp page (branded
  // split-shell, resendable code) — not a bare inline form. ?next= returns
  // the admin to the exact console page they were on after verifying.
  useEffect(() => {
    if (!loading && user && user.is_platform_admin && !mfa_verified) {
      router.replace(`/verify-otp?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, mfa_verified, pathname, router]);

  if (loading || !user || !user.is_platform_admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="logo-gradient size-14 rounded-none flex items-center justify-center animate-pulse">
          <Icons.shield className="size-7 text-white" />
        </div>
        <p className="text-slate-600 font-medium animate-pulse">Verifying administration access...</p>
      </div>
    );
  }

  if (!mfa_verified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="logo-gradient size-14 rounded-none flex items-center justify-center animate-pulse">
          <Icons.shield className="size-7 text-white" />
        </div>
        <p className="text-slate-600 font-medium animate-pulse">Taking you to verification...</p>
      </div>
    );
  }

  const sections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Overview', href: '/admin', active: pathname === '/admin' },
        // { icon: <Icons.cpu className="size-[18px]" />, label: 'AI Portfolio Oversight', href: '/admin/ai-overview', active: pathname === '/admin/ai-overview' },
        { icon: <Icons.barChart2 className="size-[18px]" />, label: 'Platform Analytics', href: '/admin/analytics', active: pathname === '/admin/analytics' },
      ],
    },
    {
      label: 'Management',
      items: [
        { icon: <Icons.shieldCheck className="size-[18px]" />, label: 'Verification Queue', href: '/admin/verification', active: pathname === '/admin/verification' },
        { icon: <Icons.mail className="size-[18px]" />, label: 'Invite Users', href: '/admin/users', active: pathname === '/admin/users' },
        { icon: <Icons.eye className="size-[18px]" />, label: 'Review Queue', href: '/admin/review', active: pathname === '/admin/review' },
        { icon: <Icons.folder className="size-[18px]" />, label: 'All Projects', href: '/admin/projects', active: pathname === '/admin/projects' },
        { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Milestone Pipelines', href: '/admin/engagements', active: pathname === '/admin/engagements' },
        { icon: <Icons.building className="size-[18px]" />, label: 'Companies', href: '/admin/companies', active: pathname === '/admin/companies' },
        { icon: <Icons.users className="size-[18px]" />, label: 'Consultations', href: '/admin/consultation', active: pathname === '/admin/consultation' },
      ],
    },
    {
      label: 'System',
      items: [
        { icon: <Icons.cpu className="size-[18px]" />, label: 'AI Provider', href: '/admin/ai', active: pathname === '/admin/ai' },
        { icon: <Icons.settings className="size-[18px]" />, label: 'System Settings', href: '/admin/settings', active: pathname === '/admin/settings' },
      ],
    },
  ];

  const footerWidget = (
    <div className="sidebar-widget rounded-none p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">System Health</p>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">All Clear</span>
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700">Platform Core</span>
        <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Operational</span>
      </div>
      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-500 h-full w-full rounded-full" />
      </div>
    </div>
  );

  const allItems = sections.flatMap(s => s.items);
  const currentLabel = allItems.find(item => item.active)?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <DashboardSidebar
        portalLabel="Admin Command"
        navItems={allItems}
        sections={sections}
        footerWidget={footerWidget}
        userName={user?.full_name || 'Admin User'}
        userRole="Platform Admin"
        onSignOut={() => signOut()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-grow overflow-hidden">
        <DashboardNavbar
          title={currentLabel}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-grow overflow-y-auto bg-slate-50 p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
