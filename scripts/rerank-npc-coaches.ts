import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import {
  listNpcCoachRankings,
  listNpc2026CoachIds,
} from "../apps/web/src/lib/coach-competition-rank";

async function main() {
  const linked = await listNpc2026CoachIds();
  console.log("linked", linked.length);
  for (const l of linked) {
    await persistCoachRatingSnapshot(l.coachId);
  }
  const board = await listNpcCoachRankings(14);
  console.log("\n=== NPC COACH RANK (2026 Hilux NPC) ===");
  for (const r of board) {
    console.log(
      `#${r.rank}`.padEnd(4),
      r.teamName.padEnd(18),
      r.name.padEnd(20),
      `rating=${r.rating}`,
      `PI=${r.powerIndex ?? "—"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
