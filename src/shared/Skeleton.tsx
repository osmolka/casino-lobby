import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface Props {
  inlineSize?: CSSProperties['inlineSize'];
  blockSize?: CSSProperties['blockSize'];
  className?: string | undefined;
}

/** Decorative placeholder. The surrounding region carries aria-busy and an accessible label. */
export function Skeleton({ inlineSize = '100%', blockSize = '1rem', className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={className ? `${styles.skeleton} ${className}` : styles.skeleton}
      style={{ inlineSize, blockSize }}
    />
  );
}
