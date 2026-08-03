import Link from "next/link";
import type { ReactNode } from "react";
import { LineupPitchJersey } from "@/components/matches/LineupPitchJersey";
import { TeamOfWeekPitch } from "@/components/competitions/TeamOfWeekPitch";
import { RugbyShirtSvg } from "@/components/shirts/RugbyShirtSvg";
import { teamAccentColor } from "@/lib/team-accent-color";
import type { ShirtSvgConfig } from "@/lib/shirt-library-types";
import {
  formatTotwDateRange,
  type TotwPublicPlayer,
  type TotwPublicView,
} from "@/lib/team-of-week-public";

function benchShirtConfig(p: TotwPublicPlayer): ShirtSvgConfig | null {
  const raw = p.shirtSvgConfig;
  if (!raw || typeof raw.bodyColour !== "string") return null;
  return {
    bodyColour: raw.bodyColour,
    secondaryColour: (raw.secondaryColour as string | null) ?? null,
    sleeveColour: (raw.sleeveColour as string | null) ?? null,
    collarColour: (raw.collarColour as string | null) ?? null,
    cuffColour: (raw.cuffColour as string | null) ?? null,
    sidePanelColour: (raw.sidePanelColour as string | null) ?? null,
    patternType: String(raw.patternType ?? "PLAIN"),
    patternColour: (raw.patternColour as string | null) ?? null,
    patternSettings: (raw.patternSettings as ShirtSvgConfig["patternSettings"]) ?? {},
    numberColour: String(raw.numberColour ?? "#FFFFFF"),
    numberBorderColour: (raw.numberBorderColour as string | null) ?? null,
    crestEnabled: raw.crestEnabled !== false,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TotwProfileLink({
  href,
  children,
  className,
}: {
  href: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={href} className={`totw-link${className ? ` ${className}` : ""}`}>
      {children}
    </Link>
  );
}

function playerHref(slug: string | null | undefined): string | null {
  return slug?.trim() ? `/players/${slug.trim()}` : null;
}

function teamHref(slug: string | null | undefined): string | null {
  return slug?.trim() ? `/teams/${slug.trim()}` : null;
}

function coachHref(slug: string | null | undefined): string | null {
  return slug?.trim() ? `/coaches/${slug.trim()}` : null;
}

function refereeHref(slug: string | null | undefined): string | null {
  return slug?.trim() ? `/referees/${slug.trim()}` : null;
}

function AwardCard({
  label,
  name,
  nameHref,
  sub,
  subHref,
  rating,
  stats,
  imageUrl,
  limitedData,
}: {
  label: string;
  name: string;
  nameHref?: string | null;
  sub: string;
  subHref?: string | null;
  rating: number | null;
  stats: string;
  imageUrl: string | null;
  limitedData?: boolean;
}) {
  return (
    <article className="totw-award">
      <div className="totw-award__label">{label}</div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="totw-award__img" />
      ) : (
        <div className="totw-award__img totw-award__img--empty" aria-hidden>
          {initials(name)}
        </div>
      )}
      <div>
        <h3 className="totw-award__name">
          <TotwProfileLink href={nameHref}>{name}</TotwProfileLink>
        </h3>
        <p className="totw-award__sub">
          <TotwProfileLink href={subHref}>{sub}</TotwProfileLink>
        </p>
        {rating != null ? (
          <p className="totw-award__rating">{rating.toFixed(1)}/10</p>
        ) : null}
        <p className="totw-award__stats">
          {stats}
          {limitedData ? " · Limited data" : ""}
        </p>
      </div>
    </article>
  );
}

function statsLine(stats: Record<string, unknown> | null | undefined): string {
  if (!stats) return "";
  const bits: string[] = [];
  const tries = Number(stats.tries ?? 0);
  const tackles = Number(stats.tacklesMade ?? stats.tacklesCompleted ?? 0);
  const turnovers = Number(stats.turnoversWon ?? 0);
  const metres = Number(stats.metresCarried ?? 0);
  if (tries) bits.push(`${tries} Try${tries === 1 ? "" : "s"}`);
  if (tackles) bits.push(`${tackles} Tackles`);
  if (turnovers) bits.push(`${turnovers} Turnovers`);
  if (metres >= 40) bits.push(`${metres}m`);
  return bits.slice(0, 4).join(" | ");
}

export function TeamOfWeekView({
  data,
  showArchiveLink,
}: {
  data: TotwPublicView;
  showArchiveLink?: boolean;
}) {
  const { edition, competition, season, starting, bench, closeCalls, droppedOut, awards, summary } =
    data;
  const potw = awards.PLAYER_OF_WEEK;
  const coach = awards.COACH_OF_WEEK;
  const ref = awards.REFEREE_OF_WEEK;
  const topTeam = awards.TEAM_OF_WEEK;
  const dateRange = formatTotwDateRange(edition.roundStartDate, edition.roundEndDate);
  const potwId = potw?.playerId ?? null;

  return (
    <section className="totw" data-totw-edition={edition.id}>
      <header className="totw__header">
        <div>
          <h2 className="totw__title">
            {competition?.name ?? "Competition"} – Team of the Week
          </h2>
          <div className="totw__meta">
            <span className="totw__pill">{edition.roundName}</span>
            {edition.isProvisional ? (
              <span className="totw__pill totw__pill--warn">Provisional</span>
            ) : null}
            {dateRange ? <span>{dateRange}</span> : null}
            {season?.label ? <span>· {season.label}</span> : null}
          </div>
        </div>
        <div className="totw__powered">
          Powered by The Breakdown
          <br />
          Rugby365 Betting Intelligence
        </div>
      </header>

      <div className="totw__awards">
        <AwardCard
          label="Player of the Week"
          name={potw?.name ?? "TBC"}
          nameHref={playerHref(potw?.slug)}
          sub={
            potw
              ? `${potw.positionLabel ?? "Player"}${potw.teamName ? ` – ${potw.teamName}` : ""}`
              : "Awaiting selection"
          }
          subHref={teamHref(potw?.teamSlug)}
          rating={potw?.rating ?? null}
          stats={statsLine(potw?.stats) || potw?.shortReason || ""}
          imageUrl={potw?.imageUrl ?? null}
        />
        <AwardCard
          label="Coach of the Week"
          name={coach?.name ?? "TBC"}
          nameHref={coachHref(coach?.slug)}
          sub={coach?.teamName ?? "Coach"}
          subHref={teamHref(coach?.teamSlug)}
          rating={coach?.rating ?? null}
          stats={coach?.shortReason ?? ""}
          imageUrl={coach?.imageUrl ?? null}
          limitedData={coach?.limitedData}
        />
        <AwardCard
          label="Referee of the Week"
          name={ref?.name ?? "TBC"}
          nameHref={refereeHref(ref?.slug)}
          sub="Referee"
          rating={ref?.rating ?? null}
          stats={ref?.shortReason ?? ""}
          imageUrl={ref?.imageUrl ?? null}
          limitedData={ref?.limitedData}
        />
      </div>

      <div className="totw__main">
        <TeamOfWeekPitch starting={starting} potwId={potwId} />

        <aside className="totw-bench">
          <h3 className="totw-bench__title">Impact Bench</h3>
          {bench.length === 0 ? (
            <p className="totw-award__sub">No bench selected</p>
          ) : (
            bench.map((p) => (
              <div key={`${p.playerId}-${p.shirtNumber}`} className="totw-bench__row">
                <div className="totw-slot__jersey">
                  {benchShirtConfig(p) ? (
                    <RugbyShirtSvg
                      {...benchShirtConfig(p)!}
                      number={p.shirtNumber ?? ""}
                      size={40}
                    />
                  ) : (
                    <LineupPitchJersey
                      number={p.shirtNumber ?? ""}
                      accent={teamAccentColor(p.teamName, "away")}
                      variant="away"
                    />
                  )}
                </div>
                <div>
                  <p className="totw-bench__name">
                    <TotwProfileLink href={playerHref(p.playerSlug)}>
                      {p.playerName}
                    </TotwProfileLink>
                  </p>
                  <p className="totw-bench__team">
                    <TotwProfileLink href={teamHref(p.teamSlug)}>{p.teamName}</TotwProfileLink>
                  </p>
                </div>
                {p.matchRating != null ? (
                  <span className="totw-slot__rating">{p.matchRating.toFixed(1)}</span>
                ) : null}
              </div>
            ))
          )}
        </aside>
      </div>

      <div className="totw__bottom">
        <div className="totw-panel">
          <h3 className="totw-panel__title totw-panel__title--gold">Who Was Close?</h3>
          <ul>
            {closeCalls.slice(0, 6).map((p) => (
              <li key={`${p.playerId}-close`}>
                <strong>
                  <TotwProfileLink href={playerHref(p.playerSlug)}>{p.playerName}</TotwProfileLink>
                </strong>{" "}
                · <TotwProfileLink href={teamHref(p.teamSlug)}>{p.teamName}</TotwProfileLink>
                {p.matchRating != null ? ` · ${p.matchRating.toFixed(1)}` : ""}
                {p.shortReason ? (
                  <>
                    <br />
                    <span style={{ opacity: 0.75 }}>{p.shortReason}</span>
                  </>
                ) : null}
              </li>
            ))}
            {!closeCalls.length ? <li>No close calls recorded</li> : null}
          </ul>
        </div>
        <div className="totw-panel">
          <h3 className="totw-panel__title totw-panel__title--green">Why They Were Selected</h3>
          <ul>
            {starting.slice(0, 8).map((p) => (
              <li key={`${p.playerId}-why`}>
                <strong>
                  <TotwProfileLink href={playerHref(p.playerSlug)}>{p.playerName}</TotwProfileLink>
                </strong>
                {p.shortReason ? ` — ${p.shortReason}` : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="totw-panel">
          <h3 className="totw-panel__title totw-panel__title--red">Who Dropped Out?</h3>
          <ul>
            {droppedOut.slice(0, 6).map((p) => (
              <li key={`${p.playerId}-drop`}>
                <strong>
                  <TotwProfileLink href={playerHref(p.playerSlug)}>{p.playerName}</TotwProfileLink>
                </strong>{" "}
                · <TotwProfileLink href={teamHref(p.teamSlug)}>{p.teamName}</TotwProfileLink>
                {p.matchRating != null ? ` · prev ${p.matchRating.toFixed(1)}` : ""}
              </li>
            ))}
            {!droppedOut.length ? (
              <li>No previous published round to compare</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="totw__footer">
        <div className="totw-summary">
          <h3 className="totw-summary__title">{edition.roundName} Summary</h3>
          <div className="totw-summary__stat">
            <strong>{summary.totalTries}</strong>
            Tries
          </div>
          <div className="totw-summary__stat">
            <strong>{summary.totalPoints}</strong>
            Points
          </div>
          <div className="totw-summary__stat">
            <strong>{summary.totalMetres}</strong>
            Metres
          </div>
          <div className="totw-summary__stat">
            <strong>{summary.totalTackles}</strong>
            Tackles
          </div>
          <div className="totw-summary__stat">
            <strong>{summary.matchesPlayed}</strong>
            Matches
          </div>
        </div>
        <div className="totw-top-team">
          {topTeam?.teamImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={topTeam.teamImageUrl} alt="" />
          ) : (
            <div className="totw-award__img totw-award__img--empty" style={{ width: 56, height: 56 }}>
              {initials(topTeam?.name ?? "T")}
            </div>
          )}
          <div>
            <h3 className="totw-panel__title totw-panel__title--gold" style={{ marginBottom: 4 }}>
              Top Performing Team
            </h3>
            <p className="totw-award__name" style={{ fontSize: "1.05rem" }}>
              <TotwProfileLink href={teamHref(topTeam?.teamSlug ?? topTeam?.slug)}>
                {topTeam?.name ?? "TBC"}
              </TotwProfileLink>
            </p>
            <p className="totw-award__sub">{topTeam?.shortReason ?? ""}</p>
          </div>
        </div>
      </div>

      {showArchiveLink && competition?.slug ? (
        <p style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
          <Link href={`/competitions/${competition.slug}/team-of-the-week`}>
            View all rounds →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
