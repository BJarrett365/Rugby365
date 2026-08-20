/**
 * Smoke-test Handré Pollard Player Profile V2 overview service.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/smoke-pollard-v2-overview.ts
 */
import { getPublicPlayerOverviewV2 } from "../apps/web/src/lib/public-player-overview-v2-service";

async function main() {
  const o = await getPublicPlayerOverviewV2("handre-pollard-og9nmd6l", { preview: true });
  if (!o) {
    console.error("NULL overview");
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        IDENTITY: {
          name: o.name,
          knownAs: o.knownAs,
          dob: o.birthDate,
          age: o.age,
          club: o.club?.name,
          competition: o.competitionName,
          international: o.internationalTeam?.name,
          foot: o.preferredFoot,
          contract: o.contract.expiresOn,
          squadNumber: o.base.squadNumber,
          image: Boolean(o.imageUrl),
        },
        RATING: o.intelligence,
        POTENTIAL: o.potential,
        CLASSIFICATION: o.classification,
        BADGES: o.badges,
        MARKET_VALUE: {
          value: o.playerValue?.marketValueGbp ?? null,
          label: o.playerValue?.marketValueLabel ?? null,
          confidence: o.playerValue?.confidence ?? null,
          model: o.playerValue?.modelVersion ?? null,
          outlier: o.valueOutlier,
          valueScore: o.valueScore,
        },
        POSITIONS: {
          note: o.positionHistory.coverageNote,
          career: o.positionHistory.career.slice(0, 4),
        },
        RANKINGS: {
          overall: o.rankings?.overallLabel,
          position: o.rankings?.positionLabel,
          provisional: o.rankings?.provisional,
          cohortSize: o.rankings?.cohortSize,
        },
        RATING_HISTORY: o.ratingHistory.length,
        RECENT_FORM: {
          matches: o.recentMatches.length,
          formScore0to10: o.rating.formScore0to10,
          strip: o.recentMatches.map((m) => m.result),
        },
        UPCOMING: o.upcomingMatch
          ? `${o.upcomingMatch.homeTeamName} v ${o.upcomingMatch.awayTeamName}`
          : null,
        ACHIEVEMENTS: o.achievements.map((a) => `${a.year} ${a.title} [${a.verificationStatus}]`),
        KEY_ACHIEVEMENTS: o.keyAchievements.map(
          (a) => `${a.title} · ${a.yearsLabel} · ${a.resultLabel ?? "—"} [${a.verificationStatus}]`,
        ),
        CAPS: {
          verified: o.verifiedInternationalCaps,
          linked: o.linkedInternationalCaps,
          points: o.verifiedInternationalPoints,
        },
        COMPARE_PEER: o.comparePeer?.name ?? null,
        SCOUT: {
          summary: o.scoutSummary ? "present" : "missing",
          provisional: o.scoutProvisional,
          strengths: o.scoutStrengths,
          development: o.scoutAreas,
          bestRole: o.scoutBestRole,
        },
        DISCLAIMER: { lastUpdated: o.dataLastUpdatedIso },
        RECENT_MATCHES_SAMPLE: o.recentMatches.slice(0, 5).map((m) => ({
          date: m.kickoffAt?.slice(0, 10) ?? null,
          match: m.matchLabel,
          competition: m.competitionName,
          rating: m.rating,
          cards: `Y${m.yellowCards}/R${m.redCards}`,
          result: m.result,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
