'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, icon, iconPosition = 'right', ...props }, ref) => {
    return (
      <div className="flex flex-col w-full">
        {label && (
          <label className="text-text text-base font-bold font-mono uppercase tracking-wider pb-2">
            {label}
          </label>
        )}
        <div className="relative flex w-full items-stretch">
          {icon && iconPosition === 'left' && (
            <div className="text-accent absolute left-4 top-1/2 -translate-y-1/2">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full border-2 bg-surface text-text font-mono
              h-14 px-4 text-base
              placeholder:text-accent/60
              focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
              transition-colors
              ${error ? 'border-secondary' : 'border-text'}
              ${icon && iconPosition === 'left' ? 'pl-12' : ''}
              ${icon && iconPosition === 'right' ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="text-accent absolute right-4 top-1/2 -translate-y-1/2">
              {icon}
            </div>
          )}
        </div>
        {error && <p className="text-secondary text-xs mt-2 font-mono">{error}</p>}
        {hint && !error && <p className="text-accent text-xs mt-2 font-mono">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
