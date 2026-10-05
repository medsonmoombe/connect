'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

type Decision = 'under_review' | 'approve' | 'return';

interface ReviewPanelProps {
  projectId: string;
  projectStatus: string;
  onDecision: (newStatus: string) => void;
}

// All three decisions are available from any reviewable status.
// Reviewers can approve, decline, or flag for further review directly.
const REVIEWABLE_STATUSES = ['scoring', 'scoring_retry', 'under_review', 'pending_live'];

const DECISIONS: {
  id: Decision;
  label: string;
  description: string;
  icon: keyof typeof Icons;
  cardStyle: string;
  btnStyle: string;
  requiresComment: boolean;
}[] = [
  {
    id: 'approve',
    label: 'Approve',
    description: 'Project passes review and goes live immediately, visible to investors and partners.',
    icon: 'checkCircle2',
    cardStyle: 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-400',
    btnStyle: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    requiresComment: false,
  },
  {
    id: 'return',
    label: 'Decline / Return',
    description: 'Return the project to the developer with feedback. They can address issues and resubmit.',
    icon: 'refreshCw',
    cardStyle: 'border-rose-200 bg-rose-50/60 hover:border-rose-400',
    btnStyle: 'bg-rose-600 hover:bg-rose-700 text-white',
    requiresComment: true,
  },
  {
    id: 'under_review',
    label: 'Put Under Review',
    description: 'Flag for further deliberation. The developer is notified their project is being assessed.',
    icon: 'eye',
    cardStyle: 'border-blue-200 bg-blue-50/60 hover:border-blue-400',
    btnStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
    requiresComment: false,
  },
];

export function ReviewPanel({ projectId, projectStatus, onDecision }: ReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Decision | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    if (busy) return;
    setOpen(false);
    setSelected(null);
    setComment('');
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const action = DECISIONS.find(d => d.id === selected)!;
    if (action.requiresComment && !comment.trim()) {
      toast.error('Feedback is required when declining / returning a project.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/authority/projects/${projectId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: selected, reason: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Decision failed');
      const labels: Record<Decision, string> = {
        under_review: 'Project placed under review — developer notified.',
        approve: 'Project approved and is now live.',
        return: 'Project returned to developer with your feedback.',
      };
      toast.success(labels[selected]);
      handleClose();
      onDecision(json.data?.status ?? selected);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  // Approved — no further action possible
  if (projectStatus === 'live') {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-sm">
        <Icons.checkCircle2 className="size-4 shrink-0" />
        Approved — project is live
      </div>
    );
  }

  // Returned — locked until developer resubmits
  if (projectStatus === 'draft') {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 border border-amber-200 bg-amber-50 text-amber-700 font-bold text-sm">
        <Icons.clock className="size-4 shrink-0" />
        Awaiting developer resubmission
      </div>
    );
  }

  // Not a reviewable status (e.g. deactivated, archived)
  if (!REVIEWABLE_STATUSES.includes(projectStatus)) return null;

  const selectedAction = DECISIONS.find(d => d.id === selected);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-900/20 flex items-center gap-2"
      >
        <Icons.shieldCheck className="size-4" />
        Provide Review Decision
      </Button>

      <Drawer
        open={open}
        onClose={handleClose}
        title="Review Decision"
        description="Select an action and optionally add a comment for the developer."
        size="md"
      >
        <div className="space-y-5">

          <div className="space-y-3">
            {DECISIONS.map(action => {
              const Icon = Icons[action.icon];
              const isSelected = selected === action.id;
              return (
                <button
                  key={action.id}
                  onClick={() => setSelected(isSelected ? null : action.id)}
                  className={cn(
                    'w-full flex items-start gap-4 p-4 border-2 text-left transition-all',
                    isSelected ? action.cardStyle + ' border-current' : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className={cn(
                    'size-9 flex items-center justify-center shrink-0',
                    isSelected
                      ? action.id === 'under_review' ? 'bg-blue-100' : action.id === 'approve' ? 'bg-emerald-100' : 'bg-rose-100'
                      : 'bg-slate-100'
                  )}>
                    <Icon className={cn(
                      'size-4',
                      isSelected
                        ? action.id === 'under_review' ? 'text-blue-600' : action.id === 'approve' ? 'text-emerald-600' : 'text-rose-600'
                        : 'text-slate-500'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold', isSelected ? 'text-slate-900' : 'text-slate-700')}>
                      {action.label}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                  <div className={cn(
                    'size-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all',
                    isSelected
                      ? action.id === 'under_review' ? 'border-blue-500 bg-blue-500' : action.id === 'approve' ? 'border-emerald-500 bg-emerald-500' : 'border-rose-500 bg-rose-500'
                      : 'border-slate-300'
                  )}>
                    {isSelected && <Icons.check className="size-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {selectedAction?.requiresComment ? 'Feedback for developer (required)' : 'Comment for developer (optional)'}
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                placeholder={
                  selected === 'approve'
                    ? 'Optional congratulatory note or instructions...'
                    : selected === 'under_review'
                    ? 'Optional note about what you are reviewing...'
                    : 'Explain what needs to be fixed before the developer can resubmit...'
                }
                className="w-full px-4 py-3 border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]/40 resize-none transition-all"
              />
              {selectedAction?.requiresComment && !comment.trim() && (
                <p className="text-[11px] text-rose-500 font-medium">Feedback is required for this action.</p>
              )}
            </div>
          )}

          {selected && <div className="border-t border-slate-100" />}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 border-slate-200 font-bold text-sm"
              onClick={handleClose}
              disabled={busy}
            >
              Cancel
            </Button>
            {selected && (
              <Button
                onClick={handleSubmit}
                disabled={busy || (selectedAction?.requiresComment && !comment.trim())}
                className={cn('flex-1 h-11 font-bold text-sm', selectedAction?.btnStyle)}
              >
                {busy
                  ? <><Icons.spinner className="size-4 animate-spin mr-2" />Processing...</>
                  : selected === 'approve'
                  ? <><Icons.checkCircle2 className="size-4 mr-2" />Approve</>
                  : selected === 'under_review'
                  ? <><Icons.eye className="size-4 mr-2" />Under Review</>
                  : <><Icons.refreshCw className="size-4 mr-2" />Return</>
                }
              </Button>
            )}
          </div>

        </div>
      </Drawer>
    </>
  );
}
