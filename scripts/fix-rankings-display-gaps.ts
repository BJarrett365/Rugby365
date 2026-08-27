/**
 * Fill rankings display gaps (clubs, nations, crests, dirty legend names) then rebuild boards.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fix-rankings-display-gaps.ts --write
 */
import { and, eq, ilike, sql } from "drizzle-orm";
import { playerLegendScores, playerLegends, players, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { getPublicPlayerRankingsBoard } from "../apps/web/src/lib/public-player-rankings-product-service";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import { writeFileSync } from "node:fs";

const write = process.argv.includes("--write");

const KNOWN_PLAYER_FIXES: Array<{
  name: string;
  country?: string;
  club?: string;
  internationalTeam?: string;
}> = [
  { name: "AJ Lam", country: "Samoa", club: "Auckland", internationalTeam: "Samoa" },
  { name: "Carlo Tizzano", country: "Australia", club: "Western Force", internationalTeam: "Australia" },
  { name: "Tim Anstee", country: "Australia", club: "Western Force", internationalTeam: "Australia" },
  { name: "Fraser McReight", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Filipo Daugunu", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Joshua Flook", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Jock Campbell", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Joe Brial", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Lachlan Shaw", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Will Harris", country: "Australia", club: "Waratahs", internationalTeam: "Australia" },
  { name: "Hamish Stewart", country: "Australia", club: "Reds", internationalTeam: "Australia" },
  { name: "Beka Gorgadze", country: "Georgia", club: "Bayonne", internationalTeam: "Georgia" },
  { name: "Billy Harmon", country: "New Zealand", club: "Crusaders", internationalTeam: "New Zealand" },
  { name: "Caelan Sweetman-Doris", country: "Ireland", club: "Connacht", internationalTeam: "Ireland" },
  { name: "Leicester Faingaanuku", country: "Tonga", club: "Castres Olympique", internationalTeam: "Tonga" },
  { name: "Dillyn Leyds", country: "South Africa", club: "La Rochelle", internationalTeam: "South Africa" },
  { name: "Uzair Cassiem", country: "South Africa", club: "Bayonne", internationalTeam: "South Africa" },
  { name: "Jeandre Rudolph", country: "South Africa", club: "Bulls", internationalTeam: "South Africa" },
  { name: "Fitz Harding", country: "England", club: "Bristol Bears", internationalTeam: "England" },
  { name: "Scott Gregory", country: "New Zealand", club: "Southland", internationalTeam: "New Zealand" },
  { name: "Setariki Tuicuvu", country: "Fiji", club: "Toulon", internationalTeam: "Fiji" },
  { name: "Yacouba Camara", country: "France", club: "Montpellier", internationalTeam: "France" },
  { name: "Glenn Vaihu", country: "New Zealand", club: "Southland", internationalTeam: "New Zealand" },
  { name: "Rekeiti Maasi White", country: "England", club: "Sale Sharks", internationalTeam: "England" },
  { name: "Dmitri Delibes", country: "France", club: "Stade Toulousain", internationalTeam: "France" },
  { name: "William Wand", country: "England", club: "Leicester Tigers", internationalTeam: "England" },
  { name: "Sam Dugdale", country: "England", club: "Sale Sharks", internationalTeam: "England" },
  { name: "Bryn Bradley", country: "England", club: "Harlequins", internationalTeam: "England" },
  { name: "Geoffrey Palis", country: "France", club: "Castres Olympique", internationalTeam: "France" },
  { name: "Greg Fisilau", country: "England", club: "Exeter Chiefs", internationalTeam: "England" },
  { name: "Nikora Broughton", country: "New Zealand", club: "Bay of Plenty", internationalTeam: "New Zealand" },
  { name: "George Crispin Bridge", country: "New Zealand", club: "Western Force", internationalTeam: "New Zealand" },
  { name: "Selevasio Tolofua", country: "France", club: "Toulon", internationalTeam: "France" },
  { name: "Sid Harvey", country: "Australia", club: "Waratahs", internationalTeam: "Australia" },
  { name: "Fetuli Paea", country: "Tonga", club: "Dragons", internationalTeam: "Tonga" },
  { name: "Lucas Casey", country: "New Zealand", club: "Otago", internationalTeam: "New Zealand" },
  { name: "Adrea Cocagi", country: "Fiji", club: "Castres Olympique", internationalTeam: "Fiji" },
  { name: "Anthony Bouthier", country: "France", club: "Montpellier", internationalTeam: "France" },
  { name: "Harvey Skinner", country: "England", club: "Exeter Chiefs", internationalTeam: "England" },
  { name: "Jona Nareki", country: "Fiji", club: "Otago", internationalTeam: "Fiji" },
  { name: "Maxime Espeut", country: "France", club: "Montauban", internationalTeam: "France" },
  { name: "James Lang", country: "Wales", club: "Edinburgh", internationalTeam: "Wales" },
  { name: "Charles Kante Samba", country: "France", club: "La Rochelle", internationalTeam: "France" },
  { name: "Joe Joyce", country: "Ireland", club: "Connacht", internationalTeam: "Ireland" },
  { name: "Romain Briatte", country: "France", club: "Stade Francais", internationalTeam: "France" },
  { name: "Mahamadou Diaby", country: "France", club: "Bordeaux Begles", internationalTeam: "France" },
  { name: "Euan Ferrie", country: "Scotland", club: "Glasgow Warriors", internationalTeam: "Scotland" },
  { name: "Paul Vallee", country: "France", club: "Montauban", internationalTeam: "France" },
  { name: "Ben Vellacott", country: "Scotland", club: "Edinburgh", internationalTeam: "Scotland" },
  { name: "Semisi Tupou Ta'eiloa", country: "Tonga", club: "Southland", internationalTeam: "Tonga" },
];

const CLUB_ALIASES: Record<string, string[]> = {
  "Rugby Rovigo": ["Rovigo Delta", "Rovigo", "Femi-CZ VEA Rovigo"],
  "Urayasu D-Rocks": ["Urayasu D-Rocks"],
  "Kintetsu Liners": ["Hanazono Kintetsu Liners", "Kintetsu Liners"],
  "Fijian Latui": ["Fijian Latui", "Fiji Latui"],
  "Toshiba Brave Lupus": ["Toshiba Brave Lupus Tokyo", "Brave Lupus Tokyo"],
  Bayonne: ["Aviron Bayonnais", "Bayonnais"],
  "Stade Francais": ["Stade Français", "Stade Francais Paris"],
  "Bordeaux Begles": ["Union Bordeaux Bègles", "Bordeaux Bègles", "Bordeaux Begles"],
  "Western Force": ["Force", "Western Force"],
  Reds: ["Queensland Reds", "Reds"],
  Waratahs: ["NSW Waratahs", "Waratahs"],
};

const CREST_WIKI: Array<{ teamName: string; wikiTitle: string }> = [
  { teamName: "Rugby Rovigo", wikiTitle: "Rugby Rovigo Delta" },
  { teamName: "Urayasu D-Rocks", wikiTitle: "Urayasu D-Rocks" },
  { teamName: "Kintetsu Liners", wikiTitle: "Hanazono Kintetsu Liners" },
  { teamName: "Fijian Latui", wikiTitle: "Fijian Latui" },
  { teamName: "Toshiba Brave Lupus", wikiTitle: "Toshiba Brave Lupus Tokyo" },
];

async function resolveTeam(name: string) {
  const db = getDb();
  const aliases = CLUB_ALIASES[name] ?? [name];
  for (const alias of aliases) {
    const needle = alias.toLowerCase();
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        imageUrl: teams.imageUrl,
      })
      .from(teams)
      .where(
        sql`${teams.name} not ilike 'unknown team%'
          and ${teams.slug} not like 'orphan-%'
          and (
            lower(${teams.name}) = ${needle}
            or lower(${teams.name}) like ${`${needle}%`}
            or lower(${teams.slug}) like ${`${needle.replace(/\s+/g, "-")}%`}
          )`,
      )
      .orderBy(
        sql`case when ${teams.imageUrl} is not null then 0 else 1 end`,
        sql`case when ${teams.slug} like '%__legacy__%' then 1 else 0 end`,
        sql`length(${teams.name})`,
      )
      .limit(5);
    if (rows[0]) return rows[0];
  }
  return null;
}

async function resolveNation(name: string) {
  const db = getDb();
  const needle = name.toLowerCase();
  const [row] = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      imageUrl: teams.imageUrl,
    })
    .from(teams)
    .where(
      sql`lower(${teams.name}) = ${needle}
        and ${teams.slug} not like '%__legacy__%'
        and ${teams.name} not ilike '%u20%'
        and ${teams.name} not ilike '%schools%'
        and ${teams.name} not ilike '%sevens%'`,
    )
    .orderBy(sql`case when ${teams.imageUrl} is not null then 0 else 1 end`)
    .limit(1);
  return row ?? null;
}

async function transferDirtyLegend(dirtyName: string, cleanName: string) {
  const db = getDb();
  const [dirty] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(ilike(players.name, dirtyName))
    .limit(1);
  const [clean] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.name, cleanName))
    .limit(1);
  if (!dirty || !clean) {
    console.log("skip legend transfer", dirtyName, "→", cleanName, { dirty: !!dirty, clean: !!clean });
    return;
  }

  const [dirtyLegend] = await db
    .select()
    .from(playerLegends)
    .where(eq(playerLegends.playerId, dirty.id))
    .limit(1);
  const [cleanLegend] = await db
    .select()
    .from(playerLegends)
    .where(eq(playerLegends.playerId, clean.id))
    .limit(1);
  const [dirtyScore] = await db
    .select()
    .from(playerLegendScores)
    .where(eq(playerLegendScores.playerId, dirty.id))
    .limit(1);
  const [cleanScore] = await db
    .select()
    .from(playerLegendScores)
    .where(eq(playerLegendScores.playerId, clean.id))
    .limit(1);

  if (!write) {
    console.log("dry", {
      dirtyName,
      cleanName,
      dirtyLegend: dirtyLegend?.legendStatus,
      cleanLegend: cleanLegend?.legendStatus,
      dirtyScore: dirtyScore?.overallScore,
      cleanScore: cleanScore?.overallScore,
    });
    return;
  }

  if (dirtyLegend) {
    if (!cleanLegend) {
      await db
        .update(playerLegends)
        .set({ playerId: clean.id, legendStatus: "active", updatedAt: new Date() })
        .where(eq(playerLegends.id, dirtyLegend.id));
      console.log("moved legend membership", dirtyName, "→", cleanName);
    } else {
      await db
        .update(playerLegends)
        .set({ legendStatus: "inactive", updatedAt: new Date() })
        .where(eq(playerLegends.id, dirtyLegend.id));
      await db
        .update(playerLegends)
        .set({ legendStatus: "active", updatedAt: new Date() })
        .where(eq(playerLegends.id, cleanLegend.id));
      console.log("deactivated dirty legend", dirtyName);
    }
  }

  if (dirtyScore) {
    if (!cleanScore) {
      await db
        .update(playerLegendScores)
        .set({ playerId: clean.id, updatedAt: new Date() })
        .where(eq(playerLegendScores.playerId, dirty.id));
      console.log("moved legend score", dirtyName, "→", cleanName, dirtyScore.overallScore);
    } else if (Number(dirtyScore.overallScore) > Number(cleanScore.overallScore ?? 0)) {
      await db
        .update(playerLegendScores)
        .set({
          overallScore: dirtyScore.overallScore,
          careerRating: dirtyScore.careerRating,
          peakRating: dirtyScore.peakRating,
          legacyRating: dirtyScore.legacyRating,
          influenceRating: dirtyScore.influenceRating,
          leadershipRating: dirtyScore.leadershipRating,
          trophyScore: dirtyScore.trophyScore,
          internationalScore: dirtyScore.internationalScore,
          clubScore: dirtyScore.clubScore,
          hallOfFameStatus: dirtyScore.hallOfFameStatus,
          components: dirtyScore.components,
          updatedAt: new Date(),
        })
        .where(eq(playerLegendScores.playerId, clean.id));
      await db.delete(playerLegendScores).where(eq(playerLegendScores.playerId, dirty.id));
      console.log("merged higher dirty score onto", cleanName);
    } else {
      await db.delete(playerLegendScores).where(eq(playerLegendScores.playerId, dirty.id));
      console.log("dropped lower dirty score", dirtyName);
    }
  }

  await db
    .update(players)
    .set({ careerStatus: "legend", isPublic: false, publishStatus: "draft" })
    .where(eq(players.id, dirty.id));
}

async function applyKnownPlayerFixes() {
  const db = getDb();
  let updated = 0;
  for (const fix of KNOWN_PLAYER_FIXES) {
    const [player] = await db
      .select({
        id: players.id,
        countryName: players.countryName,
        clubName: players.clubName,
        clubTeamId: players.clubTeamId,
        internationalTeamId: players.internationalTeamId,
      })
      .from(players)
      .where(ilike(players.name, fix.name))
      .limit(1);
    if (!player) {
      console.log("missing player", fix.name);
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (fix.country && !player.countryName) patch.countryName = fix.country;
    if (fix.club) {
      const team = await resolveTeam(fix.club);
      if (team) {
        if (!player.clubTeamId || player.clubTeamId !== team.id) patch.clubTeamId = team.id;
        if (!player.clubName || /unknown/i.test(player.clubName)) patch.clubName = team.name;
      } else if (!player.clubName) {
        patch.clubName = fix.club;
      }
    }
    if (fix.internationalTeam && !player.internationalTeamId) {
      const nation = await resolveNation(fix.internationalTeam);
      if (nation) patch.internationalTeamId = nation.id;
    }

    if (!Object.keys(patch).length) continue;
    if (!write) {
      console.log("dry fix", fix.name, patch);
      continue;
    }
    await db.update(players).set(patch).where(eq(players.id, player.id));
    updated += 1;
    console.log("fixed", fix.name, patch);
  }
  console.log("known player fixes", updated);
}

async function linkClubNamesToTeams() {
  const db = getDb();
  const rows = await db.execute(sql`
    select id, name, club_name
    from players
    where club_team_id is null
      and coalesce(club_name, '') <> ''
      and club_name not ilike 'unknown%'
      and club_name not ilike '%<span%'
    limit 500
  `);
  const list =
    (rows as unknown as { rows?: Array<{ id: string; name: string; club_name: string }> }).rows ??
    (rows as unknown as Array<{ id: string; name: string; club_name: string }>);
  let linked = 0;
  for (const r of list) {
    const team = await resolveTeam(r.club_name);
    if (!team) continue;
    if (!write) {
      console.log("dry link", r.name, "→", team.name);
      continue;
    }
    await db
      .update(players)
      .set({ clubTeamId: team.id, clubName: team.name })
      .where(eq(players.id, r.id));
    linked += 1;
  }
  console.log("linked club names", linked);
}

async function fillClubCrestsFromWiki() {
  const { parseWikipediaArchive } = await import("@rugby365/import-sdk");
  const db = getDb();
  for (const row of CREST_WIKI) {
    const team = await resolveTeam(row.teamName);
    if (!team) {
      console.log("no team for crest", row.teamName);
      continue;
    }
    if (team.imageUrl) {
      console.log("crest already set", team.name);
      // still copy onto aliases without images
    } else {
      try {
        const parsed = await parseWikipediaArchive({
          articleTitleOrUrl: row.wikiTitle,
        });
        const img = parsed?.imageUrl ?? null;
        if (img && write) {
          await db.update(teams).set({ imageUrl: img }).where(eq(teams.id, team.id));
          console.log("set crest", team.name, img.slice(0, 70));
        } else {
          console.log("wiki crest", team.name, img ? img.slice(0, 70) : "miss");
        }
      } catch (e) {
        console.log("wiki crest err", row.teamName, e instanceof Error ? e.message : e);
      }
    }

    // Propagate any crest onto exact-name siblings without image
    if (write) {
      const [withImg] = await db
        .select({ imageUrl: teams.imageUrl })
        .from(teams)
        .where(
          and(
            sql`lower(${teams.name}) = ${row.teamName.toLowerCase()}`,
            sql`${teams.imageUrl} is not null`,
          ),
        )
        .limit(1);
      if (withImg?.imageUrl) {
        await db
          .update(teams)
          .set({ imageUrl: withImg.imageUrl })
          .where(
            sql`lower(${teams.name}) = ${row.teamName.toLowerCase()}
              and (${teams.imageUrl} is null or ${teams.imageUrl} = '')`,
          );
      }
    }
  }
}

async function ensureHandreSaBadge() {
  const db = getDb();
  const sa = await resolveNation("South Africa");
  if (!sa || !write) return;
  await db
    .update(players)
    .set({
      internationalTeamId: sa.id,
      countryName: sql`coalesce(${players.countryName}, 'South Africa')`,
    })
    .where(
      sql`${players.name} in ('Handré Pollard', 'Handre Pollard', 'John Smit', 'Schalk Burger', 'Frik du Preez', 'Naas Botha', 'Malcolm Marx')
        and (${players.internationalTeamId} is null or ${players.internationalTeamId} <> ${sa.id}::uuid)`,
    );
  console.log("ensured SA international badge on key legends");
}

async function writeAlamyBatchForMissingImages() {
  const db = getDb();
  const current = await getPublicPlayerRankingsBoard({
    mode: "current",
    top: 100,
    forceRebuild: false,
  });
  const alltime = await getPublicPlayerRankingsBoard({
    mode: "alltime",
    top: 100,
    forceRebuild: false,
  });
  const missing = [...current.rows, ...alltime.rows].filter((r) => !r.imageUrl);
  const seen = new Set<string>();
  const plan = [];
  for (const r of missing) {
    if (seen.has(r.playerId)) continue;
    seen.add(r.playerId);
    plan.push({
      playerId: r.playerId,
      playerName: r.name,
      searchUrl: alamyStockPhotoSearchUrl(`${r.name} rugby`),
    });
  }
  writeFileSync("/tmp/alamy-rankings-missing-batch.json", JSON.stringify(plan, null, 2));
  console.log("wrote Alamy batch", plan.length, "→ /tmp/alamy-rankings-missing-batch.json");
}

async function rebuildBoards() {
  const boards = [
    { mode: "alltime" as const, top: 100 },
    { mode: "alltime" as const, top: 100, nation: "South Africa" },
    { mode: "current" as const, top: 100 },
    { mode: "current" as const, top: 50, nation: "South Africa" },
  ];
  for (const b of boards) {
    const board = await getPublicPlayerRankingsBoard({ ...b, forceRebuild: true });
    const gaps = {
      noClub: board.rows.filter((r) => !r.teamName || r.teamName === "Unassigned").map((r) => r.name),
      noCrest: board.rows
        .filter((r) => r.teamName && r.teamName !== "Unassigned" && !r.teamImageUrl)
        .map((r) => `${r.name}:${r.teamName}`),
      noCountry: board.rows.filter((r) => !r.nationName).map((r) => r.name),
      noCountryBadge: board.rows
        .filter((r) => r.nationName && !r.nationImageUrl)
        .map((r) => `${r.name}:${r.nationName}`),
      noImage: board.rows.filter((r) => !r.imageUrl).map((r) => r.name),
      dirtyNames: board.rows.filter((r) => /\b(retired|released)\b/i.test(r.name)).map((r) => r.name),
    };
    console.log(
      `\n=== ${board.mode} ${b.nation ?? "world"} top ${b.top} pool=${board.pool} ===`,
      JSON.stringify(
        {
          noClub: gaps.noClub.length,
          noCrest: gaps.noCrest.length,
          noCountry: gaps.noCountry.length,
          noCountryBadge: gaps.noCountryBadge.length,
          noImage: gaps.noImage.length,
          dirtyNames: gaps.dirtyNames,
          sampleNoClub: gaps.noClub.slice(0, 8),
          sampleNoCountry: gaps.noCountry.slice(0, 8),
          sampleNoCrest: gaps.noCrest.slice(0, 8),
          sampleNoImage: gaps.noImage.slice(0, 8),
        },
        null,
        2,
      ),
    );
  }
}

async function main() {
  console.log(write ? "WRITE mode" : "DRY RUN (pass --write)");
  await transferDirtyLegend("John Smit retired", "John Smit");
  await transferDirtyLegend("Schalk Burger released", "Schalk Burger");
  await applyKnownPlayerFixes();
  await linkClubNamesToTeams();
  await fillClubCrestsFromWiki();
  await ensureHandreSaBadge();
  if (write) {
    await rebuildBoards();
    await writeAlamyBatchForMissingImages();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
