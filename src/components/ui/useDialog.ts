import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Keeps Tab inside and stops the page behind from scrolling. */
  isModal: boolean;
}

/** Moves focus in on open and back on close, and closes on Esc. */
export function useDialog(ref: RefObject<HTMLElement>, { isOpen, onClose, isModal }: DialogOptions) {
  // Read through a ref so a new onClose on re-render can't re-run the focus effect
  // and pull focus out of whichever field the user is typing in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog)?.focus();

    return () => previouslyFocused?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      const dialog = ref.current;
      if (!isModal || e.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (isModal) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (isModal) document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isModal]);
}
