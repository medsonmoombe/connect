import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { ReviewRecommendation } from '@/lib/review-intelligence';

const TONE_STYLES: Record<ReviewRecommendation['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
};

export function ReviewRecommendationCard({ recommendation }: { recommendation: ReviewRecommendation }) {
  return (
    <div className={cn('rounded-xl border p-3', TONE_STYLES[recommendation.tone])}>
      <div className="flex items-start gap-2.5">
        <Icons.zap className="size-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest">{recommendation.title}</p>
          <p className="text-xs font-semibold leading-relaxed mt-1">{recommendation.message}</p>
        </div>
      </div>
    </div>
  );
}
