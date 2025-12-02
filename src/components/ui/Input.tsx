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
          <label className="text-white text-base font-medium leading-normal pb-2">
            {label}
          </label>
        )}
        <div className="relative flex w-full items-stretch">
          {icon && iconPosition === 'left' && (
            <div className="text-[#ad92c9] absolute left-4 top-1/2 -translate-y-1/2">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-lg border bg-[#261933] text-white
              h-14 px-4 text-base font-normal
              placeholder:text-[#ad92c9]/60
              focus:outline-none focus:ring-2 focus:ring-[#7311d4]/50 focus:border-[#7311d4]
              transition-colors
              ${error ? 'border-red-500' : 'border-[#4d3267]'}
              ${icon && iconPosition === 'left' ? 'pl-12' : ''}
              ${icon && iconPosition === 'right' ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="text-[#ad92c9] absolute right-4 top-1/2 -translate-y-1/2">
              {icon}
            </div>
          )}
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        {hint && !error && <p className="text-white/40 text-xs mt-2">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

