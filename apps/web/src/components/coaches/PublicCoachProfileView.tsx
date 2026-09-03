import Link from "next/link";
import type { CSSProperties } from "react";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { scoreBandColor } from "@/lib/coach-rating-service";
import {
  POWER_INDEX_DISPLAY_LEFT,
  POWER_INDEX_DISPLAY_RIGHT,
} from "@/lib/coach-power-index-engine";
import { formatPublicDate } from "@/lib/public-entity-profile-utils";
import { formatCoachResultDate } from "@/lib/coach-perspective-result";
import { PublicEntityPreviewBanner } from "@/components/entities/PublicEntityProfileBits";
import {
  CareerTimelineBadge,
  careerBadgeKindFromTimeline,
} from "./CareerTimelineBadge";
import { CoachPlayingCareer } from "./CoachPlayingCareer";
import { CoachCareerSnapshot } from "./CoachCareerSnapshot";
import { CoachProfileAssetImage } from "./CoachProfileAssetImage";
import { CoachSquadDashboard } from "./CoachSquadDashboard";
import { CoachRatingTrendsCard } from "./CoachRatingTrendsCard";
import { CoachAwardsCard } from "./CoachAwardsCard";
import { CoachMedalRecordCard } from "./CoachMedalRecordCard";
import { HonourAwardIcon, HonourTrophyIcon } from "@/components/honours/HonourIcons";
import { isCoachAssessment } from "@/lib/coach-field-provenance";
import { coachHeroNameLines } from "@/lib/coach-display-name";

function formatCoachResultDateMobile(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = d
    .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  return `${day} ${mon}`;
}

function formatCoachResultDetailDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

function formatCoachResultKickoff(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function dash(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function bandClass(score: number | null): string {
  const b = scoreBandColor(score);
  if (b === "amber") return "amber";
  if (b === "orange") return "orange";
  if (b === "red") return "red";
  return "";
}

/** Power Index score bands (design tokens via CSS classes). */
function powerBandClass(score: number | null): string {
  if (score == null) return "muted";
  if (score >= 90) return "";
  if (score >= 80) return "amber";
  if (score >= 70) return "orange";
  return "red";
}

function stars(rating: number | null): string {
  if (rating == null || Number.isNaN(rating)) return "☆☆☆☆☆";
  // Ratings are 0–100; clamp so a bad value never floods the KPI strip.
  const score = Math.max(0, Math.min(100, rating));
  const filled = Math.round((score / 100) * 10) / 2; // 0–5 in 0.5 steps
  const full = Math.min(5, Math.floor(filled));
  const half = filled - full >= 0.5 && full < 5;
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  return `${"★".repeat(full)}${half ? "½" : ""}${"☆".repeat(empty)}`;
}

function heroNameLines(profile: PublicCoachProfile): { line1: string; line2: string } {
  return coachHeroNameLines({
    name: profile.name,
    knownAs: profile.knownAs,
    fullName: profile.fullName,
  });
}

function nationalityFlag(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("ireland")) return "🇮🇪";
  if (n.includes("south africa")) return "🇿🇦";
  if (n.includes("new zealand")) return "🇳🇿";
  if (n.includes("england")) return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (n.includes("wales")) return "🏴󠁧󠁢󠁷󠁬󠁳󠁿";
  if (n.includes("scotland")) return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  if (n.includes("france")) return "🇫🇷";
  if (n.includes("australia")) return "🇦🇺";
  if (n.includes("argentina")) return "🇦🇷";
  if (n.includes("italy")) return "🇮🇹";
  if (n.includes("japan")) return "🇯🇵";
  if (n.includes("fiji")) return "🇫🇯";
  return null;
}

const NAV: Array<{ id: string; label: string; href?: string }> = [
  { id: "overview", label: "Overview" },
  { id: "career", label: "Career", href: "career" },
  { id: "stats", label: "Stats", href: "stats" },
  { id: "honours", label: "Honours", href: "honours" },
  { id: "history", label: "History", href: "history" },
  { id: "matches", label: "Matches", href: "matches" },
  { id: "h2h", label: "Head-to-Head", href: "compare" },
  { id: "rankings", label: "Rankings", href: "rankings" },
  { id: "news", label: "News" },
];

export function PublicCoachProfileView({ profile }: { profile: PublicCoachProfile }) {
  const r = profile.ratings;
  const cr = profile.careerRecord;
  const teamDash = profile.teamDashboard;
  const teamHref = teamDash ? `/teams/${teamDash.teamSlug}` : null;
  const teamFlag = nationalityFlag(teamDash?.teamName ?? teamDash?.countryName);
  const coachFlag = nationalityFlag(profile.nationality);
  // Same source as Recent Results (oldest → newest for form strip).
  const formResults =
    teamDash && teamDash.form.length > 0
      ? teamDash.form
      : profile.recentMatches.length > 0
        ? [...profile.recentMatches]
            .reverse()
            .map((m) => m.result)
            .filter((x): x is "W" | "D" | "L" => x != null)
        : cr.form;
  const powerLeft = POWER_INDEX_DISPLAY_LEFT;
  const powerRight = POWER_INDEX_DISPLAY_RIGHT;
  /** Prefer Intelligence scores so Power Index card always matches CI. */
  const metricMap = new Map(
    (r.intelligence?.length ? r.intelligence : r.metrics).map((m) => [m.key, m]),
  );
  const powerPct = r.powerIndex != null ? Math.max(0, Math.min(100, r.powerIndex)) : 0;
  const ringCircumference = 2 * Math.PI * 54;

  const appointedYear = profile.appointedOn?.slice(0, 4) ?? null;
  const contractYear = profile.contractExpiresOn?.slice(0, 4) ?? null;
  const birthLabel = profile.birthDate
    ? `${formatPublicDate(profile.birthDate)}${profile.age != null ? ` (${profile.age})` : ""}`
    : "—";
  const nameLines = heroNameLines(profile);

  return (
    <article className="pr-coach-profile">
      <PublicEntityPreviewBanner preview={profile.preview} />

      <nav className="pr-coach-profile__nav" aria-label="Coach sections">
        {NAV.map((item) => {
          const href = item.href?.startsWith("/")
            ? item.href
            : item.href
              ? `/coaches/${profile.slug}/${item.href}`
              : `#${item.id}`;
          return (
            <Link key={item.id} href={href} className={item.id === "overview" ? "is-active" : undefined}>
              {item.label}
            </Link>
          );
        })}
        <div className="pr-coach-profile__actions">
          <Link className="pr-coach-profile__btn" href={`/coaches/compare?a=${profile.slug}`}>
            Compare Coach
          </Link>
          <span className="pr-coach-profile__btn pr-coach-profile__btn--primary">Follow</span>
          <button type="button" className="pr-coach-profile__btn pr-coach-profile__btn--icon" aria-label="Share">
            ↗
          </button>
        </div>
      </nav>

      {teamDash ? (
        <section className="pr-coach-hero pr-coach-hero--team" id="overview">
          <div className="pr-coach-hero__team-panel">
            <div className="pr-coach-hero__team-identity">
              {profile.currentTeamCrestUrl || teamDash.teamImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="pr-coach-hero__team-crest"
                  src={profile.currentTeamCrestUrl || teamDash.teamImageUrl || ""}
                  alt={`${teamDash.teamName} crest`}
                />
              ) : (
                <span className="pr-coach-hero__team-crest is-empty" aria-hidden />
              )}
              <div>
                <div className="pr-coach-hero__team-kicker">
                  Current team
                  {teamFlag ? (
                    <span className="pr-coach-hero__flag" aria-hidden>
                      {teamFlag}
                    </span>
                  ) : null}
                </div>
                <h1>{teamDash.teamName}</h1>
                {teamDash.nickname ? <div className="pr-coach-hero__nickname">{teamDash.nickname}</div> : null}
              </div>
            </div>
            <dl className="pr-coach-hero__team-facts">
              <div>
                <dt>Union</dt>
                <dd>{dash(teamDash.unionName)}</dd>
              </div>
              <div>
                <dt>Nickname</dt>
                <dd>{dash(teamDash.nickname)}</dd>
              </div>
              <div>
                <dt>Founded</dt>
                <dd>{dash(teamDash.foundedYear)}</dd>
              </div>
              <div>
                <dt>Home Venue</dt>
                <dd>{dash(teamDash.homeVenueName)}</dd>
              </div>
            </dl>
            {teamHref ? (
              <Link className="pr-coach-hero__cta" href={teamHref}>
                Team Profile &gt;
              </Link>
            ) : null}
          </div>

          <div className="pr-coach-hero__coach-panel">
            <div className="pr-coach-hero__coach-copy">
              <div className="pr-coach-hero__role">{profile.currentRole?.roleLabel ?? "Head Coach"}</div>
              <h2 className="pr-coach-hero__coach-name">
                {profile.displayName}
                {profile.verified ? (
                  <span className="pr-coach-hero__verified" title="Verified">
                    ✓
                  </span>
                ) : null}
              </h2>
              <dl className="pr-coach-hero__coach-facts">
                <div>
                  <dt>Age</dt>
                  <dd>{dash(profile.age)}</dd>
                </div>
                <div>
                  <dt>Nationality</dt>
                  <dd>
                    {profile.nationality ?? "—"}
                    {coachFlag ? (
                      <span className="pr-coach-hero__flag" aria-hidden>
                        {coachFlag}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Appointed</dt>
                  <dd>{dash(appointedYear)}</dd>
                </div>
                <div>
                  <dt>Contract</dt>
                  <dd>{dash(contractYear)}</dd>
                </div>
                <div>
                  <dt>
                    Coaching Style
                    {isCoachAssessment(profile.coachingStyleProvenance) ? (
                      <span className="pr-coach-hero__assess" title="Rugby365 assessment">
                        R365
                      </span>
                    ) : null}
                  </dt>
                  <dd>{dash(profile.coachingStyle)}</dd>
                </div>
                <div>
                  <dt>
                    Preferred System
                    {isCoachAssessment(profile.preferredSystemProvenance) ? (
                      <span className="pr-coach-hero__assess" title="Rugby365 assessment">
                        R365
                      </span>
                    ) : null}
                  </dt>
                  <dd>{dash(profile.preferredSystem)}</dd>
                </div>
                <div>
                  <dt>Success Rate</dt>
                  <dd>{cr.winRate != null ? `${cr.winRate}%` : "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="pr-coach-hero__coach-photo">
              {profile.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.imageUrl} alt={profile.name} />
              ) : (
                <div className="pr-coach-hero__silhouette" aria-hidden />
              )}
            </div>
          </div>
        </section>
      ) : (
      <section className="pr-coach-hero" id="overview">
        <div className="pr-coach-hero__image">
          {profile.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.imageUrl} alt={profile.name} />
          ) : (
            <div className="pr-coach-hero__silhouette" aria-hidden />
          )}
        </div>

        <div className="pr-coach-hero__mid">
          <div className="pr-coach-hero__identity">
            <h1>
              <span className="pr-coach-hero__name-line">{nameLines.line1}</span>
              {nameLines.line2 ? (
                <span className="pr-coach-hero__name-line">
                  {nameLines.line2}
                  {profile.verified ? (
                    <span className="pr-coach-hero__verified" title="Verified">
                      ✓
                    </span>
                  ) : null}
                </span>
              ) : profile.verified ? (
                <span className="pr-coach-hero__verified" title="Verified">
                  ✓
                </span>
              ) : null}
            </h1>
            {profile.nationality ? (
              <div className="pr-coach-hero__nat">
                <span>{profile.nationality}</span>
                {coachFlag ? (
                  <span className="pr-coach-hero__flag" aria-hidden>
                    {coachFlag}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="pr-coach-hero__role">{profile.currentRole?.roleLabel ?? "Coach"}</div>
            <div className="pr-coach-hero__team">{profile.currentRole?.teamName ?? "—"}</div>
          </div>

          <dl className="pr-coach-hero__grid">
            <div className="pr-coach-hero__fact">
              <dt>Born</dt>
              <dd>{birthLabel}</dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>Birthplace</dt>
              <dd>
                {[profile.placeOfBirth, profile.countryOfBirth || profile.nationality]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>Coaching Since</dt>
              <dd>{dash(profile.coachingCareerStartYear)}</dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>Appointed</dt>
              <dd>{dash(appointedYear)}</dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>Contract</dt>
              <dd>{dash(contractYear)}</dd>
            </div>
          </dl>
          <dl className="pr-coach-hero__grid pr-coach-hero__grid--row2">
            <div className="pr-coach-hero__fact">
              <dt>
                Preferred System
                {isCoachAssessment(profile.preferredSystemProvenance) ? (
                  <span className="pr-coach-hero__assess" title="Rugby365 assessment">
                    R365
                  </span>
                ) : null}
              </dt>
              <dd>{dash(profile.preferredSystem)}</dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>
                Coaching Style
                {isCoachAssessment(profile.coachingStyleProvenance) ? (
                  <span className="pr-coach-hero__assess" title="Rugby365 assessment">
                    R365
                  </span>
                ) : null}
              </dt>
              <dd>{dash(profile.coachingStyle)}</dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>Former Position</dt>
              <dd>{dash(profile.formerPlayingPositions)}</dd>
            </div>
            <div className="pr-coach-hero__fact">
              <dt>Height</dt>
              <dd>{dash(profile.heightLabel)}</dd>
            </div>
          </dl>
        </div>

        <div className="pr-coach-hero__crest-wrap">
          {profile.currentTeamCrestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="pr-coach-hero__crest"
              src={profile.currentTeamCrestUrl}
              alt={profile.currentRole?.teamName ? `${profile.currentRole.teamName} crest` : ""}
            />
          ) : null}
        </div>

        <CoachCareerSnapshot rows={profile.careerSnapshot} />
      </section>
      )}

      <div
        className="pr-coach-kpi"
        style={
          {
            ["--kpi-cols"]: teamDash ? 6 : r.competitionRank != null ? 8 : 7,
          } as CSSProperties
        }
      >
        <div className="pr-coach-kpi__cell">
          <Link
            href={`/coaches/${profile.slug}/rating`}
            className="pr-coach-kpi__link"
            title="Overall coaching rating based on current strength, career results, big matches, improvement, development and honours."
          >
            <div className="pr-coach-kpi__label">Rugby365 Rating</div>
            <div className="pr-coach-kpi__value">
              {teamDash?.teamRating != null
                ? teamDash.teamRating.toFixed(1)
                : r.overallRating != null
                  ? r.overallRating.toFixed(1)
                  : "—"}
            </div>
            <div className="pr-coach-kpi__stars">
              {stars(teamDash?.teamRating ?? r.overallRating)}
            </div>
          </Link>
        </div>
        <div className="pr-coach-kpi__cell">
          <Link
            href={teamDash && teamHref ? teamHref : "/rankings/coaches"}
            className="pr-coach-kpi__link"
            title={teamDash ? "Team world ranking." : "Ranking among eligible Rugby365 coaches."}
          >
            <div className="pr-coach-kpi__label">World Rank</div>
            <div className="pr-coach-kpi__value pr-coach-kpi__value--green">
              {teamDash?.worldRank != null
                ? `#${teamDash.worldRank}`
                : r.worldRank != null
                  ? `#${r.worldRank}`
                  : "—"}
            </div>
            <div className="pr-coach-kpi__sub">
              {teamDash
                ? teamDash.worldRankPoints != null
                  ? `${Math.round(teamDash.worldRankPoints)} pts`
                  : "Team ranking"
                : r.rankedOutOf != null
                  ? `Out of ${r.rankedOutOf}`
                  : r.provisional
                    ? "Provisional"
                    : "—"}
            </div>
          </Link>
        </div>
        {teamDash ? (
          <div className="pr-coach-kpi__cell">
            <Link href={teamHref ?? `/teams/${teamDash.teamSlug}`} className="pr-coach-kpi__link">
              <div className="pr-coach-kpi__label">Estimated Squad Value</div>
              <div className="pr-coach-kpi__value pr-coach-kpi__value--green">
                {teamDash.squadValueLabel}
              </div>
              <div className="pr-coach-kpi__sub">
                {teamDash.worldRank != null ? `World Rank: #${teamDash.worldRank}` : "Current squad"}
              </div>
            </Link>
          </div>
        ) : r.competitionRank != null ? (
          <div className="pr-coach-kpi__cell">
            <div className="pr-coach-kpi__label">{r.competitionRankLabel ?? "Competition Rank"}</div>
            <div className="pr-coach-kpi__value pr-coach-kpi__value--green">
              #{r.competitionRank}
            </div>
            <div className="pr-coach-kpi__sub">
              {r.competitionRankedOutOf != null
                ? `of ${r.competitionRankedOutOf}${r.competitionRankSub ? ` · ${r.competitionRankSub}` : ""}`
                : r.competitionRankSub ?? "—"}
            </div>
          </div>
        ) : null}
        <div className="pr-coach-kpi__cell">
          <Link
            href={`/coaches/${profile.slug}/power-index`}
            className="pr-coach-kpi__link"
            title="Current coaching strength based mainly on recent performances."
          >
            <div className="pr-coach-kpi__label">Power Index</div>
            <div className="pr-coach-kpi__value pr-coach-kpi__value--green">
              {r.powerIndex != null ? Math.round(r.powerIndex) : "—"}
            </div>
            <div className="pr-coach-kpi__sub">Current strength · /100</div>
          </Link>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Momentum</div>
          <div
            className={`pr-coach-kpi__value ${
              (r.momentum ?? 0) > 0
                ? "pr-coach-kpi__value--green"
                : (r.momentum ?? 0) < 0
                  ? ""
                  : ""
            }`}
            style={(r.momentum ?? 0) < 0 ? { color: "var(--cp-red)" } : undefined}
          >
            {(() => {
              const formMomentum = formResults
                .slice(-5)
                .reduce((sum, f) => sum + (f === "W" ? 1 : f === "L" ? -1 : 0), 0);
              const value =
                r.momentum != null && r.momentum !== 0 ? r.momentum : formMomentum;
              if (value > 0) return `↑ +${value}`;
              if (value < 0) return `↓ ${value}`;
              return "0";
            })()}
          </div>
          <div className="pr-coach-kpi__sub">
            {r.momentum != null ? "Power Index vs last" : "Form last 5"}
          </div>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Current Form</div>
          <div className="pr-coach-form">
            {formResults.length ? (
              formResults.map((f, i) => (
                <span key={`${f}-${i}`} className={f.toLowerCase()}>
                  {f}
                </span>
              ))
            ) : (
              <span style={{ color: "var(--cp-muted)" }}>—</span>
            )}
          </div>
          <div className="pr-coach-kpi__sub">Last {Math.max(formResults.length, 8)} Matches</div>
        </div>
        {!teamDash ? (
          <>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Career Win Rate</div>
          <div className="pr-coach-kpi__value pr-coach-kpi__value--green">
            {cr.winRate != null ? `${cr.winRate}%` : "—"}
          </div>
          <div className="pr-coach-kpi__sub">
            {cr.wins > 0 ? `${cr.wins} Wins` : cr.played > 0 ? `${cr.played} Matches` : "—"}
          </div>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Major Honours</div>
          <div className="pr-coach-kpi__value">
            {profile.majorHonoursCount > 0 ? profile.majorHonoursCount : "—"}
          </div>
          <div className="pr-coach-kpi__sub">
            <Link href={`/coaches/${profile.slug}/honours`}>See all</Link>
          </div>
        </div>
          </>
        ) : null}
      </div>

      {teamDash && teamHref ? (
        <CoachSquadDashboard dashboard={teamDash} teamHref={teamHref} />
      ) : null}

      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Coach Intelligence</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View full breakdown
            </Link>
          </div>
          <div className="pr-coach-card__body pr-coach-intel">
            <div className="pr-coach-intel__cols">
              <span>Metric</span>
              <span>Rating</span>
              <span>World Rank</span>
            </div>
            <div className="pr-coach-intel__list">
              {(r.intelligence?.length ? r.intelligence : r.metrics)
                .filter((m) => m.score != null)
                .map((m) => (
                <div className="pr-coach-intel__row" key={m.key}>
                  <div className="pr-coach-intel__name">{m.label}</div>
                  <div className="pr-coach-intel__barwrap">
                    <div className="pr-coach-intel__bar">
                      <i
                        className={bandClass(m.score)}
                        style={{ width: `${m.score != null ? Math.max(2, m.score) : 0}%` }}
                      />
                    </div>
                    <div className="pr-coach-intel__score">{dash(m.score != null ? Math.round(m.score) : null)}</div>
                  </div>
                  <div className="pr-coach-intel__rank">
                    {m.worldRank != null ? `#${m.worldRank}` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Career Record</h2>
            <span className="pr-coach-card__link">(All Competitions)</span>
          </div>
          <div className="pr-coach-card__body pr-coach-record">
            {cr.partial ? (
              <p className="pr-coach-empty" title="Historical coverage incomplete.">
                {cr.played} verified matches
              </p>
            ) : (
              <p className="pr-coach-empty">{cr.played} verified matches</p>
            )}
            <div className="pr-coach-record__pwdl">
              <div>
                <span>P</span>
                <strong>{cr.played}</strong>
              </div>
              <div>
                <span className="w">W</span>
                <strong className="w">{cr.wins}</strong>
              </div>
              <div>
                <span>D</span>
                <strong>{cr.draws}</strong>
              </div>
              <div>
                <span className="l">L</span>
                <strong className="l">{cr.losses}</strong>
              </div>
            </div>
            <div className="pr-coach-record__mid">
              <div className="pr-coach-record__winrate">
                <div className="pr-coach-kpi__label" style={{ textAlign: "center" }}>
                  Win Rate
                </div>
                <div
                  className="pr-coach-donut"
                  style={{ ["--pct" as string]: cr.winRate ?? 0 }}
                >
                  <div className="pr-coach-donut__inner">{cr.winRate != null ? `${cr.winRate}%` : "—"}</div>
                </div>
              </div>
              <div className="pr-coach-record__pts">
                <div>
                  <span>Points For</span>
                  <strong>{cr.pointsFor.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Points Against</span>
                  <strong>{cr.pointsAgainst.toLocaleString()}</strong>
                </div>
              </div>
            </div>
            <div className="pr-coach-record__avgs">
              <div>
                <span>Points For / Game</span>
                <strong>{dash(cr.pointsForPerGame)}</strong>
              </div>
              <div>
                <span>Points Against / Game</span>
                <strong>{dash(cr.pointsAgainstPerGame)}</strong>
              </div>
            </div>
            <div className="pr-coach-record__bottom">
              <div>
                <span>Biggest Win</span>
                <strong>
                  {cr.biggestWin ? `${cr.biggestWin.forScore} - ${cr.biggestWin.againstScore}` : "—"}
                </strong>
              </div>
              <div>
                <span>Biggest Loss</span>
                <strong>
                  {cr.biggestLoss ? `${cr.biggestLoss.forScore} - ${cr.biggestLoss.againstScore}` : "—"}
                </strong>
              </div>
              <div>
                <span>Longest Win Streak</span>
                <strong>{cr.longestWinStreak || "—"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>POWER INDEX</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/power-index`}>
              View breakdown &gt;
            </Link>
          </div>
          <div className="pr-coach-card__body pr-coach-power">
            <div className="pr-coach-power__ring" aria-label={`Power Index ${r.powerIndex != null ? Math.round(r.powerIndex) : "unavailable"} out of 100`}>
              <svg className="pr-coach-power__svg" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="pr-coach-power__track" cx="60" cy="60" r="54" />
                <circle
                  className="pr-coach-power__progress"
                  cx="60"
                  cy="60"
                  r="54"
                  style={{
                    strokeDasharray: `${ringCircumference}`,
                    strokeDashoffset: `${ringCircumference * (1 - powerPct / 100)}`,
                  }}
                />
              </svg>
              <div className="pr-coach-power__ring-inner">
                <strong>{dash(r.powerIndex != null ? Math.round(r.powerIndex) : null)}</strong>
                <span>OUT OF 100</span>
              </div>
            </div>
            <div className="pr-coach-power__cols">
              <div>
                {powerLeft.map((key) => {
                  const m = metricMap.get(key);
                  if (m?.score == null) return null;
                  return (
                    <div className="pr-coach-power__metric" key={key}>
                      <span className="label">
                        <i className={`pr-coach-power__dot ${powerBandClass(m.score)}`} />
                        {m.label ?? key}
                      </span>
                      <strong>{Math.round(m.score)}</strong>
                    </div>
                  );
                })}
              </div>
              <div>
                {powerRight.map((key) => {
                  const m = metricMap.get(key);
                  if (m?.score == null) return null;
                  const label =
                    key === "game_management"
                      ? "Game Mgmt"
                      : key === "player_development"
                        ? "Player Dev."
                        : m.label ?? key;
                  return (
                    <div className="pr-coach-power__metric" key={key}>
                      <span className="label">
                        <i className={`pr-coach-power__dot ${powerBandClass(m.score)}`} />
                        {label}
                      </span>
                      <strong>{Math.round(m.score)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--2">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Career Timeline</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/history`}>
              View full history &gt;
            </Link>
          </div>
          {profile.timeline.length === 0 ? (
            <p className="pr-coach-empty">No career periods linked yet.</p>
          ) : (
            <div className="pr-coach-timeline">
              <div className="pr-coach-timeline__track">
                {profile.timeline.map((n) => (
                  <div
                    key={n.id}
                    className={`pr-coach-timeline__node${n.isCurrent ? " is-current" : ""}${
                      n.careerType === "technical" ? " is-technical" : ""
                    }`}
                  >
                    <div className="pr-coach-timeline__year">{n.year || "—"}</div>
                    <div
                      className={`pr-coach-timeline__dot ${
                        n.careerType === "player"
                          ? "player"
                          : n.careerType === "technical"
                            ? "technical"
                            : "coach"
                      }`}
                    />
                    <div className="pr-coach-timeline__stem" aria-hidden />
                    <div className="pr-coach-timeline__crest-wrap">
                      <CareerTimelineBadge
                        teamName={n.teamName}
                        crestUrl={n.crestUrl}
                        kind={careerBadgeKindFromTimeline({
                          careerType: n.careerType,
                          role: n.role,
                        })}
                        isCurrent={n.isCurrent}
                        roleMarker={
                          n.role.toLowerCase().includes("director")
                            ? "DoR"
                            : n.role.toLowerCase() === "head coach"
                              ? "HC"
                              : null
                        }
                        title={`${n.teamName} · ${n.role} · ${n.yearsLabel}`}
                      />
                    </div>
                    <div className="pr-coach-timeline__meta">{n.yearsLabel}</div>
                    <div className="pr-coach-timeline__role">{n.role}</div>
                    <div className="pr-coach-timeline__team">{n.teamName}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="pr-coach-card pr-coach-honours-card">
          <div className="pr-coach-card__head">
            <h2>Major Honours</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/honours`}>
              View all honours &gt;
            </Link>
          </div>
          {profile.majorHonoursGrouped.length === 0 ? (
            <p className="pr-coach-empty">No major honours yet.</p>
          ) : (
            <div
              className="pr-coach-honours"
              data-count={Math.min(profile.majorHonoursGrouped.length, 4)}
            >
              {profile.majorHonoursGrouped.map((h) => (
                <div className="pr-coach-honours__tile" key={h.key}>
                  <div className="pr-coach-honours__icon" aria-hidden>
                    {h.kind === "award" ? (
                      <HonourAwardIcon size={28} variant="world" />
                    ) : (
                      <HonourTrophyIcon
                        size={28}
                        variant={h.honourLevel === "major" ? "major" : "domestic"}
                      />
                    )}
                  </div>
                  <div className="pr-coach-honours__count">{h.count}</div>
                  <div className="pr-coach-honours__label">
                    {h.label.replace(/^THE\s+/i, "")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <CoachPlayingCareer profile={profile} />

        <div className="pr-coach-stack">
          <CoachAwardsCard slug={profile.slug} awards={profile.publicAwards} />
          <CoachMedalRecordCard slug={profile.slug} medals={profile.publicMedals} />
        </div>

        <section className="pr-coach-card pr-coach-impact">
          <div className="pr-coach-card__head">
            <h2>Coach Impact</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View impact analysis &gt;
            </Link>
          </div>
          <div className="pr-coach-impact__baseline">{profile.impact.baselineLabel}</div>
          {!profile.impact.enoughData ? (
            <p className="pr-coach-empty">
              Not enough before/under tenure data yet for a Coach Impact comparison.
            </p>
          ) : (
            <table className="pr-coach-impact__table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Before</th>
                  <th scope="col">{profile.impact.underLabel}</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {profile.impact.rows.map((row) => (
                  <tr key={row.key ?? row.metric}>
                    <td>{row.metric}</td>
                    <td>{dash(row.before)}</td>
                    <td>{dash(row.under)}</td>
                    <td
                      className={
                        row.improved === true ? "up" : row.improved === false ? "down" : undefined
                      }
                    >
                      {row.changeLabel ??
                        (row.change == null
                          ? "—"
                          : typeof row.change === "number"
                            ? `${row.change > 0 ? "+" : ""}${row.change}`
                            : row.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <CoachRatingTrendsCard slug={profile.slug} initial={profile.ratingTrends} compact />

        <section className="pr-coach-card pr-coach-card--fill pr-coach-selection-stability">
          <div className="pr-coach-card__head">
            <h2>Selection Stability</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View full breakdown &gt;
            </Link>
          </div>
          {!profile.selectionStability.enoughData ? (
            <p className="pr-coach-empty">
              {profile.selectionStability.message ??
                "INSUFFICIENT SELECTION STABILITY DATA"}
            </p>
          ) : (
            <div className="pr-coach-selection-stability__body">
              <div
                className="pr-coach-selection-stability__ring"
                aria-label={`Selection Stability ${profile.selectionStability.stabilityScore ?? "unavailable"} out of 100`}
              >
                <svg className="pr-coach-power__svg" viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="pr-coach-power__track" cx="60" cy="60" r="54" />
                  <circle
                    className="pr-coach-power__progress"
                    cx="60"
                    cy="60"
                    r="54"
                    style={{
                      strokeDasharray: `${ringCircumference}`,
                      strokeDashoffset: `${ringCircumference * (1 - (profile.selectionStability.stabilityScore ?? 0) / 100)}`,
                    }}
                  />
                </svg>
                <div className="pr-coach-selection-stability__ring-inner">
                  <strong>
                    {profile.selectionStability.stabilityScore != null
                      ? Math.round(profile.selectionStability.stabilityScore)
                      : "—"}
                  </strong>
                  <span>STABILITY</span>
                  <span>SCORE</span>
                </div>
              </div>
              <dl className="pr-coach-selection-stability__metrics">
                <div>
                  <dt>Players Used</dt>
                  <dd>{profile.selectionStability.playersUsed}</dd>
                </div>
                <div>
                  <dt>Avg Changes / Match</dt>
                  <dd>{profile.selectionStability.avgStartingXvChanges ?? "—"}</dd>
                </div>
                <div>
                  <dt>Unchanged XV %</dt>
                  <dd>
                    {profile.selectionStability.unchangedXvPct != null
                      ? `${profile.selectionStability.unchangedXvPct}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Debutants</dt>
                  <dd>{profile.selectionStability.debutants}</dd>
                </div>
                {profile.selectionStability.avgStartingXvAge != null ? (
                  <div>
                    <dt>Avg Starting XV Age</dt>
                    <dd>{profile.selectionStability.avgStartingXvAge}</dd>
                  </div>
                ) : null}
                {profile.selectionStability.avgBenchAge != null ? (
                  <div>
                    <dt>Avg Bench Age</dt>
                    <dd>{profile.selectionStability.avgBenchAge}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}
        </section>

        <section className="pr-coach-card pr-coach-card--fill pr-coach-player-dev">
          <div className="pr-coach-card__head">
            <h2>Player Development</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              Top 5 Most Improved &gt;
            </Link>
          </div>
          {!profile.playerDevelopment.enoughData ? (
            <p className="pr-coach-empty">
              {profile.playerDevelopment.message ??
                "INSUFFICIENT PLAYER DEVELOPMENT DATA"}
            </p>
          ) : (
            <div className="pr-coach-player-dev__list">
              <div className="pr-coach-player-dev__cols" aria-hidden>
                <span />
                <span />
                <span title="Appearances under this coach">APPS</span>
                <span title="Rating change under coach (current − baseline)">CHG</span>
                <span title="Recent form trend">TREND</span>
              </div>
              {profile.playerDevelopment.mostImproved.map((row) => {
                const change = row.displayedChange ?? row.delta ?? 0;
                const href = row.playerSlug ? `/players/${row.playerSlug}` : undefined;
                const trendSymbol =
                  row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—";
                const inner = (
                  <>
                    {row.playerImageUrl ? (
                      <CoachProfileAssetImage
                        src={row.playerImageUrl}
                        className="pr-coach-player-dev__photo"
                        width={28}
                        height={28}
                        fallbackClassName="pr-coach-player-dev__photo-fallback"
                      />
                    ) : (
                      <span className="pr-coach-player-dev__photo-fallback" aria-hidden />
                    )}
                    <span className="pr-coach-player-dev__name">{row.playerName}</span>
                    <span className="pr-coach-player-dev__apps">{row.appearances}</span>
                    <span
                      className={`pr-coach-player-dev__change${
                        change > 0 ? " is-up" : change < 0 ? " is-down" : ""
                      }`}
                    >
                      {change > 0 ? "+" : ""}
                      {change.toFixed(1)}
                    </span>
                    <span
                      className={`pr-coach-player-dev__trend is-${row.trend ?? "stable"}`}
                      aria-label={
                        row.trend === "up"
                          ? "Improving recently"
                          : row.trend === "down"
                            ? "Declining recently"
                            : "Stable recently"
                      }
                    >
                      {trendSymbol}
                    </span>
                    <span className="pr-coach-player-dev__tip" aria-hidden>
                      <span className="pr-coach-player-dev__tip-name">{row.playerName}</span>
                      {row.position ? (
                        <span className="pr-coach-player-dev__tip-pos">{row.position}</span>
                      ) : null}
                      <span>Apps under coach · {row.appearances}</span>
                      <span>
                        Baseline · {row.baselineRating != null ? row.baselineRating.toFixed(1) : "—"}
                      </span>
                      <span>
                        Current · {row.currentRating != null ? row.currentRating.toFixed(1) : "—"}
                      </span>
                      <span>
                        Change · {change > 0 ? "+" : ""}
                        {change.toFixed(1)}
                      </span>
                      <span>
                        Recent trend · {trendSymbol}
                        {row.trendDelta != null
                          ? ` ${row.trendDelta > 0 ? "+" : ""}${row.trendDelta}`
                          : ""}
                      </span>
                      <span>Debut under coach · {row.debutGiven ? "Yes" : "No"}</span>
                      <span>
                        Career high under coach · {row.careerHighUnderCoach ? "Yes" : "No"}
                      </span>
                      <span>Confidence · {row.confidence ?? "—"}</span>
                      {href ? (
                        <span className="pr-coach-player-dev__tip-cta">View Player Profile &gt;</span>
                      ) : null}
                    </span>
                  </>
                );
                return href ? (
                  <Link
                    key={row.playerId}
                    href={href}
                    className="pr-coach-player-dev__row"
                    aria-label={`${row.playerName} player profile`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={row.playerId} className="pr-coach-player-dev__row">
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card pr-coach-card--fill pr-coach-recent-results">
          <div className="pr-coach-card__head">
            <h2>Recent Results</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/matches`}>
              View all matches &gt;
            </Link>
          </div>
          {profile.recentMatches.length === 0 ? (
            <p className="pr-coach-empty">No recent matches linked.</p>
          ) : (
            <div className="pr-coach-recent-results__list">
              {profile.recentMatches.map((m) => {
                const kickoff = formatCoachResultKickoff(m.kickoffAt);
                const href = m.href;
                const inner = (
                  <>
                    <time className="pr-coach-recent-row__date" dateTime={m.kickoffAt ?? undefined}>
                      <span className="pr-coach-recent-row__date-full">
                        {formatCoachResultDate(m.kickoffAt)}
                      </span>
                      <span className="pr-coach-recent-row__date-short">
                        {formatCoachResultDateMobile(m.kickoffAt)}
                      </span>
                    </time>
                    <span className="pr-coach-recent-row__opp">
                      {m.opponentCrestUrl ? (
                        <CoachProfileAssetImage
                          src={m.opponentCrestUrl}
                          className="pr-coach-recent-row__crest"
                          width={22}
                          height={22}
                          fallbackClassName="pr-coach-recent-row__crest-fallback"
                        />
                      ) : (
                        <span className="pr-coach-recent-row__crest-fallback" aria-hidden />
                      )}
                      <span className="pr-coach-recent-row__opp-name">
                        {m.opponentName ?? "—"}
                      </span>
                      <span className="pr-coach-recent-row__ha-mobile" aria-hidden>
                        {m.venueType}
                      </span>
                    </span>
                    <span
                      className="pr-coach-recent-row__ha"
                      title={
                        m.venueType === "H" ? "Home" : m.venueType === "A" ? "Away" : "Neutral"
                      }
                    >
                      {m.venueType ?? "—"}
                    </span>
                    <span className="pr-coach-recent-row__score">
                      {m.pointsFor != null && m.pointsAgainst != null
                        ? `${m.pointsFor}–${m.pointsAgainst}`
                        : "—"}
                    </span>
                    <span
                      className={`pr-coach-recent-row__badge ${
                        m.result ? `is-${m.result.toLowerCase()}` : ""
                      }`}
                    >
                      {m.result ?? "—"}
                    </span>
                    <span className="pr-coach-recent-row__tip" aria-hidden>
                      {m.competitionName ? (
                        <span className="pr-coach-recent-row__tip-comp">{m.competitionName}</span>
                      ) : null}
                      <span className="pr-coach-recent-row__tip-date">
                        {formatCoachResultDetailDate(m.kickoffAt)}
                        {kickoff ? ` · ${kickoff}` : ""}
                      </span>
                      <span className="pr-coach-recent-row__tip-scoreline">
                        {m.homeTeamName ?? "Home"} {m.homeScore}–{m.awayScore}{" "}
                        {m.awayTeamName ?? "Away"}
                      </span>
                      {m.venueName ? (
                        <span className="pr-coach-recent-row__tip-venue">Venue · {m.venueName}</span>
                      ) : null}
                      {m.attendance != null && m.attendance > 0 ? (
                        <span className="pr-coach-recent-row__tip-venue">
                          Attendance · {m.attendance.toLocaleString()}
                        </span>
                      ) : null}
                      {m.manOfTheMatch ? (
                        <span className="pr-coach-recent-row__tip-venue">MOTM · {m.manOfTheMatch}</span>
                      ) : null}
                      <span className="pr-coach-recent-row__tip-coach">
                        {profile.displayName}
                        {profile.currentRole?.roleLabel
                          ? ` · ${profile.currentRole.roleLabel}`
                          : ""}
                      </span>
                      {href ? (
                        <span className="pr-coach-recent-row__tip-cta">View Match Centre &gt;</span>
                      ) : null}
                    </span>
                  </>
                );
                return href ? (
                  <Link
                    key={m.id}
                    href={href}
                    className="pr-coach-recent-row"
                    aria-label={`Match centre: ${m.opponentName ?? "match"}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={m.id} className="pr-coach-recent-row">
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="pr-coach-card pr-coach-card--fill pr-coach-upcoming">
          <div className="pr-coach-card__head">
            <h2>Upcoming Match</h2>
          </div>
          {!profile.upcomingMatch ? (
            <p className="pr-coach-empty">No upcoming match</p>
          ) : (
            <div className="pr-coach-upcoming__panel">
              {profile.upcomingMatch.competitionName ? (
                <div className="pr-coach-upcoming__comp">{profile.upcomingMatch.competitionName}</div>
              ) : null}
              <div className="pr-coach-upcoming__teams">
                <div className="pr-coach-upcoming__side">
                  {profile.upcomingMatch.homeTeamCrestUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.upcomingMatch.homeTeamCrestUrl}
                      alt=""
                      width={56}
                      height={56}
                    />
                  ) : (
                    <span className="pr-coach-upcoming__crest-fallback" aria-hidden />
                  )}
                  <div className="pr-coach-upcoming__team-name">
                    {profile.upcomingMatch.homeTeamName ?? "TBC"}
                  </div>
                </div>
                <div className="pr-coach-upcoming__vs">VS</div>
                <div className="pr-coach-upcoming__side">
                  {profile.upcomingMatch.awayTeamCrestUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.upcomingMatch.awayTeamCrestUrl}
                      alt=""
                      width={56}
                      height={56}
                    />
                  ) : (
                    <span className="pr-coach-upcoming__crest-fallback" aria-hidden />
                  )}
                  <div className="pr-coach-upcoming__team-name">
                    {profile.upcomingMatch.awayTeamName ?? "TBC"}
                  </div>
                </div>
              </div>
              {(() => {
                const kickoff = profile.upcomingMatch!.kickoffAt
                  ? new Date(profile.upcomingMatch!.kickoffAt)
                  : null;
                const valid = kickoff && !Number.isNaN(kickoff.getTime());
                const dateLabel = valid
                  ? kickoff.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Date TBC";
                const timeLabel = valid
                  ? kickoff.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZoneName: "short",
                    })
                  : null;
                return (
                  <div className="pr-coach-upcoming__meta">
                    <div className="pr-coach-upcoming__date">{dateLabel}</div>
                    {timeLabel ? <div className="pr-coach-upcoming__time">{timeLabel}</div> : null}
                    {profile.upcomingMatch!.venueName ? (
                      <div className="pr-coach-upcoming__venue">{profile.upcomingMatch!.venueName}</div>
                    ) : null}
                  </div>
                );
              })()}
              <Link
                className="pr-coach-upcoming__cta"
                href={profile.upcomingMatch.href ?? `/matches/${profile.upcomingMatch.slug}`}
              >
                Match Centre
              </Link>
            </div>
          )}
        </section>

        <section className="pr-coach-card pr-coach-card--fill pr-coach-world-rankings">
          <div className="pr-coach-card__head">
            <h2>World Rankings (Coaches)</h2>
            <Link className="pr-coach-card__link" href="/rankings/coaches">
              View full rankings &gt;
            </Link>
          </div>
          {profile.worldRankings.length === 0 ? (
            <p className="pr-coach-empty">
              Rankings appear once eligible coaches have a published Rugby365 Coach Rating.
            </p>
          ) : (
            (() => {
              const top5 = profile.worldRankings.slice(0, 5);
              const self = profile.worldRankings.find((r) => r.coachId === profile.id);
              const selfOutside = self && self.rank > 5 ? self : null;
              const rows = selfOutside ? [...top5, selfOutside] : top5;
              return (
                <div className="pr-coach-world-rankings__list">
                  {rows.map((row, idx) => {
                    const isSelf = row.coachId === profile.id;
                    const showEllipsis = Boolean(selfOutside && idx === top5.length);
                    const change = row.rankChange;
                    return (
                      <div key={`${row.coachId}-${row.rank}`}>
                        {showEllipsis ? (
                          <div className="pr-coach-world-rankings__ellipsis" aria-hidden>
                            …
                          </div>
                        ) : null}
                        <Link
                          href={`/coaches/${row.slug}`}
                          className={`pr-coach-world-rankings__row${isSelf ? " is-self" : ""}`}
                          aria-label={`${row.name} coach profile`}
                        >
                          <span className="pr-coach-world-rankings__rank">{row.rank}</span>
                          {row.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="pr-coach-world-rankings__img"
                              src={row.imageUrl}
                              alt=""
                            />
                          ) : (
                            <span className="pr-coach-world-rankings__img pr-coach-world-rankings__img--empty" />
                          )}
                          <span className="pr-coach-world-rankings__identity">
                            <span className="pr-coach-world-rankings__name">{row.name}</span>
                            <span className="pr-coach-world-rankings__team">
                              {row.currentTeamName ?? "—"}
                            </span>
                          </span>
                          <span className="pr-coach-world-rankings__rating">
                            {row.rating.toFixed(1)}
                          </span>
                          <span
                            className={`pr-coach-world-rankings__move${
                              change != null && change > 0
                                ? " is-up"
                                : change != null && change < 0
                                  ? " is-down"
                                  : ""
                            }`}
                            title={
                              change == null
                                ? "No previous ranking snapshot"
                                : change === 0
                                  ? "Unchanged"
                                  : change > 0
                                    ? `Up ${change}`
                                    : `Down ${Math.abs(change)}`
                            }
                          >
                            {change == null || change === 0
                              ? "—"
                              : change > 0
                                ? `↑${change > 1 ? change : ""}`
                                : `↓${Math.abs(change) > 1 ? Math.abs(change) : ""}`}
                          </span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </section>
      </div>

      <footer className="pr-coach-footer">
        <span>
          Rugby365 Coach Rating {r.modelVersion} · Power Index {r.powerIndexVersion}. Calculated from
          verified match data where available.
        </span>
        <span title="Based on match, team-stat, player-rating, and historical ranking coverage">
          Confidence: {r.dataConfidence}
          {typeof r.ratingConfidencePct === "number" ? ` (${r.ratingConfidencePct}%)` : ""}
        </span>
      </footer>
    </article>
  );
}
