'use client';

import { useState, ReactNode } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSidebar, SidebarNavItem, NavSection } from './Sidebar';
import { DashboardNavbar } from './Navbar';
import { buildAdminSections } from './admin-nav';
import { Icons } from '@/components/ui/icons';
import { getRoleLabel } from '@/lib/role-labels';
import { cn } from '@/lib/utils';

// â”€â”€â”€ Nav config type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface NavConfig {
  portalLabel: string;
  sections: NavSection[];
  footerWidget: ReactNode;
}

// â”€â”€â”€ Nav configs per role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const accountSection = (pathname: string): NavSection => ({
  label: 'Account',
  items: [
    { icon: <Icons.user className="size-[18px]" />, label: 'Profile', active: pathname === '/profile', href: '/profile' },
    { icon: <Icons.users className="size-[18px]" />, label: 'Team', active: pathname.startsWith('/settings/team'), href: '/settings/team' },
    { icon: <Icons.settings className="size-[18px]" />, label: 'Settings', active: pathname.startsWith('/settings') && !pathname.startsWith('/settings/team'), href: '/settings' },
  ],
});

function developerNav(pathname: string, _searchParams: string, isOrgAdmin: boolean): NavConfig {
  return {
    portalLabel: 'Developer Portal',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/developer', href: '/developer' },
          { icon: <Icons.folder className="size-[18px]" />, label: 'My Projects', active: pathname.startsWith('/developer/projects') || pathname.includes('/submit') || pathname.startsWith('/projects/'), href: '/developer/projects' },
          { icon: <Icons.users className="size-[18px]" />, label: 'Inbound', active: pathname.startsWith('/inbound'), href: '/inbound' },
        ],
      },
      {
        label: 'Workspace',
        items: [
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
          { icon: <Icons.cpu className="size-[18px]" />, label: 'AI Insights', active: pathname.startsWith('/developer/ai-insights'), href: '/developer/ai-insights' },
          { icon: <Icons.barChart3 className="size-[18px]" />, label: 'Analytics', active: pathname.startsWith('/developer/analytics'), href: '/developer/analytics' },
          { icon: <Icons.headphones className="size-[18px]" />, label: 'Consultation', active: pathname.startsWith('/developer/consultation') || pathname.startsWith('/developer/consultant'), href: '/developer/consultation' },
        ],
      },
      accountSection(pathname),
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
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
    portalLabel: 'Financier Portal',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/investor', href: '/investor' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: pathname.startsWith('/investor/marketplace') || pathname.startsWith('/investor/matches') || pathname.startsWith('/projects/'), href: '/investor/marketplace' },
        ],
      },
      {
        label: 'Deals',
        items: [
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: pathname.startsWith('/investor/portfolio'), href: '/investor/portfolio' },
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
          { icon: <Icons.bookmark className="size-[18px]" />, label: 'Saved Projects', active: pathname.startsWith('/investor/bookmarks'), href: '/investor/bookmarks' },
        ],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.barChart3 className="size-[18px]" />, label: 'Reports', active: pathname.startsWith('/investor/reports'), href: '/investor/reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Investment Profile', active: pathname.startsWith('/investor/profile'), href: '/investor/profile' },
        ],
      },
      accountSection(pathname),
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Portfolio Health</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Active</span>
          </span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-700">Match Engine</span>
          <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Running</span>
        </div>
        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-light h-full w-[85%] rounded-full" />
        </div>
      </div>
    ),
  };
}

function technicalNav(pathname: string): NavConfig {
  return {
    portalLabel: 'EPC & Advisory Portal',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/technical', href: '/technical' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: pathname.startsWith('/technical/marketplace') || pathname.startsWith('/technical/matches') || pathname.startsWith('/projects/'), href: '/technical/marketplace' },
        ],
      },
      {
        label: 'Deals',
        items: [
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: pathname.startsWith('/technical/portfolio'), href: '/technical/portfolio' },
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
        ],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.barChart className="size-[18px]" />, label: 'Reports', active: pathname.startsWith('/technical/reports'), href: '/technical/reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Capability Profile', active: pathname.startsWith('/technical/profile'), href: '/technical/profile' },
        ],
      },
      accountSection(pathname),
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Service Status</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Active</span>
          </span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-700">Availability</span>
          <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Open</span>
        </div>
        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-light h-full w-[90%] rounded-full" />
        </div>
      </div>
    ),
  };
}

function consultantNav(pathname: string, _searchParams: string): NavConfig {
  return {
    portalLabel: 'Consulting Portal',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/consultant', href: '/consultant' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: pathname.startsWith('/consultant/marketplace') || pathname.startsWith('/consultant/matches') || pathname.startsWith('/projects/'), href: '/consultant/marketplace' },
        ],
      },
      {
        label: 'Deals',
        items: [
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Portfolio', active: pathname === '/consultant/portfolio', href: '/consultant/portfolio' },
        ],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.barChart3 className="size-[18px]" />, label: 'Reports', active: pathname === '/consultant/reports', href: '/consultant/reports' },
          { icon: <Icons.user className="size-[18px]" />, label: 'Consulting Profile', active: pathname === '/consultant/profile', href: '/consultant/profile' },
        ],
      },
      accountSection(pathname),
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Consulting Status</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Active</span>
          </span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-700">Availability</span>
          <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Open</span>
        </div>
        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-light h-full w-[90%] rounded-full" />
        </div>
      </div>
    ),
  };
}

function adminNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Admin Command',
    sections: buildAdminSections(pathname),
    footerWidget: (
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
    ),
  };
}

function authorityNav(pathname: string): NavConfig {
  return {
    portalLabel: 'Regulator Management',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Overview', active: pathname === '/authority', href: '/authority' },
        ],
      },
      {
        label: 'Management',
        items: [
          { icon: <Icons.folder className="size-[18px]" />, label: 'Project Review', active: pathname.startsWith('/authority/projects'), href: '/authority/projects' },
          { icon: <Icons.building className="size-[18px]" />, label: 'Profiles', active: pathname.startsWith('/authority/organizations'), href: '/authority/organizations' },
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
        ],
      },
      {
        label: 'Account',
        items: [
          { icon: <Icons.user className="size-[18px]" />, label: 'Profile', active: pathname === '/profile', href: '/profile' },
          { icon: <Icons.settings className="size-[18px]" />, label: 'Settings', active: pathname.startsWith('/settings'), href: '/settings' },
        ],
      },
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Governance Status</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Active</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 font-medium">Project review and profile oversight enabled</p>
      </div>
    ),
  };
}
function traderNav(pathname: string, _searchParams: string): NavConfig {
  return {
    portalLabel: 'Trading Portal',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/trader', href: '/trader' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: pathname.startsWith('/trader/marketplace') || pathname.startsWith('/projects/'), href: '/trader/marketplace' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Active Deals', active: pathname === '/trader/portfolio', href: '/trader/portfolio' },
        ],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.barChart3 className="size-[18px]" />, label: 'Reports', active: pathname === '/trader/reports', href: '/trader/reports' },
          { icon: <Icons.settings className="size-[18px]" />, label: 'Trading Profile', active: pathname === '/trader/profile', href: '/trader/profile' },
        ],
      },
      {
        label: 'Comms',
        items: [
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
        ],
      },
      accountSection(pathname),
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Trading Status</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Active</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 font-medium">Offtake pipeline ready</p>
      </div>
    ),
  };
}

function grantNav(pathname: string, _searchParams: string): NavConfig {
  return {
    portalLabel: 'Grant Portal',
    sections: [
      {
        label: 'Overview',
        items: [
          { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Dashboard', active: pathname === '/grant', href: '/grant' },
          { icon: <Icons.search className="size-[18px]" />, label: 'Marketplace', active: pathname.startsWith('/grant/marketplace') || pathname.startsWith('/projects/'), href: '/grant/marketplace' },
          { icon: <Icons.briefcase className="size-[18px]" />, label: 'Active Grants', active: pathname === '/grant/portfolio', href: '/grant/portfolio' },
        ],
      },
      {
        label: 'Insights',
        items: [
          { icon: <Icons.barChart3 className="size-[18px]" />, label: 'Reports', active: pathname === '/grant/reports', href: '/grant/reports' },
          { icon: <Icons.settings className="size-[18px]" />, label: 'Funding Profile', active: pathname === '/grant/profile', href: '/grant/profile' },
        ],
      },
      {
        label: 'Comms',
        items: [
          { icon: <Icons.handshake className="size-[18px]" />, label: 'Engagements', active: pathname.startsWith('/engagements'), href: '/engagements' },
        ],
      },
      accountSection(pathname),
    ],
    footerWidget: (
      <div className="sidebar-widget rounded-none p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Grant Status</p>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Active</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 font-medium">Funding pipeline open</p>
      </div>
    ),
  };
}

// â”€â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SKIP_WRAP_PATHS = ['/admin'];

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
  const isPlatformAdmin = user?.is_platform_admin ?? false;
  const nav =
    isPlatformAdmin             ? adminNav(pathname) :
    role === 'DEVELOPER'         ? developerNav(pathname, searchParams, isOrgAdmin) :
    role === 'CAPITAL_PARTNER'   ? investorNav(pathname) :
    role === 'TECHNICAL_PARTNER' ? technicalNav(pathname) :
    role === 'CONSULTANT'        ? consultantNav(pathname, searchParams) :
    role === 'POWER_TRADER'      ? traderNav(pathname, searchParams) :
    role === 'GRANT_PROVIDER'    ? grantNav(pathname, searchParams) :
    role === 'AUTHORITY_ADMIN'   ? authorityNav(pathname) :
    role === 'AUTHORITY_REVIEWER'? authorityNav(pathname) :
    role === 'AUTHORITY_VIEWER'  ? authorityNav(pathname) :
    role === 'ADMIN'             ? adminNav(pathname) :
    developerNav(pathname, searchParams, isOrgAdmin);

  const allItems = nav.sections?.flatMap(s => s.items) ?? [];
  const activeLabel = allItems.find(n => n.active)?.label ?? 'Dashboard';

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const flatNavItems = nav.sections?.flatMap(s => s.items) ?? [];

  return (
    // `relative` makes the app shell the containing block for absolutely
    // positioned descendants that have no positioned ancestor of their own
    // (e.g. `sr-only` inputs). Without it those boxes resolve against the
    // initial containing block, escape this `overflow-hidden` frame and add
    // phantom scroll height to the document (the window then scrolls past the
    // whole app, showing a blank page). `z-0`-free on purpose: it creates no
    // stacking context.
    <div className="relative flex h-screen bg-slate-50 font-sans overflow-hidden">
      <DashboardSidebar
        portalLabel={nav.portalLabel}
        navItems={flatNavItems}
        sections={nav.sections}
        userName={user?.full_name}
        avatarUrl={user?.avatar_url}
        userRole={getRoleLabel(user?.role)}
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
        <main className="flex-grow overflow-y-auto no-scrollbar p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>

        {/* â”€â”€ Mobile Bottom Navigation â”€â”€ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 px-2 py-1.5 safe-area-bottom">
          <div className="flex items-center justify-around">
            {flatNavItems.slice(0, 5).map((item, i) => (
              <a
                key={i}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-none transition-colors min-w-0',
                  item.active ? 'text-primary' : 'text-slate-400'
                )}
              >
                <span className="size-5 flex items-center justify-center">{item.icon}</span>
                <span className="text-[8px] font-bold tracking-wider truncate max-w-[48px]">{item.label}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
