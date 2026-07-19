'use client';

import { useState, ReactNode } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
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

const accountSection = (pathname: string): NavSection => ({
  label: 'Account',
  items: [
    { icon: <Icons.user className="size-[18px]" />, label: 'Profile', active: pathname === '/dashboard/profile', href: '/dashboard/profile' },
    { icon: <Icons.settings className="size-[18px]" />, label: 'Settings', active: pathname === '/dashboard/settings', href: '/dashboard/settings' },
  ] as SidebarNavItem[],
});

function developerNav(pathname: string, searchParams: string, isOrgAdmin: boolean): NavConfig {
  const tab = new URLSearchParams(searchParams).get('tab');
  return {
    portalLabel: 'Developer Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/developer' && !tab, href: '/dashboard/developer' },
          { icon: <Icons.folder className="size-[18px]" />, label: 'My Projects', active: tab === 'projects', href: '/dashboard/developer?tab=projects' },
          { icon: <Icons.shieldCheck className="size-[18px]" />, label: 'Data Room', active: tab === 'dataroom', href: '/dashboard/developer?tab=dataroom' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: tab === 'messages', href: '/dashboard/developer?tab=messages' },
          { icon: <Icons.pieChart className="size-[18px]" />, label: 'Analytics', active: tab === 'analytics', href: '/dashboard/developer?tab=analytics' },
          { icon: <Icons.users className="size-[18px]" />, label: 'Inbound Interest', active: tab === 'inbound', href: '/dashboard/developer?tab=inbound' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Workspace',
        items: [
          { icon: <Icons.search className="size-[18px]" />, label: 'Find Partners', active: tab === 'find-partners', href: '/dashboard/developer?tab=find-partners' },
          { icon: <Icons.plus className="size-[18px]" />, label: 'Submit Project', active: pathname.includes('/submit'), href: '/dashboard/developer/submit' },
          ...(isOrgAdmin ? [{ icon: <Icons.users className="size-[18px]" />, label: 'Team', active: pathname === '/dashboard/developer/team', href: '/dashboard/developer/team' } as SidebarNavItem] : []),
        ] as SidebarNavItem[],
      },
      accountSection(pathname),
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

function investorNav(pathname: string, searchParams: string): NavConfig {
  const tab = new URLSearchParams(searchParams).get('tab');
  return {
    portalLabel: 'Investor Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/investor' && !tab, href: '/dashboard/investor' },
          { icon: <Icons.target className="size-[18px]" />, label: 'My Matches', active: tab === 'matches', href: '/dashboard/investor?tab=matches' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: tab === 'marketplace', href: '/dashboard/investor?tab=marketplace' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: tab === 'portfolio', href: '/dashboard/investor?tab=portfolio' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: tab === 'messages', href: '/dashboard/investor?tab=messages' },
          { icon: <Icons.bookmark className="size-[18px]" />, label: 'Saved Projects', active: tab === 'bookmarks', href: '/dashboard/investor?tab=bookmarks' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: tab === 'reports', href: '/dashboard/investor?tab=reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Investment Profile', active: tab === 'profile', href: '/dashboard/investor?tab=profile' },
        ] as SidebarNavItem[],
      },
      accountSection(pathname),
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

function technicalNav(pathname: string, searchParams: string): NavConfig {
  const tab = new URLSearchParams(searchParams).get('tab');
  return {
    portalLabel: 'Technical Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/technical' && !tab, href: '/dashboard/technical' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: tab === 'marketplace', href: '/dashboard/technical?tab=marketplace' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: tab === 'portfolio', href: '/dashboard/technical?tab=portfolio' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: tab === 'messages', href: '/dashboard/technical?tab=messages' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: tab === 'reports', href: '/dashboard/technical?tab=reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Partner Profile', active: tab === 'profile', href: '/dashboard/technical?tab=profile' },
        ] as SidebarNavItem[],
      },
      accountSection(pathname),
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

function traderNav(pathname: string, searchParams: string): NavConfig {
  const tab = new URLSearchParams(searchParams).get('tab');
  return {
    portalLabel: 'Trading Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/trader' && !tab, href: '/dashboard/trader' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: tab === 'marketplace', href: '/dashboard/trader?tab=marketplace' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: tab === 'portfolio', href: '/dashboard/trader?tab=portfolio' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: tab === 'messages', href: '/dashboard/trader?tab=messages' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: tab === 'reports', href: '/dashboard/trader?tab=reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Trader Profile', active: tab === 'profile', href: '/dashboard/trader?tab=profile' },
        ] as SidebarNavItem[],
      },
      accountSection(pathname),
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

function grantNav(pathname: string, searchParams: string): NavConfig {
  const tab = new URLSearchParams(searchParams).get('tab');
  return {
    portalLabel: 'Grant Portal',
    sections: [
      {
        label: 'Main',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/dashboard/grant' && !tab, href: '/dashboard/grant' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: tab === 'marketplace', href: '/dashboard/grant?tab=marketplace' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: tab === 'portfolio', href: '/dashboard/grant?tab=portfolio' },
          { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Messages', active: tab === 'messages', href: '/dashboard/grant?tab=messages' },
        ] as SidebarNavItem[],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.fileText className="size-[18px]" />, label: 'Reports', active: tab === 'reports', href: '/dashboard/grant?tab=reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Grant Profile', active: tab === 'profile', href: '/dashboard/grant?tab=profile' },
        ] as SidebarNavItem[],
      },
      accountSection(pathname),
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
  const searchParams = useSearchParams().toString();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shouldSkip = SKIP_WRAP_PATHS.some(p => pathname.startsWith(p));

  if (shouldSkip) {
    return <>{children}</>;
  }

  const role = user?.role;
  const isOrgAdmin = user?.is_org_admin ?? false;
  const nav =
    role === 'DEVELOPER'         ? developerNav(pathname, searchParams, isOrgAdmin) :
    role === 'CAPITAL_PARTNER'   ? investorNav(pathname, searchParams) :
    role === 'TECHNICAL_PARTNER' ? technicalNav(pathname, searchParams) :
    role === 'POWER_TRADER'      ? traderNav(pathname, searchParams) :
    role === 'GRANT_PROVIDER'    ? grantNav(pathname, searchParams) :
    role === 'ADMIN'             ? adminNav(pathname) :
    developerNav(pathname, searchParams, isOrgAdmin); // fallback

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
        avatarUrl={user?.avatar_url}
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
