'use client';

import { useState, useCallback } from 'react';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type ProjectReview = {
  id: string;
  project_id: string;
  reviewer_id: string | null;
  decision: 'APPROVE' | 'RETURN' | 'UNDER_REVIEW';
  comments: string | null;
  from_status: string;
  to_status: string;
  created_at: string;
  reviewer?: { full_name: string | null; email: string | null } | null;
};

type Props = {
  projectId: string;
  /** When true, renders without its own card border (for embedding inside a SectionCard). */
  embedded?: boolean;
  className?: string;
};

export function ReviewHistory({ projectId, embedded, className }: Props) {
  const [reviews, setReviews] = useState<ProjectReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (reviews.length > 0) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reviews`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load review history');
      setReviews(json.data ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, reviews.length]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const cardCls = embedded ? '' : 'border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]';

  return (
    <div className={cn(cardCls, 'overflow-hidden', className)}>
      {/* Accordion trigger */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-full px-5 py-3 flex items-center gap-2 transition-colors',
          embedded ? 'border-t border-slate-100 hover:bg-slate-50' : 'bg-[#0b3b24] hover:bg-[#0d4a2e]',
        )}
      >
        <Icons.history className={cn('size-3.5', embedded ? 'text-slate-500' : 'text-emerald-200')} />
        <p className={cn('text-[10px] font-bold uppercase tracking-widest', embedded ? 'text-slate-500' : 'text-emerald-200/60')}>Review History</p>
        {!loading && reviews.length > 0 && (
          <span className={cn('text-[10px] font-bold tracking-widest', embedded ? 'text-slate-400' : 'text-emerald-200/70')}>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto">
          {loading
            ? <Icons.spinner className={cn('size-3.5 animate-spin', embedded ? 'text-slate-400' : 'text-emerald-200/60')} />
            : <Icons.chevronDown className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180', embedded ? 'text-slate-400' : 'text-emerald-200/60')} />
          }
        </span>
      </button>

      {/* Accordion body */}
      {open && !loading && (
        <div className="divide-y divide-slate-100">
          {reviews.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500">No reviews yet. This project is awaiting its first review.</p>
            </div>
          ) : reviews.map((r) => {
          const isApprove = r.decision === 'APPROVE';
          const isUnderReview = r.decision === 'UNDER_REVIEW';
          return (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'size-9 rounded-none flex items-center justify-center shrink-0',
                    isApprove ? 'bg-emerald-50 border border-emerald-200'
                    : isUnderReview ? 'bg-blue-50 border border-blue-200'
                    : 'bg-rose-50 border border-rose-200',
                  )}
                >
                  {isApprove ? (
                    <Icons.checkCircle2 className="size-4 text-emerald-600" />
                  ) : isUnderReview ? (
                    <Icons.search className="size-4 text-blue-600" />
                  ) : (
                    <Icons.x className="size-4 text-rose-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                        isApprove
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isUnderReview
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200',
                      )}
                    >
                      {isApprove ? 'Approved' : isUnderReview ? 'Under Review' : 'Returned'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {r.from_status?.replace(/_/g, ' ')} → {r.to_status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-1.5">
                    {r.reviewer?.full_name || r.reviewer?.email || 'Reviewer'}
                  </p>
                  {r.comments && (
                    <div className="mt-2 p-3 rounded-none bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Comments</p>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{r.comments}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
