import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} width={16} height={16} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} width={14} height={14} strokeWidth={3} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Media control: not mirrored under RTL (by convention). */
export function PauseIcon(props: IconProps) {
  return (
    <svg {...base} width={16} height={16} {...props}>
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}

/** Media control: not mirrored under RTL (by convention). */
export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} width={16} height={16} {...props}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <svg {...base} width={28} height={28} viewBox="0 0 32 32" stroke="none" {...props}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M16 6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L16 20.8l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="var(--accent-fg)" />
    </svg>
  );
}
