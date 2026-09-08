import React, { forwardRef } from 'react';

/**
 * Card root container component.
 */
export const Card = forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`bg-slate-800/60 border border-slate-700/80 rounded-xl shadow-lg backdrop-blur-sm text-slate-100 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

/**
 * CardHeader component.
 */
export const CardHeader = forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <div ref={ref} className={`p-6 pb-3 flex flex-col space-y-1.5 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});

CardHeader.displayName = 'CardHeader';

/**
 * CardTitle component.
 */
export const CardTitle = forwardRef(
  ({ className = '', as: Component = 'h3', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={`text-xl font-semibold leading-tight tracking-tight text-white ${className}`.trim()}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = 'CardTitle';

/**
 * CardDescription component.
 */
export const CardDescription = forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={`text-sm text-slate-400 leading-relaxed ${className}`.trim()}
      {...props}
    >
      {children}
    </p>
  );
});

CardDescription.displayName = 'CardDescription';

/**
 * CardContent component.
 */
export const CardContent = forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <div ref={ref} className={`p-6 pt-3 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});

CardContent.displayName = 'CardContent';

/**
 * CardFooter component.
 */
export const CardFooter = forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <div ref={ref} className={`p-6 pt-0 flex items-center gap-3 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;
