import React from 'react';

const SIZES = {
  xs: 'w-3.5 h-3.5 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4',
};

const VARIANTS = {
  primary: 'border-blue-500/20 border-t-blue-500',
  secondary: 'border-slate-600/30 border-t-slate-200',
  white: 'border-white/20 border-t-white',
  teal: 'border-teal-500/20 border-t-teal-400',
  danger: 'border-rose-500/20 border-t-rose-500',
};

/**
 * Modern circular Spinner component with smooth rotation.
 *
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [props.size='md']
 * @param {'primary' | 'secondary' | 'white' | 'teal' | 'danger'} [props.variant='primary']
 * @param {string} [props.className='']
 * @param {string} [props.label='Loading...']
 */
export const Spinner = ({
  size = 'md',
  variant = 'primary',
  className = '',
  label = 'Loading...',
  ...props
}) => {
  const sizeClass = SIZES[size] || SIZES.md;
  const variantClass = VARIANTS[variant] || VARIANTS.primary;

  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      {...props}
    >
      <div className={`rounded-full animate-spin ${sizeClass} ${variantClass}`} />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
};

export default Spinner;
