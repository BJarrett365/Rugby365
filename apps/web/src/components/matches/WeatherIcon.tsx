import type { WeatherIconKind } from "@/lib/weather-condition";

type Props = {
  kind: WeatherIconKind;
  className?: string;
  title?: string;
};

/** Compact SVG weather glyphs for match boards and headers. */
export function WeatherIcon({ kind, className = "pr-weather-icon", title }: Props) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    role: "img" as const,
  };

  switch (kind) {
    case "clear":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "partly_cloudy":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <circle cx="8.5" cy="9" r="3" />
          <path d="M8.5 3.5v1.2M3.8 5.2l.9.9M3.2 9.5H2M3.8 13.8l.9-.9" />
          <path d="M10 16.5h7.2a3.2 3.2 0 0 0 .3-6.4 4.2 4.2 0 0 0-7.8 1.4 2.8 2.8 0 0 0 .3 5" />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M7.5 17.5h9.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.1 1.6A3.2 3.2 0 0 0 7.5 17.5Z" />
        </svg>
      );
    case "fog":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M4 10h16M5 14h14M7 18h10" />
          <path d="M8 7.5h8a2.5 2.5 0 0 0 .2-5 3.5 3.5 0 0 0-6.6 1.2A2.2 2.2 0 0 0 8 7.5Z" />
        </svg>
      );
    case "drizzle":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M7.5 13.5h9.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.1 1.6A3.2 3.2 0 0 0 7.5 13.5Z" />
          <path d="M9 16.5v1.5M12 17v1.5M15 16.5v1.5" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M7.5 13h9.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.1 1.6A3.2 3.2 0 0 0 7.5 13Z" />
          <path d="M8.5 16l-1 3M12 15.5l-1 3.5M15.5 16l-1 3" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M7.5 12.5h9.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.1 1.6A3.2 3.2 0 0 0 7.5 12.5Z" />
          <path d="M9 16.5h0M12 17.5h0M15 16.5h0M10.5 19.5h0M13.5 19.5h0" />
          <circle cx="9" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="12" cy="17.5" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="15" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="19.5" r="0.55" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="19.5" r="0.55" fill="currentColor" stroke="none" />
        </svg>
      );
    case "thunder":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M7.5 12h9.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.1 1.6A3.2 3.2 0 0 0 7.5 12Z" />
          <path d="M12.5 13.5 10 18h2.5L11 22" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M7.5 17.5h9.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.1 1.6A3.2 3.2 0 0 0 7.5 17.5Z" />
        </svg>
      );
  }
}
