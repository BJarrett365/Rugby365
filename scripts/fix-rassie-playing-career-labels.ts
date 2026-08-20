/**
 * Fix Rassie playing career rows to match approved Playing Career card:
 * - Hide duplicate Free State 1994–2003 summary from table
 * - Align years / Free State (SR) display name
 * Does not invent apps/points — only labels + visibility metadata.
 */
import { and, eq } from "drizzle-orm";
import { coachPlayingStints } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  const db = getDb();
  const rows = await db
    .select()
    .from(coachPlayingStints)
    .where(eq(coachPlayingStints.coachId, RASSIE));

  for (const r of rows) {
    // Duplicate overview summary — keep for timeline, exclude from Playing Career table
    if (r.yearsLabel === "1994–2003" && r.teamName === "Free State" && r.apps == null) {
      await db
        .update(coachPlayingStints)
        .set({
          competitionLevel: "timeline_summary",
          showOnOverview: true,
          updatedAt: new Date(),
        })
        .where(eq(coachPlayingStints.id, r.id));
      console.log("Marked timeline summary:", r.id, r.yearsLabel);
      continue;
    }

    if (
      (r.yearsLabel === "1994–98, 2001–03" || r.yearsLabel.includes("2001–03")) &&
      r.teamName === "Free State" &&
      r.teamType === "provincial" &&
      r.apps === 112
    ) {
      await db
        .update(coachPlayingStints)
        .set({
          yearsLabel: "1994–1998, 2001–03",
          teamDisplayName: "Free State",
          competitionLevel: "provincial",
          showOnOverview: false,
          updatedAt: new Date(),
        })
        .where(eq(coachPlayingStints.id, r.id));
      console.log("Updated Free State provincial:", r.id);
      continue;
    }

    if (r.yearsLabel === "1997" && r.teamType === "franchise" && r.teamName === "Free State") {
      await db
        .update(coachPlayingStints)
        .set({
          teamDisplayName: "Free State (SR)",
          competitionLevel: "super_rugby",
          careerType: "super_rugby_player",
          updatedAt: new Date(),
        })
        .where(eq(coachPlayingStints.id, r.id));
      console.log("Updated Free State (SR):", r.id);
      continue;
    }

    if (r.teamType === "franchise") {
      await db
        .update(coachPlayingStints)
        .set({
          competitionLevel: "super_rugby",
          careerType: "super_rugby_player",
          updatedAt: new Date(),
        })
        .where(and(eq(coachPlayingStints.id, r.id)));
      console.log("Tagged franchise:", r.teamName, r.id);
    }

    if (r.teamType === "international") {
      await db
        .update(coachPlayingStints)
        .set({
          competitionLevel: "international",
          careerType: "international_player",
          teamDisplayName: r.teamDisplayName || "South Africa",
          updatedAt: new Date(),
        })
        .where(eq(coachPlayingStints.id, r.id));
      console.log("Tagged international:", r.id);
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
