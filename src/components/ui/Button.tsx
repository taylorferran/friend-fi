'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2 font-bold font-mono uppercase tracking-wider
      border-2 border-text
      transition-all duration-200 
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
    `;
    
    const variants = {
      primary: `
        bg-primary text-text border-text
        shadow-[4px_4px_0_theme(colors.text)]
        hover:shadow-[2px_2px_0_theme(colors.text)] hover:translate-x-[2px] hover:translate-y-[2px]
        active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
        focus:ring-primary
      `,
      secondary: `
        bg-surface text-text border-text
        shadow-[4px_4px_0_theme(colors.text)]
        hover:shadow-[2px_2px_0_theme(colors.text)] hover:translate-x-[2px] hover:translate-y-[2px]
        hover:bg-primary/20
        active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
        focus:ring-primary
      `,
      ghost: `
        bg-transparent text-text border-transparent shadow-none
        hover:bg-primary/20 hover:border-text
      `,
      danger: `
        bg-secondary text-white border-text
        shadow-[4px_4px_0_theme(colors.text)]
        hover:shadow-[2px_2px_0_theme(colors.text)] hover:translate-x-[2px] hover:translate-y-[2px]
        active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
        focus:ring-secondary
      `,
    };

    const sizes = {
      sm: 'h-9 px-4 text-xs',
      md: 'h-12 px-6 text-sm',
      lg: 'h-14 px-8 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
