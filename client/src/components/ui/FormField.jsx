import React, { forwardRef } from 'react';
import Input from './Input';

/**
 * FormField component integrating the Input component with React Hook Form.
 * Supports passing `register={register}` with `name="fieldName"` or `{...register('fieldName')}`.
 */
export const FormField = forwardRef(
  (
    {
      name,
      label,
      error,
      errors,
      register,
      registration,
      helperText,
      helper,
      required,
      className,
      containerClassName,
      type = 'text',
      ...props
    },
    ref
  ) => {
    // Resolve RHF register props
    const rhfProps = register && name ? register(name) : registration || {};

    // Resolve error string from error prop or RHF errors dictionary
    const resolvedError = error || (errors && name ? errors[name]?.message : undefined);

    return (
      <Input
        ref={(element) => {
          if (typeof ref === 'function') {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
          if (typeof rhfProps.ref === 'function') {
            rhfProps.ref(element);
          }
        }}
        name={name || rhfProps.name}
        label={label}
        error={resolvedError}
        helperText={helperText || helper}
        required={required}
        type={type}
        className={className}
        containerClassName={containerClassName}
        {...rhfProps}
        {...props}
      />
    );
  }
);

FormField.displayName = 'FormField';

export default FormField;
