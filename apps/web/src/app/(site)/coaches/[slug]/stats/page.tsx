import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";
import { getCoachCareerRecord } from "@/lib/coach-career-record-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Stats | Coach | Rugby365`, description: `Stats and ratings for ${slug}` };
}

export default async function CoachStatsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  const record = await getCoachCareerRecord(profile.id);
  const r = profile.ratings;

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="stats" />
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Stats & ratings</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
        </header>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Career record</h2>
          </div>
          <ul className="pr-coach-list">
            <li>
              Played: {record.played} (W{record.wins} D{record.draws} L{record.losses})
            </li>
            <li>Win rate: {record.winRate != null ? `${record.winRate.toFixed(1)}%` : "—"}</li>
            <li>
              Points for / against: {record.pointsFor} / {record.pointsAgainst}
            </li>
            <li>
              PF/G · PA/G:{" "}
              {record.pointsForPerGame != null ? record.pointsForPerGame.toFixed(1) : "—"} ·{" "}
              {record.pointsAgainstPerGame != null
                ? record.pointsAgainstPerGame.toFixed(1)
                : "—"}
            </li>
            <li>
              Streaks: longest win {record.longestWinStreak}, current {record.currentWinStreak}
            </li>
            <li>Form: {record.form.length ? record.form.join(" ") : "—"}</li>
          </ul>
        </section>

        <section className="pr-coach-card mb-4" id="coach-rating">
          <div className="pr-coach-card__head">
            <h2>RUGBY365 COACH RATING</h2>
          </div>
          <ul className="pr-coach-list">
            <li>
              Score: {r.overallRating != null ? r.overallRating.toFixed(1) : "—"} / 100
            </li>
            <li>
              Change:{" "}
              {r.overallRatingChange == null
                ? "—"
                : r.overallRatingChange > 0
                  ? `+${r.overallRatingChange}`
                  : r.overallRatingChange}
              {r.previousOverallRating != null
                ? ` (was ${r.previousOverallRating.toFixed(1)})`
                : ""}
            </li>
            <li>
              World Rank: {r.worldRank != null ? `#${r.worldRank}` : "—"}
              {r.rankedOutOf != null ? ` of ${r.rankedOutOf}` : ""}
              {r.worldRankChange != null
                ? r.worldRankChange > 0
                  ? ` · ↑${r.worldRankChange}`
                  : r.worldRankChange < 0
                    ? ` · ↓${Math.abs(r.worldRankChange)}`
                    : ""
                : ""}
            </li>
            <li>
              Confidence:{" "}
              {r.coachRatingDetail
                ? `${r.coachRatingDetail.confidence}% (${r.coachRatingDetail.confidenceBand})`
                : "—"}
            </li>
            <li>
              Coverage:{" "}
              {r.coachRatingDetail ? `${r.coachRatingDetail.weightedCoverage}% weighted` : "—"}
            </li>
            <li>Version: {r.modelVersion}</li>
          </ul>
          {r.coachRatingDetail?.contributions?.length ? (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}>WHY THIS RATING</h3>
              <ul className="pr-coach-list">
                {r.coachRatingDetail.contributions.map((c) => (
                  <li key={c.key}>
                    {c.label}: {Math.round(c.score)} · {c.weight}% → {c.contribution.toFixed(1)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="pr-coach-card mb-4" id="power-index">
          <div className="pr-coach-card__head">
            <h2>POWER INDEX</h2>
          </div>
          <ul className="pr-coach-list">
            <li>
              Score:{" "}
              {r.powerIndex != null ? Math.round(r.powerIndex) : "—"}
              {r.powerIndexDetail?.baseScore != null
                ? ` (base ${r.powerIndexDetail.baseScore}`
                : ""}
              {r.powerIndexDetail?.modifierTotal != null
                ? ` + modifiers ${r.powerIndexDetail.modifierTotal >= 0 ? "+" : ""}${r.powerIndexDetail.modifierTotal})`
                : r.powerIndexDetail?.baseScore != null
                  ? ")"
                  : ""}
            </li>
            <li>
              Change:{" "}
              {r.powerIndexChange == null
                ? "—"
                : r.powerIndexChange > 0
                  ? `+${r.powerIndexChange}`
                  : r.powerIndexChange}
              {r.previousPowerIndex != null ? ` (was ${Math.round(r.previousPowerIndex)})` : ""}
            </li>
            <li>World rank: {r.worldRank != null ? `#${r.worldRank}` : "—"}</li>
            <li>
              Confidence:{" "}
              {r.powerIndexDetail
                ? `${r.powerIndexDetail.confidence}% (${r.powerIndexDetail.confidenceBand})`
                : "—"}
            </li>
            <li>Matches: {r.powerIndexDetail?.matchesUsed ?? r.matchCount}</li>
            <li>
              Coverage:{" "}
              {r.powerIndexDetail
                ? `${r.powerIndexDetail.weightedCoverage}% weighted`
                : "—"}
            </li>
            <li>Version: {r.powerIndexVersion}</li>
          </ul>
          {r.powerIndexDetail?.contributions?.length ? (
            <div className="pr-coach-intel" style={{ marginTop: "1rem" }}>
              <div
                className="pr-coach-intel__cols"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.5fr 0.5fr 0.7fr 0.5fr 0.6fr",
                  gap: "0.35rem",
                  fontSize: "0.7rem",
                  opacity: 0.7,
                }}
              >
                <span>Metric</span>
                <span>Score</span>
                <span>Weight</span>
                <span>Contribution</span>
                <span>Trend</span>
                <span>Confidence</span>
              </div>
              <div className="pr-coach-intel__list">
                {r.powerIndexDetail.contributions.map((c) => (
                  <div
                    key={c.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 0.5fr 0.5fr 0.7fr 0.5fr 0.6fr",
                      gap: "0.35rem",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      padding: "0.35rem 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="pr-coach-intel__name">{c.label}</div>
                    <div>{Math.round(c.score)}</div>
                    <div>{c.weight}%</div>
                    <div>{c.contribution.toFixed(1)}</div>
                    <div>
                      {c.trend == null || c.trend === 0
                        ? "—"
                        : c.trend > 0
                          ? `↑${c.trend}`
                          : `↓${Math.abs(c.trend)}`}
                    </div>
                    <div>{c.confidence}%</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {r.powerIndexDetail?.modifiers?.length ? (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}>MODIFIERS</h3>
              <ul className="pr-coach-list">
                {r.powerIndexDetail.modifiers.map((m) => (
                  <li key={m.key}>
                    {m.label}:{" "}
                    {m.effect > 0 ? `+${m.effect}` : m.effect}
                    {m.sourceScore != null ? ` (source ${Math.round(m.sourceScore)})` : ""}
                  </li>
                ))}
                <li>
                  Total Modifier:{" "}
                  {r.powerIndexDetail.modifierTotal > 0
                    ? `+${r.powerIndexDetail.modifierTotal}`
                    : r.powerIndexDetail.modifierTotal}
                </li>
              </ul>
            </div>
          ) : null}
          {r.powerIndexMismatches?.length ? (
            <p className="pr-coach-empty" style={{ color: "var(--cp-red, #ef4444)" }}>
              INTELLIGENCE SCORE MISMATCH on:{" "}
              {r.powerIndexMismatches.map((m) => m.key).join(", ")}
            </p>
          ) : null}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Coach Intelligence</h2>
          </div>
          <ul className="pr-coach-list">
            <li>Overall: {r.overallRating != null ? r.overallRating.toFixed(1) : "—"}</li>
            <li>World rank: {r.worldRank ?? "—"}</li>
            <li>
              Confidence: {r.dataConfidence}
              {typeof r.ratingConfidencePct === "number" ? ` (${r.ratingConfidencePct}%)` : ""}
            </li>
            <li>Model: {r.intelligenceModelVersion ?? r.modelVersion}</li>
          </ul>
          {(r.intelligence?.length ? r.intelligence : r.metrics).length > 0 ? (
            <div className="pr-coach-intel" style={{ marginTop: "1rem" }}>
              <div className="pr-coach-intel__cols">
                <span>Metric</span>
                <span>Rating</span>
                <span>World Rank</span>
              </div>
              <div className="pr-coach-intel__list">
                {(r.intelligence?.length ? r.intelligence : r.metrics).map((m) => {
                  const score = m.score;
                  const confidence =
                    "confidence" in m && typeof (m as { confidence?: number }).confidence === "number"
                      ? (m as { confidence: number }).confidence
                      : null;
                  const sampleSize =
                    "sampleSize" in m && typeof (m as { sampleSize?: number }).sampleSize === "number"
                      ? (m as { sampleSize: number }).sampleSize
                      : null;
                  const components =
                    "components" in m && (m as { components?: Record<string, number | null> }).components
                      ? (m as { components: Record<string, number | null> }).components
                      : null;
                  return (
                    <div className="pr-coach-intel__row" key={m.key} style={{ display: "block" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", alignItems: "center" }}>
                        <div className="pr-coach-intel__name">{m.label}</div>
                        <div className="pr-coach-intel__score">
                          {score != null ? Math.round(score) : "—"}
                        </div>
                        <div className="pr-coach-intel__rank">
                          {m.worldRank != null ? `#${m.worldRank}` : "—"}
                        </div>
                      </div>
                      {score != null ? (
                        <div className="pr-coach-empty" style={{ marginTop: "0.25rem" }}>
                          {confidence != null ? `Confidence ${confidence}%` : null}
                          {sampleSize != null ? ` · ${sampleSize} matches` : null}
                          {components
                            ? ` · ${Object.entries(components)
                                .filter(([, v]) => v != null)
                                .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`)
                                .slice(0, 4)
                                .join(" · ")}`
                            : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Impact</h2>
          </div>
          {!profile.impact.enoughData ? (
            <p className="pr-coach-empty">Not enough data for impact comparison.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.impact.rows.map((row) => (
                <li key={row.metric}>
                  {row.metric}: before {row.before ?? "—"} → under {row.under ?? "—"}
                  {row.change != null ? ` (${row.change})` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
