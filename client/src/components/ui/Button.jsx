import React, { forwardRef } from 'react';

/**
 * Button component supporting multiple variants and sizes.
 * Variants: primary, secondary, ghost, danger
 * Sizes: sm, md, lg
 */
export const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variants = {
      primary:
        'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm focus-visible:ring-blue-500 focus-visible:ring-offset-slate-900',
      secondary:
        'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 focus-visible:ring-slate-500 focus-visible:ring-offset-slate-900',
      ghost:
        'bg-transparent hover:bg-slate-800/80 active:bg-slate-800 text-slate-300 hover:text-white focus-visible:ring-slate-500 focus-visible:ring-offset-slate-900',
      danger:
        'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-sm focus-visible:ring-red-500 focus-visible:ring-offset-slate-900',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 rounded-md gap-1.5',
      md: 'text-sm px-4 py-2 rounded-lg gap-2',
      lg: 'text-base px-6 py-2.5 rounded-xl gap-2.5',
    };

    const variantClass = variants[variant] || variants.primary;
    const sizeClass = sizes[size] || sizes.md;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`.trim()}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
