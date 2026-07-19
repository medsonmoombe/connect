'use client';

import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Engagement } from '@/types';
import { getStateLabel } from '@/lib/engagement';
import { cn } from '@/lib/utils';

interface MessagesTabProps {
  engagements: Engagement[];
  loading: boolean;
  unreadByEngagement?: Record<string, number>;
}

export function MessagesTab({ engagements, loading, unreadByEngagement }: MessagesTabProps) {
  // Order conversations by most-recent activity — newest first.
  const ordered = [...engagements].sort((a, b) =>
    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  );

  return (
    <div className="bg-white border border-gray-100 rounded-[32px] shadow-soft overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{engagements.length} Active Conversations</span>
      </div>
      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 text-center">
            <Icons.spinner className="size-5 animate-spin mx-auto text-primary" />
          </div>
        ) : ordered.length > 0 ? (
          ordered.map(eng => {
            const lastMessage = eng.messages?.length ? eng.messages[eng.messages.length - 1] : null;
            const unread = unreadByEngagement?.[eng.id] ?? 0;
            return (
              <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                <div className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-6">
                  <div className="size-10 rounded-xl bg-gray-50 flex items-center justify-center text-slate-400 shrink-0 border border-gray-100">
                    <Icons.messageSquare className="size-5" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                        {eng.project?.name}
                        {unread > 0 && (
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 ml-3">
                        {new Date(eng.updated_at || eng.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={cn(
                      'text-xs font-medium truncate',
                      unread > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500'
                    )}>
                      {lastMessage ? lastMessage.message_body : getStateLabel(eng.status as any)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="p-12 text-center text-sm text-slate-400 italic">No active conversations.</div>
        )}
      </div>
    </div>
  );
}
