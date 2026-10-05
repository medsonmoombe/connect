'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { ReactNode, useEffect, useState } from 'react';
import { DashboardSidebar, NavSection } from '@/components/dashboard/Sidebar';
import { DashboardNavbar } from '@/components/dashboard/Navbar';

export default function AuthorityLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut, mfa_verified } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthorityUser = !!user?.is_authority_user;

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.is_platform_admin) router.push('/admin');
      else if (!isAuthorityUser) {
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
  }, [user, loading, isAuthorityUser, router]);

  // Step-up verification happens on the dedicated /verify-otp page (branded
  // split-shell, resendable code) — not a bare inline form. ?next= returns
  // the user to the exact regulator page they were on after verifying.
  useEffect(() => {
    if (!loading && user && isAuthorityUser && !mfa_verified) {
      router.replace(`/verify-otp?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, isAuthorityUser, mfa_verified, pathname, router]);

  if (loading || !user || user.is_platform_admin || !isAuthorityUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="logo-gradient size-14 rounded-none flex items-center justify-center animate-pulse">
          <Icons.shield className="size-7 text-white" />
        </div>
        <p className="text-slate-600 font-medium animate-pulse">Verifying regulator access...</p>
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
        {
          icon: <Icons.layoutDashboard className="size-[18px]" />,
          label: 'Dashboard',
          href: '/authority',
          active: pathname === '/authority',
        },
      ],
    },
    {
      label: 'Review',
      items: [
        {
          icon: <Icons.folder className="size-[18px]" />,
          label: 'Project Reviews',
          href: '/authority/projects',
          active: pathname.startsWith('/authority/projects'),
        },
        {
          icon: <Icons.messageSquare className="size-[18px]" />,
          label: 'Engagements',
          href: '/authority/engagements',
          active: pathname.startsWith('/authority/engagements'),
        },
        {
          icon: <Icons.building className="size-[18px]" />,
          label: 'Organisations',
          href: '/authority/organizations',
          active: pathname.startsWith('/authority/organizations'),
        },
      ],
    },
    ...(user?.is_authority_admin ? [{
      label: 'Administration',
      items: [
        {
          icon: <Icons.users className="size-[18px]" />,
          label: 'Team',
          href: '/authority/team',
          active: pathname.startsWith('/authority/team'),
        },
        {
          icon: <Icons.settings className="size-[18px]" />,
          label: 'Settings',
          href: '/settings',
          active: pathname.startsWith('/settings'),
        },
      ],
    }] : [{
      label: 'Account',
      items: [
        {
          icon: <Icons.settings className="size-[18px]" />,
          label: 'Settings',
          href: '/settings',
          active: pathname.startsWith('/settings'),
        },
      ],
    }]),
  ];

  const allItems = sections.flatMap(s => s.items);
  const currentLabel = allItems.find(item => item.active)?.label || 'Regulator Portal';

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <DashboardSidebar
        portalLabel="Regulator Portal"
        navItems={allItems}
        sections={sections}
        userName={user?.full_name || 'Regulator User'}
        userRole={user?.is_authority_admin ? 'Regulator Admin' : user?.is_authority_reviewer ? 'Regulator Reviewer' : 'Regulator Viewer'}
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
