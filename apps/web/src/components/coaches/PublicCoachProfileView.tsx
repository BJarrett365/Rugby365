import Link from "next/link";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { scoreBandColor } from "@/lib/coach-rating-service";
import { formatPublicDate, formatPublicKickoff } from "@/lib/public-entity-profile-utils";
import { PublicEntityPreviewBanner } from "@/components/entities/PublicEntityProfileBits";
import { CoachPlayingCareer } from "./CoachPlayingCareer";
import { CoachCareerSnapshot } from "./CoachCareerSnapshot";
import { isCoachAssessment } from "@/lib/coach-field-provenance";

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

/** Two-line hero name matching approved composition (e.g. JOHAN "RASSIE" / ERASMUS). */
function heroNameLines(profile: PublicCoachProfile): { line1: string; line2: string } {
  const knownAs = profile.knownAs?.trim();
  const fullName = profile.fullName?.trim();
  if (knownAs && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const last = parts.at(-1) ?? "";
    const first = parts.slice(0, -1).join(" ");
    if (first && last) {
      return {
        line1: `${first} "${knownAs}"`.toUpperCase(),
        line2: last.toUpperCase(),
      };
    }
  }
  const words = profile.displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return {
      line1: words.slice(0, -1).join(" "),
      line2: words[words.length - 1]!,
    };
  }
  return { line1: profile.displayName, line2: "" };
}

const NAV: Array<{ id: string; label: string; href?: string }> = [
  { id: "overview", label: "Overview" },
  { id: "career", label: "Career", href: "career" },
  { id: "stats", label: "Stats", href: "stats" },
  { id: "honours", label: "Honours", href: "honours" },
  { id: "history", label: "History", href: "history" },
  { id: "matches", label: "Matches", href: "matches" },
  { id: "h2h", label: "Head-to-Head", href: "compare" },
  { id: "rankings", label: "Rankings" },
  { id: "news", label: "News" },
];

export function PublicCoachProfileView({ profile }: { profile: PublicCoachProfile }) {
  const r = profile.ratings;
  const cr = profile.careerRecord;
  const powerMetrics = [
    "results",
    "attack",
    "defence",
    "set_piece",
    "breakdown",
    "kicking",
    "discipline",
    "selection",
    "game_management",
    "player_development",
    "experience",
    "current_form",
  ] as const;

  const powerLeft = powerMetrics.slice(0, 6);
  const powerRight = powerMetrics.slice(6);
  const metricMap = new Map(r.metrics.map((m) => [m.key, m]));

  const historyPoints = profile.ratingHistory;
  const chartPath = (() => {
    if (historyPoints.length < 2) return "";
    const vals = historyPoints.map((p) => p.rating);
    const min = Math.min(...vals, 50);
    const max = Math.max(...vals, 100);
    const w = 300;
    const h = 120;
    return historyPoints
      .map((p, i) => {
        const x = (i / (historyPoints.length - 1)) * w;
        const y = h - ((p.rating - min) / Math.max(1, max - min)) * (h - 10) - 5;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  })();

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
          const href = item.href ? `/coaches/${profile.slug}/${item.href}` : `#${item.id}`;
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
                {/south africa/i.test(profile.nationality) ? (
                  <span className="pr-coach-hero__flag" aria-hidden>
                    🇿🇦
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

      <div className="pr-coach-kpi">
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Rugby365 Rating</div>
          <div className="pr-coach-kpi__value">
            {r.overallRating != null ? r.overallRating.toFixed(1) : "—"}
          </div>
          <div className="pr-coach-kpi__stars">{stars(r.overallRating)}</div>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">World Rank</div>
          <div className="pr-coach-kpi__value pr-coach-kpi__value--green">
            {r.worldRank != null ? `#${r.worldRank}` : "—"}
          </div>
          <div className="pr-coach-kpi__sub">
            {r.rankedOutOf != null ? `Out of ${r.rankedOutOf}` : r.provisional ? "Provisional" : "—"}
          </div>
        </div>
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
          <div className="pr-coach-kpi__label">Power Index</div>
          <div className="pr-coach-kpi__value pr-coach-kpi__value--green">{dash(r.powerIndex)}</div>
          <div className="pr-coach-kpi__sub">Out of 100</div>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Momentum</div>
          <div
            className={`pr-coach-kpi__value ${
              r.momentum != null && r.momentum > 0
                ? "pr-coach-kpi__value--green"
                : r.momentum != null && r.momentum < 0
                  ? ""
                  : ""
            }`}
            style={r.momentum != null && r.momentum < 0 ? { color: "var(--cp-red)" } : undefined}
          >
            {r.momentum == null ? "—" : r.momentum > 0 ? `↑ +${r.momentum}` : r.momentum < 0 ? `↓ ${r.momentum}` : "— 0"}
          </div>
          <div className="pr-coach-kpi__sub">vs last cycle</div>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Current Form</div>
          <div className="pr-coach-form">
            {cr.form.length ? (
              cr.form.map((f, i) => (
                <span key={`${f}-${i}`} className={f.toLowerCase()}>
                  {f}
                </span>
              ))
            ) : (
              <span style={{ color: "var(--cp-muted)" }}>—</span>
            )}
          </div>
          <div className="pr-coach-kpi__sub">Last {Math.max(cr.form.length, 8)} Matches</div>
        </div>
        <div className="pr-coach-kpi__cell">
          <div className="pr-coach-kpi__label">Major Honours</div>
          <div className="pr-coach-kpi__value">
            {profile.majorHonoursGrouped
              .filter((g) => g.kind === "honour" && (g.honourLevel === "major" || g.honourLevel === "domestic_major"))
              .reduce((s, g) => s + g.count, 0) || profile.majorHonoursGrouped.reduce((s, g) => s + (g.kind === "honour" ? g.count : 0), 0) || "—"}
          </div>
          <div className="pr-coach-kpi__sub">
            <Link href={`/coaches/${profile.slug}/honours`}>See all</Link>
          </div>
        </div>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Coach Intelligence</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View full breakdown
            </Link>
          </div>
          <div className="pr-coach-intel__cols">
            <span>Metric</span>
            <span>Rating</span>
            <span>World Rank</span>
          </div>
          {r.metrics.map((m) => (
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
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Career Record</h2>
            <span className="pr-coach-card__link">(All Competitions)</span>
          </div>
          {cr.partial ? <p className="pr-coach-empty">Partial record — verified Rugby365 matches only.</p> : null}
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
            <div>
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
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Power Index</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View breakdown &gt;
            </Link>
          </div>
          <div className="pr-coach-power__ring" style={{ ["--pct" as string]: r.powerIndex ?? 0 }}>
            <div className="pr-coach-power__ring-inner">
              <strong>{dash(r.powerIndex != null ? Math.round(r.powerIndex) : null)}</strong>
              <span>Out of 100</span>
            </div>
          </div>
          <div className="pr-coach-power__cols">
            <div>
              {powerLeft.map((key) => {
                const m = metricMap.get(key);
                return (
                  <div className="pr-coach-power__metric" key={key}>
                    <span className="label">
                      <i className={`pr-coach-power__dot ${bandClass(m?.score ?? null)}`} />
                      {m?.label ?? key}
                    </span>
                    <strong>{dash(m?.score != null ? Math.round(m.score) : null)}</strong>
                  </div>
                );
              })}
            </div>
            <div>
              {powerRight.map((key) => {
                const m = metricMap.get(key);
                const label =
                  key === "game_management"
                    ? "Game Mgmt"
                    : key === "player_development"
                      ? "Player Dev."
                      : m?.label ?? key;
                return (
                  <div className="pr-coach-power__metric" key={key}>
                    <span className="label">
                      <i className={`pr-coach-power__dot ${bandClass(m?.score ?? null)}`} />
                      {label}
                    </span>
                    <strong>{dash(m?.score != null ? Math.round(m.score) : null)}</strong>
                  </div>
                );
              })}
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
                    className={`pr-coach-timeline__node${n.isCurrent ? " is-current" : ""}`}
                  >
                    <div className="pr-coach-timeline__year">{n.year || "—"}</div>
                    <div
                      className={`pr-coach-timeline__dot ${
                        n.careerType === "player" ? "" : "coach"
                      }`}
                    />
                    {n.crestUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="pr-coach-timeline__crest" src={n.crestUrl} alt="" />
                    ) : (
                      <div className="pr-coach-timeline__crest" />
                    )}
                    <div className="pr-coach-timeline__meta">{n.yearsLabel}</div>
                    <div className="pr-coach-timeline__role">{n.role}</div>
                    <div className="pr-coach-timeline__meta">{n.teamName}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Major Honours</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/honours`}>
              View all honours &gt;
            </Link>
          </div>
          {profile.majorHonoursGrouped.length === 0 ? (
            <p className="pr-coach-empty">No major honours yet.</p>
          ) : (
            <div className="pr-coach-honours">
              {profile.majorHonoursGrouped.map((h) => (
                <div className="pr-coach-honours__tile" key={h.key}>
                  <div className="pr-coach-honours__icon">{h.kind === "award" ? "🏅" : "🏆"}</div>
                  <div className="pr-coach-honours__count">{h.count}</div>
                  <div className="pr-coach-honours__label">{h.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <CoachPlayingCareer profile={profile} />

        <div className="pr-coach-stack">
          <section className="pr-coach-card">
            <div className="pr-coach-card__head">
              <h2>Awards</h2>
              <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/honours`}>
                View all awards &gt;
              </Link>
            </div>
            {profile.awards.length === 0 ? (
              <p className="pr-coach-empty">No individual awards recorded.</p>
            ) : (
              profile.awards.slice(0, 4).map((a) => (
                <div className="pr-coach-award-row" key={a.id}>
                  <span>{a.year ?? "—"}</span>
                  <span>
                    {[a.awardingBody, a.awardName].filter(Boolean).join(" ")}
                  </span>
                  <span className="pr-coach-tag">{(a.result || "winner").toUpperCase()}</span>
                </div>
              ))
            )}
          </section>
          <section className="pr-coach-card">
            <div className="pr-coach-card__head">
              <h2>Medal Record</h2>
              <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/honours`}>
                View all medals &gt;
              </Link>
            </div>
            {profile.medals.length === 0 ? (
              <p className="pr-coach-empty">No medal record yet.</p>
            ) : (
              <>
                {["player", "coach"].map((role) => {
                  const rows = profile.medals.filter((m) => m.roleType === role);
                  if (!rows.length) return null;
                  return (
                    <div key={role}>
                      <div className="pr-coach-kpi__label" style={{ margin: "0.35rem 0" }}>
                        As {role}
                      </div>
                      {rows.map((m) => (
                        <div className="pr-coach-medal-row" key={m.id}>
                          <span>{m.year ?? "—"}</span>
                          <span>
                            {m.competitionName} · {m.finish}
                          </span>
                          <span>
                            {m.medalType === "gold"
                              ? "🥇"
                              : m.medalType === "silver"
                                ? "🥈"
                                : m.medalType === "bronze"
                                  ? "🥉"
                                  : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </section>
        </div>

        <section className="pr-coach-card pr-coach-impact">
          <div className="pr-coach-card__head">
            <h2>Coach Impact</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View impact analysis &gt;
            </Link>
          </div>
          <div className="pr-coach-card__link" style={{ marginBottom: "0.65rem" }}>
            {profile.impact.baselineLabel}
          </div>
          {!profile.impact.enoughData ? (
            <p className="pr-coach-empty">Not enough data yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Before</th>
                  <th>Under Coach</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {profile.impact.rows.map((row) => (
                  <tr key={row.metric}>
                    <td>{row.metric}</td>
                    <td>{dash(row.before)}</td>
                    <td className={row.improved ? "up" : undefined}>{dash(row.under)}</td>
                    <td className={row.improved === true ? "up" : row.improved === false ? "down" : undefined}>
                      {row.change == null
                        ? "—"
                        : typeof row.change === "number"
                          ? `${row.change > 0 ? "+" : ""}${row.change}`
                          : row.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Rating Trends</h2>
            <span className="pr-coach-card__link">Last 24</span>
          </div>
          {historyPoints.length < 2 ? (
            <p className="pr-coach-empty">Insufficient rating history.</p>
          ) : (
            <div className="pr-coach-chart">
              <svg viewBox="0 0 300 120" preserveAspectRatio="none">
                <path d={chartPath} fill="none" stroke="#22c55e" strokeWidth="2" />
              </svg>
            </div>
          )}
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Selection Stability</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              View full breakdown &gt;
            </Link>
          </div>
          <p className="pr-coach-empty">
            Insufficient verified lineup change data for a stability score.
          </p>
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Player Development</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              Top 5 Most Improved &gt;
            </Link>
          </div>
          <p className="pr-coach-empty">
            Insufficient historical player ratings under this coach.
          </p>
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Recent Results</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/matches`}>
              View all matches &gt;
            </Link>
          </div>
          {profile.recentMatches.length === 0 ? (
            <p className="pr-coach-empty">No recent matches linked.</p>
          ) : (
            profile.recentMatches.map((m) => {
              const team = m.side === "home" ? m.homeTeamName : m.awayTeamName;
              const opp = m.side === "home" ? m.awayTeamName : m.homeTeamName;
              return (
                <Link key={m.id} href={`/matches/${m.slug}`} className="pr-coach-result-row">
                  <span>{formatPublicKickoff(m.kickoffAt)}</span>
                  <span>{team ?? "—"}</span>
                  <span>
                    {m.homeScore} - {m.awayScore}
                  </span>
                  <span className="opp">{opp ?? "—"}</span>
                  <span className={`pr-coach-form`}>
                    {m.result ? <span className={m.result.toLowerCase()}>{m.result}</span> : "—"}
                  </span>
                </Link>
              );
            })
          )}
        </section>

        <section className="pr-coach-card pr-coach-upcoming">
          <div className="pr-coach-card__head">
            <h2>Upcoming Match</h2>
          </div>
          {!profile.upcomingMatch ? (
            <p className="pr-coach-empty">No upcoming match</p>
          ) : (
            <>
              <div className="pr-coach-upcoming__comp">{profile.upcomingMatch.competitionName}</div>
              <div className="pr-coach-upcoming__teams">
                <div>
                  {profile.upcomingMatch.homeTeamCrestUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.upcomingMatch.homeTeamCrestUrl} alt="" />
                  ) : null}
                  <div>{profile.upcomingMatch.homeTeamName}</div>
                </div>
                <div>VS</div>
                <div>
                  {profile.upcomingMatch.awayTeamCrestUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.upcomingMatch.awayTeamCrestUrl} alt="" />
                  ) : null}
                  <div>{profile.upcomingMatch.awayTeamName}</div>
                </div>
              </div>
              <div>{formatPublicKickoff(profile.upcomingMatch.kickoffAt)}</div>
              <div className="pr-coach-empty">{profile.upcomingMatch.venueName ?? ""}</div>
              <Link className="pr-coach-upcoming__cta" href={`/matches/${profile.upcomingMatch.slug}`}>
                Match Centre
              </Link>
            </>
          )}
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>World Rankings (Coaches)</h2>
            <Link className="pr-coach-card__link" href="/coaches/rankings">
              View full rankings &gt;
            </Link>
          </div>
          {profile.worldRankings.length === 0 ? (
            <p className="pr-coach-empty">Rankings will appear after rating snapshots are calculated.</p>
          ) : (
            profile.worldRankings.map((row) => (
              <Link
                key={row.coachId}
                href={`/coaches/${row.slug}`}
                className="pr-coach-rank-row"
                style={
                  row.coachId === profile.id
                    ? { background: "rgba(34,197,94,0.08)", borderRadius: 6, padding: "0.4rem" }
                    : undefined
                }
              >
                <strong>{row.rank}</strong>
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pr-coach-avatar" src={row.imageUrl} alt="" />
                ) : (
                  <span className="pr-coach-avatar" />
                )}
                <span>
                  {row.name}
                  <div className="pr-coach-empty">{row.nationality ?? ""}</div>
                </span>
                <strong>{row.rating.toFixed(1)}</strong>
                <span style={{ color: row.movement && row.movement > 0 ? "var(--cp-green)" : undefined }}>
                  {row.movement == null || row.movement === 0 ? "—" : row.movement > 0 ? "↑" : "↓"}
                </span>
              </Link>
            ))
          )}
        </section>
      </div>

      <footer className="pr-coach-footer">
        <span>
          Rugby365 Coach Rating {r.modelVersion} · Power Index {r.powerIndexVersion}. Calculated from
          verified match data where available.
        </span>
        <span>Confidence: {r.dataConfidence}</span>
      </footer>
    </article>
  );
}
