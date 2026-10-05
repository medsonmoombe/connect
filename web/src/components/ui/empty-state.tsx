'use client';

import { Icons } from './icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateProps {
  icon: keyof typeof Icons;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  const Icon = Icons[icon];

  return (
    <div className="py-8 px-6 text-center bg-white rounded-none border border-dashed border-slate-200">
      <div className="size-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300 border border-slate-100">
        <Icon className="size-5" />
      </div>
      <h3 className="text-sm font-bold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto leading-relaxed">{description}</p>

      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
            <Button className="h-8 px-3 text-xs" icon={<Icons.plus className="size-3" />}>
              {actionLabel}
            </Button>
          </Link>
        ) : (
          <Button className="h-8 px-3 text-xs" icon={<Icons.plus className="size-3" />} onClick={onAction}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
