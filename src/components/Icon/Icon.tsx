import type { SVGProps } from 'react';

/**
 * Shared inline SVG icon set. All icons take standard SVG props and inherit
 * stroke/fill from `currentColor`, so they recolor with `text-*` utilities.
 *
 * Default `strokeWidth={1.75}` matches the slightly chunky line weight from
 * the mockups. Override per-instance with `strokeWidth={...}` if needed.
 */

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function svgProps({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

export function IconPlane(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M17.8 19.2 16 11l3.5-3.5a2.121 2.121 0 0 0-3-3L13 8 4.8 6.2c-.5-.1-.9.2-.9.7v.6c0 .2.1.4.3.5L9 11l-2 2H4l-1 1 4 1 1 4 1-1v-3l2-2 3.5 4.8c.1.2.3.3.5.3h.6c.5 0 .8-.4.7-.9z" />
    </svg>
  );
}

export function IconBed(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <circle cx="8" cy="12" r="2" />
    </svg>
  );
}

export function IconFork(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M3 3v6a3 3 0 0 0 3 3" />
      <path d="M9 3v6a3 3 0 0 1-3 3" />
      <path d="M6 12v9" />
      <path d="M17 3c-2 0-3 2-3 5s1 5 3 5v6" />
    </svg>
  );
}

export function IconTicket(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M9 6v12" />
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function IconBriefcase(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconSmartphone(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function IconHeart(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M12 20s-7-4.35-9.5-9C1 7 3 4 6 4c1.7 0 3.2.9 4 2 .8-1.1 2.3-2 4-2 3 0 5 3 3.5 7-2.5 4.65-9.5 9-9.5 9z" />
    </svg>
  );
}

export function IconPiggyBank(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M19 11.5h2v3h-2" />
      <path d="M16 7c.5-1 1.5-2 3-2-1 1.5-1 3 0 4" />
      <path d="M3 14a7 7 0 0 1 7-7h3a6 6 0 0 1 6 6v3a4 4 0 0 1-4 4h-1l-1 2h-2l-1-2h-2l-1 2H6l-1-2A4 4 0 0 1 3 16z" />
      <circle cx="8" cy="13" r="1" />
    </svg>
  );
}

export function IconRocket(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M4.5 16.5c-1.5 1.5-1.5 4-1.5 4s2.5 0 4-1.5l-2.5-2.5z" />
      <path d="M9.5 17c-2-2-3.5-4-3.5-7 0-4 4-8 8-8 4 0 8 4 8 8 0 3-1.5 5-3.5 7l-2 2-4-1-2 1-1-2z" />
      <circle cx="14" cy="9" r="2" />
    </svg>
  );
}

export function IconPalette(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-2a2 2 0 0 0-2 2v.5a2.5 2.5 0 0 1-2 2.5z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconGear(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M19.4 13.4a7.6 7.6 0 0 0 0-2.8l2-1.5-2-3.4-2.4.8a7.6 7.6 0 0 0-2.4-1.4L14 2.5h-4l-.6 2.6a7.6 7.6 0 0 0-2.4 1.4L4.6 5.7l-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2.8l-2 1.5 2 3.4 2.4-.8a7.6 7.6 0 0 0 2.4 1.4l.6 2.6h4l.6-2.6a7.6 7.6 0 0 0 2.4-1.4l2.4.8 2-3.4z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M6 6l12 12M6 18 18 6" />
    </svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconUserPlus(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function IconQrCode(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </svg>
  );
}

export function IconTrendingUp(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

export function IconMoreVertical(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconVault(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8v1M12 15v1M8 12h1M15 12h1" />
    </svg>
  );
}

export function IconActivity(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function IconSlip(p: IconProps) {
  return (
    <svg {...svgProps(p)} aria-hidden>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h6" />
    </svg>
  );
}
