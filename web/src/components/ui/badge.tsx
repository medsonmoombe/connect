export type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'slate' | 'orange';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  green:  'bg-green-50  text-green-700  border-green-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  red:    'bg-red-50    text-red-700    border-red-100',
  blue:   'bg-blue-50   text-blue-700   border-blue-100',
  slate:  'bg-slate-100 text-slate-600  border-slate-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full border
      text-[10px] font-bold uppercase tracking-wide
      ${variantClasses[variant]} ${className}
    `}>
      {children}
    </span>
  );
}
