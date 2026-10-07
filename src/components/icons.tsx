import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function CursorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 3l6 16 2.2-6.2L19 10.6 5 3z" />
    </svg>
  );
}

export function TrendLineIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 18L20 5" />
      <circle cx="4" cy="18" r="2" />
      <circle cx="20" cy="5" r="2" />
    </svg>
  );
}

export function RectangleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
    </svg>
  );
}

export function RulerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12l9-9 9 9-9 9-9-9z" />
      <path d="M8 8l2 2M11 11l2 2M14 14l2 2" />
    </svg>
  );
}

export function LongIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17h16" />
      <path d="M4 7h16" />
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M12 14V9" />
      <path d="M9.5 11.5L12 9l2.5 2.5" />
    </svg>
  );
}

export function ShortIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17h16" />
      <path d="M4 7h16" />
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M12 9v5" />
      <path d="M9.5 11.5L12 14l2.5-2.5" />
    </svg>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 7H15a5 5 0 010 10H8" />
      <path d="M9 7l-3 3 3 3" />
    </svg>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 7H9a5 5 0 000 10h7" />
      <path d="M15 7l3 3-3 3" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 12h8l1-12" />
    </svg>
  );
}

export function EraserIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15l7-7 5 5-7 7H6l-2-2z" />
      <path d="M11 8l3-3 5 5-3 3" />
    </svg>
  );
}

export function IndicatorsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15l4-6 3 3 4-7 5 10" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function ReplayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8 8 0 019.5 4a7 7 0 108.5 10.5z" />
    </svg>
  );
}

export function CandleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4v16M7 8h0M5 8h4v6H5zM17 4v16M15 10h4v5h-4z" />
    </svg>
  );
}

export function BarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4v16M7 7v9" />
      <path d="M5 7h1.5M7.5 10H9M7.5 13H9M5 13h1.5" />
      <path d="M17 4v16M15 6h1.5M17.5 9H19M17.5 12H19M15 12h1.5" />
    </svg>
  );
}

export function LineIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17l5-6 4 3 7-8" />
    </svg>
  );
}

export function AreaIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="none">
      <path d="M4 17l5-6 4 3 7-8" />
      <path d="M4 17l5-6 4 3 7-8v11H4z" fill="currentColor" opacity="0.18" stroke="none" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
