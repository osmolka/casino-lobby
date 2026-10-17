import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  /** Esc, the native close, or a button inside asked to close. */
  onClose: () => void;
  titleId: string;
  /** Focus target after closing when the trigger is gone (e.g. it was replaced). */
  fallbackFocus: () => HTMLElement | null;
  className?: string | undefined;
  children: ReactNode;
}

/**
 * Native modal <dialog> (top layer, inert background, Esc). Adds: a Tab wrap inside the dialog,
 * initial focus on `[data-autofocus]`, and focus return to the trigger or `fallbackFocus`, never body.
 * Children render only while open, so their state resets on every open. Page scroll lock: global.css.
 */
export function Dialog({ open, onClose, titleId, fallbackFocus, className, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const fallbackRef = useRef(fallbackFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    fallbackRef.current = fallbackFocus;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const active = document.activeElement;
    const trigger = active instanceof HTMLElement && active !== document.body ? active : null;

    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Esc fires `cancel`; Chrome may skip it and close directly (close watcher rules), so handle both.
    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    const onNativeClose = () => {
      onCloseRef.current();
    };
    dialog.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);

    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      if (dialog.open) dialog.close();
      // The trigger may be gone or hidden (focus() then silently fails): fall back, never leave focus on body.
      trigger?.focus();
      if (document.activeElement !== trigger) fallbackRef.current()?.focus();
    };
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} aria-modal="true" className={className ? `${styles.dialog} ${className}` : styles.dialog}>
      {open && children}
    </dialog>
  );
}
