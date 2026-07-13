import { type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon: Icon, iconClassName = 'text-green-700', title, description, actions }: PageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            {Icon && <Icon className={`size-7 sm:size-8 shrink-0 ${iconClassName}`} />}
            {title}
          </h2>
        </div>
          {description && (
            <p className="text-slate-500 pb-4 text-sm mt-1">{description}</p>
          )}
        {actions && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
