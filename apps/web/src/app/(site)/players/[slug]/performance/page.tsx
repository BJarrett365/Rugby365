import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PlayerPerformanceRadarCard } from "@/components/players/PlayerPerformanceRadarCard";
import { PlayerRatingHistoryChart } from "@/components/players/PlayerRatingHistoryChart";
import { PlayerRecentFormCard } from "@/components/players/PlayerRecentFormCard";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Performance | Player | Rugby365`,
    description: `Performance breakdown for ${slug}`,
  };
}

export default async function PlayerPerformancePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, {
    preview: isPreviewParam(sp.preview),
  });
  if (!overview) notFound();

  const factors = overview.playerValue?.factors ?? [];
  const contrib = overview.intelligenceContributions;
  const i = overview.intelligence;

  const categoryCards: Array<{
    key: string;
    title: string;
    score: number | null;
    lines: Array<{ label: string; value: string }>;
  }> = [
    {
      key: "playmaking",
      title: "Playmaking Impact",
      score: i.playmaking,
      lines: [
        { label: "Playmaking rating", value: i.playmaking != null ? i.playmaking.toFixed(1) : "—" },
        {
          label: "Contribution weight",
          value:
            contrib.find((c) => c.key === "playmaking")?.weight != null
              ? `${contrib.find((c) => c.key === "playmaking")!.weight}%`
              : "—",
        },
      ],
    },
    {
      key: "kicking",
      title: "Kicking Performance",
      score: i.kicking,
      lines: [
        { label: "Kicking rating", value: i.kicking != null ? i.kicking.toFixed(1) : "—" },
        {
          label: "Goal kicks (recent form)",
          value:
            overview.playerForm.goalKicksMade != null
              ? String(overview.playerForm.goalKicksMade)
              : "—",
        },
        {
          label: "Form score",
          value: overview.playerForm.formScore != null ? overview.playerForm.formScore.toFixed(1) : "—",
        },
      ],
    },
    {
      key: "defence",
      title: "Defensive Performance",
      score: i.defence,
      lines: [
        { label: "Defence rating", value: i.defence != null ? i.defence.toFixed(1) : "—" },
        {
          label: "Contribution",
          value:
            contrib.find((c) => c.key === "defence")?.contribution != null
              ? String(contrib.find((c) => c.key === "defence")!.contribution)
              : "—",
        },
      ],
    },
    {
      key: "physical",
      title: "Physical Performance",
      score: i.physical,
      lines: [
        { label: "Physical rating", value: i.physical != null ? i.physical.toFixed(1) : "—" },
        { label: "Attack", value: i.attack != null ? i.attack.toFixed(1) : "—" },
      ],
    },
    {
      key: "management",
      title: "Game Management",
      score: i.gameManagement,
      lines: [
        {
          label: "Game management",
          value: i.gameManagement != null ? i.gameManagement.toFixed(1) : "—",
        },
        { label: "Playmaking", value: i.playmaking != null ? i.playmaking.toFixed(1) : "—" },
        { label: "Form", value: i.form != null ? i.form.toFixed(1) : "—" },
      ],
    },
    {
      key: "discipline",
      title: "Discipline",
      score: overview.scoutIntelligence?.disciplineScore ?? null,
      lines: [
        {
          label: "Discipline score",
          value:
            overview.scoutIntelligence?.disciplineScore != null
              ? overview.scoutIntelligence.disciplineScore.toFixed(1)
              : "—",
        },
        {
          label: "Availability",
          value:
            overview.scoutIntelligence?.availabilityScore != null
              ? overview.scoutIntelligence.availabilityScore.toFixed(1)
              : "—",
        },
      ],
    },
  ];

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Performance" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="performance" />

      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <PlayerIdentityHero overview={overview} />

        <header>
          <p className="pr-player-v2__kicker">Performance breakdown</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{overview.displayName}</h1>
          <p className="pr-player-v2__note">
            OVR {overview.rating.current != null ? overview.rating.current.toFixed(1) : "—"}
            {overview.classification.label ? ` · ${overview.classification.label}` : ""}
          </p>
        </header>

        <div className="pr-player-v2__row--2">
          <PlayerPerformanceRadarCard
            playerName={overview.displayName || overview.name}
            periods={overview.performanceRadarPeriods}
            defaultPeriodId="current"
          />

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Rating History</h2>
            </div>
            <PlayerRatingHistoryChart points={overview.ratingHistory} />
          </div>
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Value Breakdown</h2>
          </div>
          {factors.length === 0 ? (
            <p className="pr-player-v2__empty">No value factors available.</p>
          ) : (
            <div className="pr-player-v2__bars">
              {factors.map((f) => (
                <div key={f.key} className="pr-player-v2__bar-row">
                  <span>{f.label}</span>
                  <div className="pr-player-v2__bar-track">
                    <div
                      className={`pr-player-v2__bar-fill${f.pct < 0 ? " pr-player-v2__bar-fill--negative" : ""}`}
                      style={{ width: `${Math.min(100, Math.abs(f.pct) * 2)}%` }}
                    />
                  </div>
                  <span>
                    {f.pct > 0 ? "+" : ""}
                    {f.pct}% — {f.note}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pr-player-v2__row--3">
          {categoryCards.map((card) => (
            <div key={card.key} className="pr-player-v2__card">
              <div className="pr-player-v2__card-head">
                <h2>{card.title}</h2>
                <span className="pr-player-v2__note">
                  {card.score != null ? `${card.score.toFixed(1)}/10` : "—"}
                </span>
              </div>
              {card.lines.length === 0 ? (
                <p className="pr-player-v2__empty">Building from match data…</p>
              ) : (
                <ul className="pr-player-v2__kv-list">
                  {card.lines.map((line) => (
                    <li key={line.label}>
                      <span>{line.label}</span>
                      <strong>{line.value}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <PlayerRecentFormCard form={overview.playerForm} />
      </div>
    </article>
  );
}
