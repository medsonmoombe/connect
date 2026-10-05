'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import { APP_NAME } from '@/lib/branding';
import { ReactNode } from 'react';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface SidebarNavItem {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
  href?: string;
  badge?: number;
}

export interface NavSection {
  label?: string;
  items: SidebarNavItem[];
}

interface DashboardSidebarProps {
  portalLabel: string;
  navItems: SidebarNavItem[];
  sections?: NavSection[];
  footerWidget?: ReactNode;
  userName?: string;
  avatarUrl?: string;
  userRole?: string;
  orgName?: string;
  onSignOut: () => void;
  open: boolean;
  onClose: () => void;
}

/* ─── NavItem ──────────────────────────────────────────────────────────────── */

function NavItem({ item }: { item: SidebarNavItem }) {
  return <NavLink item={item} />;
}

function NavLink({ item }: { item: SidebarNavItem }) {
  const isActive = item.active;

  const wrapperClass = cn(
    'w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-none nav-item-transition group text-left relative border-l-2',
    isActive
      ? 'bg-[#0b3b24]/[0.06] border-[#0b3b24]'
      : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
  );

  const iconContainerClass = cn(
    'flex items-center justify-center w-8 h-8 rounded-none shrink-0 nav-item-transition',
    isActive ? 'bg-[#0b3b24]/10' : 'bg-transparent group-hover:bg-slate-100'
  );

  const iconClass = cn(
    'size-[18px] nav-item-transition',
    isActive ? 'text-[#0b3b24]' : 'text-slate-400 group-hover:text-slate-600'
  );

  const labelClass = cn(
    'text-[13px] flex-grow nav-item-transition',
    isActive
      ? 'font-semibold text-[#0b3b24]'
      : 'font-medium text-slate-500 group-hover:text-slate-800'
  );

  const inner = (
    <>
      <span className={iconContainerClass}>
        <span className={iconClass}>{item.icon}</span>
      </span>
      <span className={labelClass}>{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0b3b24] px-1.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.href) {
    return <Link href={item.href} className={wrapperClass}>{inner}</Link>;
  }
  return (
    <button onClick={item.onClick} className={wrapperClass}>
      {inner}
    </button>
  );
}

/* ─── Section Divider ──────────────────────────────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div className="px-4 pt-5 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="mx-4 my-1">
      <div className="h-px bg-slate-100" />
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */

export function DashboardSidebar({
  portalLabel,
  navItems,
  sections,

  userName,
  avatarUrl,
  userRole,
  orgName,
  onSignOut,
  open,
  onClose,
}: DashboardSidebarProps) {
  const router = useRouter();
  // Support both sections[] and flat navItems[] for backward compatibility
  const hasSections = sections && sections.length > 0;
  const flatItems = hasSections ? undefined : navItems;

  return (
    <>
      {/* Mobile backdrop with blur */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-[280px] flex flex-col z-40 bg-white border-r border-slate-200',
          'transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'lg:static lg:translate-x-0 lg:shadow-none lg:z-auto lg:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ── Logo Section ──────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src="/Afri%20Connect%20Logo.png"
                alt={APP_NAME}
                className="h-9 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[15px] font-bold tracking-tight text-slate-900 leading-none">
                  {APP_NAME}
                </span>
  
              </div>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
              aria-label="Close sidebar"
            >
              <Icons.close className="size-4" />
            </button>
          </div>

          {/* Org name row */}
          {orgName && (
            <div className="flex items-center gap-2 mt-3 px-1">
              <Icons.building className="size-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate leading-none">
                {orgName}
              </span>
            </div>
          )}
        </div>

        {/* ── Separator ─────────────────────────────────────── */}
        <div className="mx-5 mb-1">
          <div className="h-px bg-slate-100" />
        </div>

        {/* ── Navigation ────────────────────────────────────── */}
        <nav className="flex-grow overflow-y-auto no-scrollbar px-3 pb-2">
          {hasSections ? (
            // Render grouped sections
            sections!.map((section, si) => (
              <div key={si}>
                <SectionLabel label={section.label ?? ''} />
                <div className="space-y-0.5">
                  {section.items.map((item, i) => (
                    <NavItem key={`${si}-${i}`} item={item} />
                  ))}
                </div>
                {si < sections!.length - 1 && <SectionDivider />}
              </div>
            ))
          ) : (
            // Render flat list
            <div className="pt-3 space-y-0.5">
              {flatItems!.map((item, i) => (
                <NavItem key={i} item={item} />
              ))}
            </div>
          )}
        </nav>

        {/* ── User Profile ──────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100">
          <div className="p-3">
            <div className="flex items-center gap-3 p-2 hover:bg-slate-50 transition-all duration-200 cursor-default group/user">
              {/* Avatar */}
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-9 object-cover" />
                ) : (
                  <div className="size-9 bg-[#0b3b24] flex items-center justify-center">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {(userName || 'User')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-500 border-2 border-white" />
              </div>

              {/* User info */}
              <div className="flex-grow min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 leading-none truncate">
                  {userName || 'User'}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
                  {userRole}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover/user:opacity-100 transition-opacity duration-200">
                <button
                  title="Settings"
                  onClick={() => router.push('/settings')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                >
                  <Icons.settings className="size-3.5" />
                </button>
                <button
                  onClick={onSignOut}
                  title="Sign out"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                >
                  <Icons.logOut className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
