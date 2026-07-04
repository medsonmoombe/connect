'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { ReactNode, useEffect } from 'react';

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  active: boolean;
  badge?: number;
}

function SidebarItem({ icon, label, href, active, badge }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-green-800 text-white shadow-lg shadow-green-900/20" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <div className={cn(
        "transition-colors",
        active ? "text-white" : "text-slate-400 group-hover:text-green-700"
      )}>
        {icon}
      </div>
      <span className="font-medium flex-grow">{label}</span>
      {badge !== undefined && (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold",
          active ? "bg-green-700 text-white" : "bg-slate-200 text-slate-600"
        )}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        // Redirect non-admin users to their respective dashboards
        switch (user.role) {
          case 'DEVELOPER':
            router.push('/dashboard/developer');
            break;
          case 'CAPITAL_PARTNER':
          case 'TECHNICAL_PARTNER':
            router.push('/dashboard/investor');
            break;
          default:
            router.push('/dashboard');
        }
      }
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <Icons.shield className="size-12 text-green-800 animate-pulse" />
        <p className="text-slate-600 font-medium animate-pulse">Verifying administration access...</p>
      </div>
    );
  }

  const navItems = [
    {
      icon: <Icons.layoutDashboard className="size-5" />,
      label: "Overview",
      href: "/dashboard/admin",
    },
    {
      icon: <Icons.cpu className="size-5 text-green-700" />,
      label: "AI Portfolio Oversight",
      href: "/dashboard/admin/ai-overview",
    },
    {
      icon: <Icons.shieldCheck className="size-5" />,
      label: "Verification Queue",
      href: "/dashboard/admin/verification",
    },
    {
      icon: <Icons.shieldCheck className="size-5" />,
      label: "User Provisioning",
      href: "/dashboard/admin/users",
    },
    {
      icon: <Icons.folder className="size-5" />,
      label: "All Projects",
      href: "/dashboard/admin/projects",
    },
    {
      icon: <Icons.messageSquare className="size-5" />,
      label: "Milestone Pipelines",
      href: "/dashboard/admin/engagements",
    },
    {
      icon: <Icons.building className="size-5" />,
      label: "All Companies",
      href: "/dashboard/admin/companies",
    },
    {
      icon: <Icons.settings className="size-5" />,
      label: "System Settings",
      href: "/dashboard/admin/settings",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-full z-20 shadow-xl shadow-slate-200/50">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-10 text-green-800">
              <Icons.logo className="w-full h-full" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">Afri Connect</span>
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">Admin Command</span>
            </div>
          </Link>
        </div>

        <nav className="flex-grow px-4 space-y-1">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Management</p>
          {navItems.map((item) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={pathname === item.href}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Health</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900">Platform Core</span>
              <span className="text-[10px] font-bold text-green-600 uppercase">Operational</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-green-600 h-full w-[100%]" />
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2">
            <div className="size-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-500">
              {user?.full_name ? (
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} alt="User" />
              ) : (
                <Icons.shield className="size-6" />
              )}
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-none truncate">{user?.full_name || 'Admin User'}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Platform Admin</p>
            </div>
            <button
              onClick={() => signOut()}
              className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
              title="Logout"
            >
              <Icons.logOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900 capitalize">
              {navItems.find(item => item.href === pathname)?.label || "Dashboard"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search command..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20 w-64"
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl border-slate-200">
              <Icons.zap className="size-4 text-slate-600" />
            </Button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-grow overflow-y-auto bg-slate-50 p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
