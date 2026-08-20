import { getPublicCoachProfile } from "../apps/web/src/lib/public-coach-profile-service";

async function main() {
  const profile = await getPublicCoachProfile("rassie-erasmus", { preview: true });
  if (!profile) {
    console.log("no profile");
    return;
  }
  console.log("recent count", profile.recentMatches.length);
  for (const m of profile.recentMatches) {
    console.log({
      date: m.kickoffAt?.slice(0, 10),
      opp: m.opponentName,
      venue: m.venueType,
      score: `${m.pointsFor}-${m.pointsAgainst}`,
      result: m.result,
      crest: Boolean(m.opponentCrestUrl),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
