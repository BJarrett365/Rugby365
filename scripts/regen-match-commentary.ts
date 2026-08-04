/**
 * Regenerate narrative commentary for a fixture and print sample lines.
 *
 *   set -a && source .env && set +a
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/regen-match-commentary.ts [fixtureId]
 */

import { generateAndPublishMatchNarrativeCommentary } from "../apps/web/src/lib/match-narrative-commentary-service";

const fixtureId = process.argv[2] || "456b1da9-af24-4573-9c76-60c2802622e0";

async function main() {
  const result = await generateAndPublishMatchNarrativeCommentary(fixtureId, {
    replace: true,
    generateAudioScripts: true,
  });
  console.log(
    `Created ${result.created} written lines and ${result.audioScriptsCreated ?? 0} audio scripts for ${fixtureId}\n`,
  );

  const interesting = result.lines.filter((l) => {
    const s = l.segment;
    const b = l.body;
    return (
      s === "play_by_play" ||
      s === "match_story" ||
      s === "journalist_insight" ||
      s === "coach_watch" ||
      s === "momentum" ||
      /TRY!|Half-time|FULL-TIME/i.test(b)
    );
  });

  const samples = [
    ...interesting.filter((l) => /TRY!/i.test(l.body)).slice(0, 2),
    ...interesting.filter((l) => l.segment === "journalist_insight").slice(2, 5),
    ...interesting.filter((l) => /Half-time/i.test(l.body)).slice(0, 1),
    ...interesting.filter((l) => l.segment === "coach_watch").slice(0, 2),
    ...interesting.filter((l) => /FULL-TIME/i.test(l.body)).slice(0, 1),
  ];

  console.log("--- Sample lines ---");
  for (const line of samples) {
    console.log(`[${String(line.minute).padStart(2, "0")}:${String(line.second).padStart(2, "0")}] (${line.segment}) ${line.body}`);
  }

  console.log("\n--- Segment counts ---");
  const counts = new Map<string, number>();
  for (const l of result.lines) {
    counts.set(l.segment, (counts.get(l.segment) ?? 0) + 1);
  }
  for (const [seg, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${seg}: ${n}`);
  }

  const bad = result.lines.filter((l) => /Territory update:|Possession update:/i.test(l.body));
  console.log(`\nRaw Opta dump lines: ${bad.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
