import type { SelectHTMLAttributes } from 'react';
import { ChevronDownIcon } from './icons';
import styles from './Select.module.css';

/**
 * Native <select> without the browser arrow (its inline-end offset ignores padding and differs per
 * browser), with our chevron at the same spot as on the balance button. The chevron ignores the pointer,
 * so clicking it opens the select.
 */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={styles.wrap}>
      <select {...props} className={className ? `${styles.select} ${className}` : styles.select} />
      <ChevronDownIcon className={styles.chevron} />
    </span>
  );
}
