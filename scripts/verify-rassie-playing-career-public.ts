import { getPublicCoachProfile } from "../apps/web/src/lib/public-coach-profile-service";

async function main() {
  const profile = await getPublicCoachProfile("rassie-erasmus", { preview: true });
  if (!profile) throw new Error("missing profile");
  console.log("Playing stints public:");
  for (const s of profile.playingStints) {
    console.log({
      years: s.yearsLabel,
      team: s.teamDisplayName || s.teamName,
      type: s.teamType,
      level: s.competitionLevel,
      apps: s.apps,
      pts: s.points,
      crest: Boolean(s.crestUrl),
    });
  }
  const table = profile.playingStints.filter(
    (s) => s.competitionLevel !== "summary" && s.competitionLevel !== "timeline_summary",
  );
  console.log("\nProvincial tab rows:");
  for (const s of table.filter((s) => s.teamType !== "international")) {
    console.log(`  ${s.yearsLabel} | ${s.teamDisplayName || s.teamName} | ${s.apps ?? "—"} | ${s.points ?? "—"}`);
  }
  console.log("\nSuper Rugby:");
  for (const s of table.filter((s) => s.teamType === "franchise")) {
    console.log(`  ${s.yearsLabel} | ${s.teamDisplayName || s.teamName} | ${s.apps ?? "—"} | ${s.points ?? "—"}`);
  }
  const intl = table.filter((s) => s.teamType === "international");
  console.log("\nInternational strip:", {
    caps: intl.reduce((a, s) => a + (s.apps ?? 0), 0),
    points: intl.reduce((a, s) => a + (s.points ?? 0), 0),
    crest: intl[0]?.crestUrl ? "yes" : "no",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
