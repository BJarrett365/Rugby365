import type { ReactNode, SelectHTMLAttributes } from "react";
import Link from "next/link";
import { formatRankMovementLabel } from "@/lib/player-ranking-engine";

export function RankNumber({
  rank,
  provisional,
}: {
  rank: number;
  provisional?: boolean;
}) {
  const podium = rank >= 1 && rank <= 3;
  return (
    <span
      className={`pr-rankings__rank${podium ? " is-podium" : ""}${provisional ? " is-provisional" : ""}`}
    >
      {rank}
    </span>
  );
}

export function VerifiedTick() {
  return (
    <span className="pr-rankings__verified" title="Eligible" aria-label="Verified">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
        <circle cx="8" cy="8" r="8" fill="#22c55e" />
        <path
          d="M4.6 8.2 7 10.7 11.5 5.5"
          fill="none"
          stroke="#052e16"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function RankingStatusBadge({
  provisional,
  retired,
}: {
  provisional?: boolean;
  retired?: boolean;
}) {
  if (retired) {
    return <span className="pr-rankings__badge is-retired">RETIRED</span>;
  }
  if (provisional) {
    return <span className="pr-rankings__badge">PROVISIONAL</span>;
  }
  return <VerifiedTick />;
}

export function RankingsAvatar({ src, name }: { src: string | null | undefined; name: string | null | undefined }) {
  const initial = (name ?? "").trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="pr-rankings__avatar-wrap">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="pr-rankings__avatar" />
      ) : (
        <span className="pr-rankings__avatar is-placeholder" aria-hidden>
          {initial}
        </span>
      )}
    </span>
  );
}

export function RankingsCrest({ src, name }: { src: string | null | undefined; name: string | null | undefined }) {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <span className="pr-rankings__crest" title={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="pr-rankings__crest-fallback" aria-hidden>
          {initials}
        </span>
      )}
    </span>
  );
}

export function RankingsFlag({ src, name }: { src: string | null | undefined; name: string | null | undefined }) {
  const initials = (name ?? "").trim().slice(0, 2).toUpperCase() || "?";
  return (
    <span className="pr-rankings__flag" title={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="pr-rankings__flag-fallback" aria-hidden>
          {initials}
        </span>
      )}
    </span>
  );
}

export function RankingClubCell({
  clubName,
  clubSlug,
  clubImageUrl,
  otherClubs,
}: {
  clubName: string | null | undefined;
  clubSlug?: string | null;
  clubImageUrl?: string | null;
  otherClubs?: Array<{ name: string; slug: string | null; imageUrl: string | null }>;
}) {
  const extras = (otherClubs ?? []).filter((club) => {
    if (!club.name || club.name === clubName) return false;
    if (club.slug && clubSlug && club.slug === clubSlug) return false;
    return true;
  });
  if (!clubName) {
    return <span className="pr-rankings__dash">—</span>;
  }
  const body = (
    <>
      <RankingsCrest src={clubImageUrl} name={clubName} />
      <span>{clubName}</span>
    </>
  );
  return (
    <span className="pr-rankings__club-cell">
      {clubSlug ? (
        <Link href={`/teams/${clubSlug}`} className="pr-rankings__entity">
          {body}
        </Link>
      ) : (
        <span className="pr-rankings__entity">{body}</span>
      )}
      {extras.length > 0 ? (
        <details className="pr-rankings__club-more">
          <summary
            className="pr-rankings__club-chevron"
            aria-label={`Other clubs (${extras.length})`}
          >
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
              <path
                d="M3 4.5 6 8l3-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <ul className="pr-rankings__club-pop">
            {extras.map((club) => (
              <li key={club.slug ?? club.name}>
                {club.slug ? (
                  <Link
                    href={`/teams/${club.slug}`}
                    className="pr-rankings__entity"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <RankingsCrest src={club.imageUrl} name={club.name} />
                    <span>{club.name}</span>
                  </Link>
                ) : (
                  <span className="pr-rankings__entity">
                    <RankingsCrest src={club.imageUrl} name={club.name} />
                    <span>{club.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </span>
  );
}

export function PerformanceValue({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="pr-rankings__dash">—</span>;
  }
  return <span className="pr-rankings__perf">{Math.round(value)}</span>;
}

export function PlayerRankingsColgroup() {
  return (
    <colgroup>
      <col className="pr-rankings__col pr-rankings__col--rank" />
      <col className="pr-rankings__col pr-rankings__col--player" />
      <col className="pr-rankings__col pr-rankings__col--club" />
      <col className="pr-rankings__col pr-rankings__col--country" />
      <col className="pr-rankings__col pr-rankings__col--rating" />
      <col className="pr-rankings__col pr-rankings__col--form" />
      <col className="pr-rankings__col pr-rankings__col--perf" />
      <col className="pr-rankings__col pr-rankings__col--perf" />
      <col className="pr-rankings__col pr-rankings__col--perf" />
      <col className="pr-rankings__col pr-rankings__col--move" />
    </colgroup>
  );
}

export function FormBlocks({
  blocks,
}: {
  blocks: Array<{ rating: number; band: string }>;
}) {
  const padded = [...blocks];
  while (padded.length < 5) {
    padded.push({ rating: 0, band: "empty" });
  }
  const title = blocks.length
    ? `Last 5: ${blocks
        .map((b) => Math.round(b.rating > 10 ? b.rating : b.rating * 10))
        .join(" · ")}`
    : undefined;
  return (
    <span className="pr-rankings__form" title={title}>
      {padded.slice(0, 5).map((b, i) => (
        <span key={`${b.band}-${i}`} className={`pr-rankings__form-block is-${b.band}`} />
      ))}
    </span>
  );
}

export function MovementCell({
  rank,
  movement,
  previousRank,
  movementDelta,
  retired,
}: {
  rank?: number | null;
  movement: "up" | "down" | "flat" | null;
  previousRank: number | null;
  movementDelta?: number | null;
  retired?: boolean;
}) {
  if (retired) {
    const was = previousRank ?? rank ?? null;
    return (
      <span className="pr-rankings__move is-retired">
        <span className="pr-rankings__move-delta">RETIRED</span>
        {was != null ? <span className="pr-rankings__move-was">(WAS {was})</span> : null}
      </span>
    );
  }

  const ranked = formatRankMovementLabel({
    rank: rank ?? null,
    previousRank,
  });
  if (ranked) {
    const delta =
      ranked.direction === "up"
        ? `▲ ${ranked.places}`
        : ranked.direction === "down"
          ? `▼ ${Math.abs(ranked.places)}`
          : "—";
    return (
      <span className={`pr-rankings__move is-${ranked.direction}`}>
        <span className="pr-rankings__move-delta">{delta}</span>
        <span className="pr-rankings__move-was">(WAS {previousRank})</span>
      </span>
    );
  }

  if (movement == null) return <span className="pr-rankings__dash">—</span>;
  return (
    <span className={`pr-rankings__move is-${movement}`}>
      <span className="pr-rankings__move-delta">
        {movement === "up" ? "▲" : movement === "down" ? "▼" : "—"}
      </span>
    </span>
  );
}

export function RankingsBoardFooter({
  eligibilityNote,
}: {
  eligibilityNote: string;
}) {
  return (
    <div className="pr-rankings__footer">
      <p className="pr-rankings__legend">
        <span className="pr-rankings__info-icon" aria-hidden>
          i
        </span>
        {eligibilityNote}
      </p>
      <p className="pr-rankings__move-key" aria-label="Movement key">
        <span className="pr-rankings__move-key-label">MOVEMENT KEY</span>
        <span className="is-up">▲ UP</span>
        <span className="is-down">▼ DOWN</span>
        <span className="is-flat">— NO CHANGE</span>
      </p>
    </div>
  );
}

export function RankingsUpdatedStamp({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const label = new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <p className="pr-rankings__updated">
      Updated: {label}
      <span className="pr-rankings__info-icon" aria-hidden>
        i
      </span>
    </p>
  );
}

export function RatingValue({ value }: { value: number | null | undefined }) {
  return (
    <span className="pr-rankings__rating">
      {value != null && Number.isFinite(value) ? value.toFixed(1) : "—"}
    </span>
  );
}

export function RankingsFilterSelect({
  label,
  icon,
  className,
  children,
  ...selectProps
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`pr-rankings__filter${className ? ` ${className}` : ""}`}>
      <span className="pr-rankings__filter-label">
        {icon}
        {label}
      </span>
      <select {...selectProps}>{children}</select>
    </label>
  );
}

export function SeasonCalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <rect
        x="1.5"
        y="3"
        width="13"
        height="11.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
