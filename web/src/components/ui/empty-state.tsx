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
    <div className="p-16 text-center bg-surface rounded-[40px] border border-dashed border-slate-200 animate-in fade-in zoom-in-95 duration-500">
      <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-300 shadow-inner">
        <Icon className="size-10" />
      </div>
      <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{title}</h3>
      <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed font-medium">{description}</p>
      
      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
             <Button className="h-9 px-4 rounded-xl" icon={<Icons.plus />}>
                      {actionLabel}
                      </Button>
          </Link>
        ) : (

                    <Button className="h-9 px-4 rounded-xl" icon={<Icons.plus />}>
                      {actionLabel}
                      </Button>
        )
      )}
    </div>
  );
}
