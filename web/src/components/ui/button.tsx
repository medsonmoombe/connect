import * as React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'premium';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-green-800 text-white hover:bg-green-700 shadow-md transition-all active:scale-95',
      premium: 'bg-green-900 text-white hover:bg-green-800 shadow-xl border border-green-700/20 transition-all active:scale-95',
      outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all',
      link: 'text-green-700 underline-offset-4 hover:underline transition-all',
    };

    const sizes = {
      default: 'h-11 px-6 text-sm font-semibold',
      sm: 'h-9 px-4 text-xs font-semibold',
      lg: 'h-14 px-10 text-base font-bold',
      icon: 'h-11 w-11',
    };

    const baseClasses = 'inline-flex items-center justify-center rounded-full disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600';

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
