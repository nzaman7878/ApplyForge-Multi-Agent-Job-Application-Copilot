import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

/**
 * useFocusTrap hook
 * Traps keyboard focus within an active modal container and handles Escape key dismissal.
 *
 * @param {boolean} isActive - Whether the trap is currently active (e.g. modal is open)
 * @param {Object} options - Configuration options
 * @param {Function} options.onEscape - Callback executed when the Escape key is pressed
 * @param {boolean} options.returnFocus - Whether to restore focus to trigger element on deactivation (default true)
 * @param {React.RefObject} options.initialFocusRef - Element to focus on activation (defaults to first focusable)
 * @returns {React.RefObject} Ref to attach to the modal container element
 */
export function useFocusTrap(isActive, options = {}) {
  const { onEscape, returnFocus = true, initialFocusRef } = options;
  const containerRef = useRef(null);
  const triggerElementRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    // Save currently active element to return focus when closed
    triggerElementRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Helper to query all visible, enabled focusable elements
    const getFocusableElements = () => {
      const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
      return elements.filter(
        (el) => el.offsetParent !== null && !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    // Focus initial element or first focusable
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          container.focus();
        }
      }
    }, 20);

    // Keydown listener for Tab and Escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (typeof onEscape === 'function') {
          e.preventDefault();
          e.stopPropagation();
          onEscape();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: if on first element, wrap to last
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);

      if (returnFocus && triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      }
    };
  }, [isActive, onEscape, returnFocus, initialFocusRef]);

  return containerRef;
}

export default useFocusTrap;
