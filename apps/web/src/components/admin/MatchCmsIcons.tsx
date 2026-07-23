/** Small inline SVG icons for Matches CMS — no new icon package. */

type IconProps = { className?: string; title?: string };

const base = "shrink-0";

export function IconUsers({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconChart({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M3 3v18h18" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-9" />
    </svg>
  );
}

export function IconList({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

/** Trend / line chart — Player Stats action. */
export function IconTrend({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

/** Pitch / field — Match Events action. */
export function IconPitch({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3 12h2.5M18.5 12H21" />
    </svg>
  );
}

export function IconChat({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconBolt({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function IconLink({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function IconPencil({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconSave({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

export function IconAlert({ className = "w-3.5 h-3.5", title }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconChevron({ className = "w-3.5 h-3.5", open }: { className?: string; open?: boolean }) {
  return (
    <svg
      className={`${base} ${className} transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
