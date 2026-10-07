import { Icons } from '@/components/ui/icons';
import type { NavSection } from './Sidebar';

/**
 * Single source of truth for the platform-admin sidebar.
 *
 * The admin console (`/admin`, wrapped by `app/admin/layout.tsx`) and the
 * generic portal shell (`Shell.tsx`, used for admin pages outside `/admin`
 * such as `/settings`, `/engagements`, `/audit-logs`) must render the SAME
 * links. Previously each defined its own list, so navigating between them
 * made links appear and disappear.
 */
export function buildAdminSections(pathname: string): NavSection[] {
  return [
    {
      label: 'Overview',
      items: [
        { icon: <Icons.layoutDashboard className="size-[18px]" />, label: 'Overview', href: '/admin', active: pathname === '/admin' },
        { icon: <Icons.barChart2 className="size-[18px]" />, label: 'Platform Analytics', href: '/admin/analytics', active: pathname.startsWith('/admin/analytics') },
      ],
    },
    {
      label: 'Management',
      items: [
        { icon: <Icons.shieldCheck className="size-[18px]" />, label: 'Verification Queue', href: '/admin/verification', active: pathname.startsWith('/admin/verification') },
        { icon: <Icons.mail className="size-[18px]" />, label: 'Invite Users', href: '/admin/users', active: pathname.startsWith('/admin/users') },
        { icon: <Icons.eye className="size-[18px]" />, label: 'Review Queue', href: '/admin/review', active: pathname.startsWith('/admin/review') },
        { icon: <Icons.folder className="size-[18px]" />, label: 'All Projects', href: '/admin/projects', active: pathname.startsWith('/admin/projects') },
        { icon: <Icons.messageSquare className="size-[18px]" />, label: 'Milestone Pipelines', href: '/admin/engagements', active: pathname.startsWith('/admin/engagements') },
        { icon: <Icons.building className="size-[18px]" />, label: 'Companies', href: '/admin/companies', active: pathname.startsWith('/admin/companies') },
        { icon: <Icons.users className="size-[18px]" />, label: 'Consultations', href: '/admin/consultation', active: pathname.startsWith('/admin/consultation') },
      ],
    },
    {
      label: 'System',
      items: [
        { icon: <Icons.cpu className="size-[18px]" />, label: 'AI Provider', href: '/admin/ai', active: pathname.startsWith('/admin/ai') },
        { icon: <Icons.settings className="size-[18px]" />, label: 'System Settings', href: '/admin/settings', active: pathname.startsWith('/admin/settings') },
      ],
    },
  ];
}
