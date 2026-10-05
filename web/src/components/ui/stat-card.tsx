import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  trend?: { label: string; positive?: boolean };
}

export function StatCard({
  label,
  value,
  valueClassName = 'text-slate-900',
  icon: Icon,
  iconClassName = 'text-slate-400',
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white p-4 rounded-none border border-slate-200 shadow-sm flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          {label}
        </span>
        <span className={`text-lg font-extrabold block mt-0.5 ${valueClassName}`}>
          {value}
        </span>
        {trend && (
          <span className={`text-[10px] font-semibold mt-1 block ${
            trend.positive === true  ? 'text-green-600' :
            trend.positive === false ? 'text-red-500'   : 'text-slate-400'
          }`}>
            {trend.label}
          </span>
        )}
      </div>
      {Icon && (
        <div className="shrink-0 p-2 bg-slate-50 rounded-none">
          <Icon className={`size-4 ${iconClassName}`} />
        </div>
      )}
    </div>
  );
}
