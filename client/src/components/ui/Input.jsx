import React, { forwardRef, useId } from 'react';

/**
 * Input component with support for label, error state, and helper text.
 */
export const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      helper,
      id,
      className = '',
      containerClassName = '',
      disabled = false,
      required = false,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const effectiveHelper = helperText || helper;

    const baseInputStyles =
      'w-full px-3.5 py-2 text-sm bg-slate-900/80 border rounded-lg text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-slate-900/40 disabled:cursor-not-allowed';

    const stateStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20';

    return (
      <div className={`w-full flex flex-col space-y-1.5 ${containerClassName}`.trim()}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-slate-300 flex items-center gap-1"
          >
            {label}
            {required && <span className="text-red-400">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          className={`${baseInputStyles} ${stateStyles} ${className}`.trim()}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : effectiveHelper ? `${inputId}-helper` : undefined
          }
          {...props}
        />

        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-400 font-medium mt-1">
            {error}
          </p>
        ) : effectiveHelper ? (
          <p id={`${inputId}-helper`} className="text-xs text-slate-400 mt-1">
            {effectiveHelper}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
