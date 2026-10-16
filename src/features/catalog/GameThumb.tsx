import type { CSSProperties } from 'react';
import { THUMB_VIEWBOX, thumbnailSpec, type ThumbShape } from './thumbnail';
import styles from './GameCard.module.css';

function Shape({ shape: { kind, x, y, size, opacity } }: { shape: ThumbShape }) {
  const r = size / 2;
  if (kind === 'ring') {
    return <circle cx={x} cy={y} r={r} fill="none" stroke="#fff" strokeWidth={4} opacity={opacity} />;
  }
  if (kind === 'diamond') {
    return (
      <rect x={x - r} y={y - r} width={size} height={size} transform={`rotate(45 ${x} ${y})`} fill="#fff" opacity={opacity} />
    );
  }
  return <circle cx={x} cy={y} r={r} fill="#fff" opacity={opacity} />;
}

/** Decorative: gradient via CSS variables (no SVG ids, so nothing can collide across cards). */
export function GameThumb({ id, hue }: { id: string; hue: number }) {
  const spec = thumbnailSpec(id, hue);
  const style = {
    '--hue-a': spec.hueA,
    '--hue-b': spec.hueB,
    '--angle': `${spec.angle}deg`,
  } as CSSProperties;
  return (
    <span className={styles.thumb} style={style} aria-hidden="true">
      <svg
        viewBox={`0 0 ${THUMB_VIEWBOX.width} ${THUMB_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {spec.shapes.map((shape, i) => (
          <Shape key={i} shape={shape} />
        ))}
      </svg>
    </span>
  );
}
