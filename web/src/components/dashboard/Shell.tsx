'use client';

import { useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSidebar, SidebarNavItem, NavSection } from './Sidebar';
import { DashboardNavbar } from './Navbar';
import { Icons } from '@/components/ui/icons';

// ─── Nav config type ─────────────────────────────────────────────────────────

interface NavConfig {
  portalLabel: string;
  sections: NavSection[];
  footerWidget: ReactNode;
}

// ─── Nav configs per role ────────────────────────────────────────────────────

function developerNav(pathname: string, isOrgAdmin: boolean): NavConfig {
  return {
    portalLabel: 'Developer Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/developer', href: '/dashboard/developer' },
          { icon: <Icons.folder className="size-[18px]" />, label: 'My Projects', active: false, href: '/dashboard/developer' },
          { icon: <Icons.shieldCheck className="size-[18px]" />, label: 'Data Room', active: false, href: '/dashboard/developer' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: false, href: '/dashboard/developer', badge: 3 },
          { icon: <Icons.pieChart className="size-[18px]" />, label: 'Analytics', active: false, href: '/dashboard/developer' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Workspace',
        items: [
          { icon: <Icons.search className="size-[18px]" />, label: 'Find Partners', active: false, href: '/dashboard/developer' },
          { icon: <Icons.plus className="size-[18px]" />, label: 'Submit Project', active: pathname.includes('/submit'), href: '/dashboard/developer/submit' },
          ...(isOrgAdmin ? [{ icon: <Icons.users className="size-[18px]" />, label: 'Team', active: pathname === '/dashboard/developer/team', href: '/dashboard/developer/team' } as SidebarNavItem] : []),
        ] as SidebarNavItem[],
      },
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">System Status</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Live</span>
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">AI Scoring Engine</span>
          <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Active</span>
        </div>
        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-light h-full w-[85%] rounded-full" />
        </div>
      </div>
    ),
  };
}

function investorNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Investor Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/investor', href: '/dashboard/investor' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: false, href: '/dashboard/investor' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: false, href: '/dashboard/investor' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: false, href: '/dashboard/investor' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: false, href: '/dashboard/investor' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Investment Profile', active: false, href: '/dashboard/investor' },
        ] as SidebarNavItem[],
      },
    ],
    footerWidget: (
      <div className="rounded-xl relative overflow-hidden p-3.5" style={{ background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.1em]">Portfolio Health</p>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-bold text-green-300 uppercase tracking-wider">Strong</span>
            </span>
          </div>
          <p className="text-xl font-black text-white leading-none">$450M</p>
          <p className="text-[10px] text-white/50 font-medium mt-0.5">Total managed assets</p>
          <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden mt-2.5">
            <div className="bg-white h-full w-[65%] rounded-full" />
          </div>
        </div>
      </div>
    ),
  };
}

function technicalNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Technical Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/technical', href: '/dashboard/technical' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: false, href: '/dashboard/technical' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: false, href: '/dashboard/technical' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: false, href: '/dashboard/technical', badge: 2 },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: false, href: '/dashboard/technical' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Partner Profile', active: false, href: '/dashboard/technical' },
        ] as SidebarNavItem[],
      },
    ],
    footerWidget: (
      <div className="rounded-xl relative overflow-hidden p-3.5" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.1em]">Safety Record</p>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Compliant</span>
            </span>
          </div>
          <p className="text-xl font-black text-white leading-none">
            0.00 <span className="text-[10px] font-bold text-white/40">LTIR</span>
          </p>
          <p className="text-[10px] text-white/40 font-medium mt-0.5">Lost time incident rate</p>
        </div>
      </div>
    ),
  };
}

function adminNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Admin Command',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Overview', active: pathname === '/dashboard/admin', href: '/dashboard/admin' },
          { icon: <Icons.cpu className="size-[18px]" />, label: 'AI Portfolio Oversight', active: pathname === '/dashboard/admin/ai-overview', href: '/dashboard/admin/ai-overview' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Management',
        items: [
          { icon: <Icons.shieldCheck className="size-[18px]" />, label: 'Verification Queue', active: pathname === '/dashboard/admin/verification', href: '/dashboard/admin/verification' },
          { icon: <Icons.mail className="size-[18px]" />, label: 'User Provisioning', active: pathname === '/dashboard/admin/users', href: '/dashboard/admin/users' },
          { icon: <Icons.folder className="size-[18px]" />, label: 'All Projects', active: pathname === '/dashboard/admin/projects', href: '/dashboard/admin/projects' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Milestone Pipelines', active: pathname === '/dashboard/admin/engagements', href: '/dashboard/admin/engagements' },
          { icon: <Icons.building className="size-[18px]" />, label: 'All Companies', active: pathname === '/dashboard/admin/companies', href: '/dashboard/admin/companies' },
        ] as SidebarNavItem[],
      },
      {
        label: 'System',
        items: [
          { icon: <Icons.settings className="size-[18px]" />, label: 'System Settings', active: pathname === '/dashboard/admin/settings', href: '/dashboard/admin/settings' },
        ] as SidebarNavItem[],
      },
    ],

    footerWidget: (
      <div className="sidebar-widget rounded-xl p-3.5">
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
    ),
  };
}

function traderNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Trading Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/trader', href: '/dashboard/trader' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: false, href: '/dashboard/trader' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: false, href: '/dashboard/trader' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: false, href: '/dashboard/trader' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: false, href: '/dashboard/trader' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Trader Profile', active: false, href: '/dashboard/trader' },
        ] as SidebarNavItem[],
      },
    ],
    footerWidget: (
      <div className="rounded-xl relative overflow-hidden p-3.5" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.1em]">Trading Activity</p>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Active</span>
            </span>
          </div>
          <p className="text-[10px] text-white/40 font-medium mt-0.5">Power trading platform</p>
        </div>
      </div>
    ),
  };
}

function grantNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Grant Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/grant', href: '/dashboard/grant' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: false, href: '/dashboard/grant' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: false, href: '/dashboard/grant' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: false, href: '/dashboard/grant' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: false, href: '/dashboard/grant' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Grant Profile', active: false, href: '/dashboard/grant' },
        ] as SidebarNavItem[],
      },
    ],
    footerWidget: (
      <div className="rounded-xl relative overflow-hidden p-3.5" style={{ background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.1em]">Grant Activity</p>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-bold text-green-300 uppercase tracking-wider">Active</span>
            </span>
          </div>
          <p className="text-[10px] text-white/50 font-medium mt-0.5">Grant management platform</p>
        </div>
      </div>
    ),
  };
}

// ─── Shell ───────────────────────────────────────────────────────────────────

// Admin has its own layout.tsx with a custom sidebar — skip only admin routes
const SKIP_WRAP_PATHS = ['/dashboard/admin'];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shouldSkip = SKIP_WRAP_PATHS.some(p => pathname.startsWith(p));

  if (shouldSkip) {
    return <>{children}</>;
  }

  const role = user?.role;
  const isOrgAdmin = user?.is_org_admin ?? false;
  const nav =
    role === 'DEVELOPER'         ? developerNav(pathname, isOrgAdmin) :
    role === 'CAPITAL_PARTNER'   ? investorNav(pathname) :
    role === 'TECHNICAL_PARTNER' ? technicalNav(pathname) :
    role === 'POWER_TRADER'      ? traderNav(pathname) :
    role === 'GRANT_PROVIDER'    ? grantNav(pathname) :
    role === 'ADMIN'             ? adminNav(pathname) :
    developerNav(pathname, isOrgAdmin); // fallback

  const allItems = nav.sections?.flatMap(s => s.items) ?? [];
  const activeLabel = allItems.find(n => n.active)?.label ?? 'Dashboard';

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const flatNavItems = nav.sections?.flatMap(s => s.items) ?? [];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <DashboardSidebar
        portalLabel={nav.portalLabel}
        navItems={flatNavItems}
        sections={nav.sections}
        userName={user?.full_name}
        userRole={user?.role?.replace('_', ' ')}
        orgName={user?.company_name}
        onSignOut={handleSignOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-grow overflow-hidden">
        <DashboardNavbar
          title={activeLabel}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-grow overflow-y-auto no-scrollbar p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
