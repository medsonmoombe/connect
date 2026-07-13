'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { Drawer } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

interface DashboardNavbarProps {
  title: string;
  onMenuClick: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    admin: 'Admin',
    developer: 'Developer',
    investor: 'Investor',
    technical: 'Technical',
    submit: 'Submit Project',
    engagements: 'Engagements',
    projects: 'Projects',
    companies: 'Companies',
    users: 'Users',
    settings: 'Settings',
    verification: 'Verification',
    'ai-overview': 'AI Overview',
  };

  return segments.map((seg, i) => ({
    label: labels[seg] ?? (seg.length === 36 ? 'Detail' : seg.charAt(0).toUpperCase() + seg.slice(1)),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));
}

export function DashboardNavbar({ title, onMenuClick }: DashboardNavbarProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const breadcrumbs = useBreadcrumbs();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleMarkAllRead = () => {
    markAllRead();
    setNotifOpen(false);
  };

  const handleNotifClick = (notif: typeof notifications[0]) => {
    markRead([notif.id]);
    if (notif.action_url) {
      setNotifOpen(false);
      router.push(notif.action_url);
    }
  };

  return (
    <header className="h-14 navbar-bg navbar-border flex items-center justify-between px-4 lg:px-5 shrink-0 z-20 gap-3">
      {/* ── Left: hamburger + breadcrumb ──────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden navbar-btn size-9 shrink-0"
          aria-label="Open menu"
        >
          <svg className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb — desktop */}
        <nav className="hidden md:flex items-center gap-0 text-[13px] min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center min-w-0">
              {i > 0 && (
                <Icons.chevronRight className="size-3 text-slate-300 shrink-0 mx-1" />
              )}
              {crumb.isLast ? (
                <span className="font-semibold text-slate-900 truncate">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-400 font-medium hover:text-slate-600 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Mobile title */}
        <span className="md:hidden text-[13px] font-semibold text-slate-900 truncate">{title}</span>
      </div>

      {/* ── Right: search, notifications, profile ────────── */}
      <div className="flex items-center gap-1.5 shrink-0">

        {/* Search */}
        <div className="relative">
          {searchOpen ? (
            <div className="flex items-center gap-2 navbar-search-expanded rounded-xl px-3 h-9 w-52 lg:w-64">
              <Icons.search className="size-4 text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search projects, partners..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                className="bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 outline-none flex-grow min-w-0"
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Icons.close className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="navbar-btn size-9 gap-1.5 px-0"
              aria-label="Search"
            >
              <Icons.search className="size-[18px]" />
            </button>
          )}
        </div>

        {/* Notifications */}
        <button
          onClick={() => { setNotifOpen(true); setProfileOpen(false); }}
          className="navbar-btn size-9 relative"
          aria-label="Notifications"
        >
          <Icons.zap className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full navbar-notif-badge" />
          )}
        </button>

        <Drawer
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          size="md"
        >
          {/* Mark all read */}
          {unreadCount > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-primary uppercase tracking-[0.1em] hover:text-primary/80"
              >
                Mark all read
              </button>
            </div>
          )}

          {/* Notification items */}
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Icons.zap className="size-8 text-slate-200 mx-auto mb-3" />
                <p className="text-[13px] font-medium text-slate-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={cn(
                    'p-3.5 rounded-xl flex gap-3 cursor-pointer border',
                    n.read
                      ? 'bg-white border-slate-100 hover:bg-slate-50/80'
                      : 'bg-primary/[0.03] border-primary/10'
                  )}
                >
                  <div className={cn(
                    'size-2 rounded-full mt-1.5 shrink-0',
                    n.read ? 'bg-slate-200' : 'bg-primary'
                  )} />
                  <div className="flex-grow min-w-0">
                    <p className={cn(
                      'text-[13px] leading-snug',
                      n.read ? 'font-medium text-slate-600' : 'font-semibold text-slate-900'
                    )}>
                      {n.title}
                    </p>
                    <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-1.5">
                      {formatTimeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-primary">
              View all activity
            </button>
          </div>
        </Drawer>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200/80 mx-1" />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
            className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-slate-50"
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="navbar-avatar size-8 rounded-lg flex items-center justify-center">
                <span className="text-[11px] font-bold text-white tracking-wide">
                  {(user?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-500 border-2 border-white" />
            </div>
            {/* Info — desktop only */}
            <div className="hidden lg:block text-left">
              <p className="text-[13px] font-semibold text-slate-900 leading-none">
                {user?.full_name?.split(' ')[0] || 'User'}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">
                {user?.role?.replace('_', ' ') || 'Member'}
              </p>
            </div>
            <Icons.chevronDown className="hidden lg:block size-3.5 text-slate-400 ml-0.5" />
          </button>

          {profileOpen && (
            <div className="navbar-dropdown absolute right-0 top-full mt-2 w-56 overflow-hidden z-50">
              {/* User card */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="navbar-avatar size-9 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-white tracking-wide">
                      {(user?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{user?.full_name || 'User'}</p>
                    <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{user?.email}</p>
                  </div>
                </div>
              </div>
              {/* Menu items */}
              <div className="py-1.5 px-1.5">
                <button
                  onClick={() => { setProfileOpen(false); router.push('/dashboard'); }}
                  className="navbar-menu-item w-full"
                >
                  <span className="flex items-center justify-center size-7 rounded-lg bg-slate-100 shrink-0">
                    <Icons.user className="size-3.5 text-slate-500" />
                  </span>
                  My Profile
                </button>
                <button
                  onClick={() => { setProfileOpen(false); router.push('/dashboard/admin/settings'); }}
                  className="navbar-menu-item w-full"
                >
                  <span className="flex items-center justify-center size-7 rounded-lg bg-slate-100 shrink-0">
                    <Icons.settings className="size-3.5 text-slate-500" />
                  </span>
                  Settings
                </button>
              </div>
              {/* Sign out */}
              <div className="border-t border-slate-100 py-1.5 px-1.5">
                <button
                  onClick={() => { setProfileOpen(false); signOut(); }}
                  className="navbar-menu-item w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <span className="flex items-center justify-center size-7 rounded-lg bg-red-50 shrink-0">
                    <Icons.logOut className="size-3.5 text-red-500" />
                  </span>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
