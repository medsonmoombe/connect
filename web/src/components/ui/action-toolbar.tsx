import { type LucideIcon } from 'lucide-react';

export interface ToolbarAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
}

interface ActionToolbarProps {
  actions: ToolbarAction[];
}

export function ActionToolbar({ actions }: ActionToolbarProps) {
  const visible = actions.filter(a => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center divide-x divide-slate-200 border border-slate-200 rounded-none bg-white shadow-sm overflow-hidden">
      {visible.map(({ key, label, icon: Icon, onClick, disabled, loading }) => (
        <button
          key={key}
          onClick={onClick}
          disabled={disabled || loading}
          className="flex items-center gap-2 px-4 h-9 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {loading
            ? <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            : <Icon className="size-4" />}
          {label}
        </button>
      ))}
    </div>
  );
}
