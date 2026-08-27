/**
 * Force-rebuild public player ranking board snapshots.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/rebuild-player-rankings-boards.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/rebuild-player-rankings-boards.ts --mode=alltime --nation=South Africa
 */
import { getPublicPlayerRankingsBoard } from "../apps/web/src/lib/public-player-rankings-product-service";
import type { PlayerRankingMode } from "../apps/web/src/lib/player-ranking-engine";

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function rebuild(input: {
  mode: PlayerRankingMode;
  nation?: string | null;
  top?: number;
}) {
  const board = await getPublicPlayerRankingsBoard({
    mode: input.mode,
    nation: input.nation ?? null,
    top: input.top ?? 50,
    forceRebuild: true,
  });
  console.log(
    JSON.stringify(
      {
        mode: board.mode,
        title: board.title,
        status: board.status,
        pool: board.pool,
        rows: board.rows.length,
        missingClub: board.rows.filter((r) => r.clubPerformance == null).length,
        missingForm: board.rows.filter((r) => r.formScore == null).length,
        emptyFormBlocks: board.rows.filter((r) => r.formBlocks.length === 0).length,
        missingImage: board.rows.filter((r) => !r.imageUrl).length,
        topNames: board.rows.slice(0, 10).map((r) => `#${r.rank} ${r.name} (${r.rankingScore})`),
      },
      null,
      2,
    ),
  );
  return board;
}

async function main() {
  const modeArg = (argValue("--mode") ?? "both").toLowerCase();
  const nation = argValue("--nation");
  const top = Number(argValue("--top") ?? "50") || 50;

  const modes: PlayerRankingMode[] =
    modeArg === "alltime"
      ? ["alltime"]
      : modeArg === "current"
        ? ["current"]
        : ["current", "alltime"];

  for (const mode of modes) {
    console.log(`\n=== Rebuild ${mode} world top ${top} ===`);
    await rebuild({ mode, top });
    const nationLabel = nation ?? "South Africa";
    console.log(`\n=== Rebuild ${mode} ${nationLabel} top ${top} ===`);
    await rebuild({ mode, nation: nationLabel, top });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
