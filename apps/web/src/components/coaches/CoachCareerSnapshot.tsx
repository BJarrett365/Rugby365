function SnapshotIcon({ kind }: { kind: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (kind) {
    case "caps":
      return (
        <svg {...common}>
          <path d="M7 8.5h10v8.5H7z" />
          <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
          <path d="M7 12h10" />
        </svg>
      );
    case "points":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="7" ry="4.5" />
          <path d="M12 7.5v9" />
          <path d="M8.2 9.2c1.4 1.2 3.1 1.8 3.8 1.8s2.4-.6 3.8-1.8" />
          <path d="M8.2 14.8c1.4-1.2 3.1-1.8 3.8-1.8s2.4.6 3.8 1.8" />
        </svg>
      );
    case "world_cup":
      return (
        <svg {...common}>
          <path d="M8 5h8v4a4 4 0 0 1-8 0V5z" />
          <path d="M8 6.5H5.5A2.5 2.5 0 0 0 8 9" />
          <path d="M16 6.5h2.5A2.5 2.5 0 0 1 16 9" />
          <path d="M12 13v3" />
          <path d="M9.5 19h5" />
          <path d="M10.5 16h3v3h-3z" />
        </svg>
      );
    case "championship":
      return (
        <svg {...common}>
          <circle cx="12" cy="11" r="5.5" />
          <circle cx="12" cy="11" r="3.2" />
          <path d="M12 5.5v1.2M12 15.3v1.2M6.5 11h1.2M16.3 11h1.2" />
          <path d="M9 18.5h6" />
        </svg>
      );
    case "award":
      return (
        <svg {...common}>
          <path d="M12 3.8l1.7 3.5 3.8.6-2.8 2.7.7 3.8L12 12.6 8.6 14.4l.7-3.8L6.5 7.9l3.8-.6L12 3.8z" />
          <path d="M9.5 16.5h5v2.2l-2.5 1.3-2.5-1.3v-2.2z" />
        </svg>
      );
    case "wins":
    case "win_rate":
      return (
        <svg {...common}>
          <path d="M7 12.5l3.2 3.2L17 8.8" />
        </svg>
      );
    case "matches":
    default:
      return (
        <svg {...common}>
          <rect x="6" y="7" width="12" height="11" rx="1.5" />
          <path d="M9 7V5.8a3 3 0 0 1 6 0V7" />
        </svg>
      );
  }
}

export function CoachCareerSnapshot({
  rows,
}: {
  rows: Array<{ value: number | string; label: string; icon: string }>;
}) {
  return (
    <aside className="pr-coach-snapshot">
      <h2>Career Snapshot</h2>
      {rows.length === 0 ? (
        <p className="pr-coach-snapshot__empty">No verified snapshot metrics yet.</p>
      ) : (
        <ul className="pr-coach-snapshot__list">
          {rows.map((row) => (
            <li className="pr-coach-snapshot__row" key={`${row.icon}-${row.label}`}>
              <span className="pr-coach-snapshot__icon" aria-hidden>
                <SnapshotIcon kind={row.icon} />
              </span>
              <span className="pr-coach-snapshot__value">{row.value}</span>
              <span className="pr-coach-snapshot__label">{row.label}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
