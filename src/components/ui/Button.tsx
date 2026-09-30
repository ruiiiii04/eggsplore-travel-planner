'use client';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth = true,
      loading = false,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        'bg-primary-600 text-text-onPrimary shadow-button hover:bg-primary-700',

      secondary:
        'bg-surface-muted text-text-primary hover:bg-primary-100',

      outline:
        'border border-surface-border bg-transparent text-primary-600 hover:bg-primary-50',

      ghost:
        'bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary',
    };

    const sizes = {
      sm: 'min-h-9 px-4 py-2 text-xs font-semibold',

      md: 'min-h-11 px-5 py-3 text-sm font-semibold',

      lg: 'min-h-12 px-6 py-3.5 text-base font-bold',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-primary-400 focus-visible:ring-offset-2',
          'active:scale-[0.98]',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden="true"
          />
        )}

        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';