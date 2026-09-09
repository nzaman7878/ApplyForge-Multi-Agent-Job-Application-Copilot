import { useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Default styling presets matching ApplyForge's dark aesthetic.
 */
export const defaultToastOptions = {
  style: {
    background: '#0f172a', // slate-900
    color: '#f8fafc', // slate-50
    border: '1px solid #1e293b', // slate-800
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
  },
  duration: 4000,
};

/**
 * Custom hook providing standardized toast notification helpers.
 *
 * @returns {Object} Toast action methods (success, error, info, loading, promise, dismiss, custom)
 */
export const useToast = () => {
  const showSuccess = useCallback((message, options = {}) => {
    return toast.success(message, {
      ...defaultToastOptions,
      iconTheme: {
        primary: '#10b981',
        secondary: '#0f172a',
      },
      ...options,
    });
  }, []);

  const showError = useCallback((message, options = {}) => {
    return toast.error(message, {
      ...defaultToastOptions,
      iconTheme: {
        primary: '#f43f5e',
        secondary: '#0f172a',
      },
      ...options,
    });
  }, []);

  const showInfo = useCallback((message, options = {}) => {
    return toast(message, {
      ...defaultToastOptions,
      icon: 'ℹ️',
      ...options,
    });
  }, []);

  const showLoading = useCallback((message, options = {}) => {
    return toast.loading(message, {
      ...defaultToastOptions,
      ...options,
    });
  }, []);

  const showPromise = useCallback((promise, messages, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Processing...',
        success: messages.success || 'Success!',
        error: messages.error || 'Something went wrong.',
      },
      {
        ...defaultToastOptions,
        ...options,
      }
    );
  }, []);

  const dismiss = useCallback((toastId) => {
    toast.dismiss(toastId);
  }, []);

  const custom = useCallback((render, options = {}) => {
    return toast.custom(render, options);
  }, []);

  return {
    success: showSuccess,
    error: showError,
    info: showInfo,
    loading: showLoading,
    promise: showPromise,
    dismiss,
    custom,
    toast,
  };
};

// Also export the raw toast instance with the same convenience methods attached
export { toast };
export default useToast;
