/** Shared SVG fact icons for Player Identity Facts — no emoji except country flags. */

type IconProps = { className?: string };

export function IconGlobe({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconHeight({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
    </svg>
  );
}

export function IconWeight({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 8h12l1 12H5L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function IconFoot({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 16c0-3 2-5 5-6l2-5h3l1 5c3 1 4 3 4 6v2H5v-2z" />
    </svg>
  );
}

export function IconClub({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" />
    </svg>
  );
}

export function IconCompetition({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

export function IconContract({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

export function IconSquad({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8h3a2 2 0 0 1 0 4h-1v4" />
    </svg>
  );
}

export function IconPositions({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M12 5v14M3 12h18" />
    </svg>
  );
}
