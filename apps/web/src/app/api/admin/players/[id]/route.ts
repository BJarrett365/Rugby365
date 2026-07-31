import { NextResponse } from "next/server";
import {
  createPlayerTransfer,
  deletePlayer,
  getPlayerDetail,
  updatePlayer,
} from "@/lib/entity-admin-service";
import { getPlayerCareerTimeline } from "@/lib/transfer-admin-service";
import { getPlayerLegends } from "@/lib/legend-admin-service";
import { calculatePlayerAge, normalizeSocialAccounts } from "@/lib/player-profile-utils";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getPlayerDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [careerTimeline, legends] = await Promise.all([
      getPlayerCareerTimeline(id),
      getPlayerLegends(id),
    ]);
    const age = calculatePlayerAge(detail.player.birthDate);
    return NextResponse.json({
      ...detail,
      careerTimeline,
      legends,
      profile: {
        age,
        birthDate: detail.player.birthDate,
        heightCm: detail.player.heightCm,
        weightKg: detail.player.weightKg,
        positionName: detail.player.positionName,
        clubName: detail.player.clubName,
        countryName: detail.player.countryName,
        squadNumber: detail.player.squadNumber,
        socialAccounts: normalizeSocialAccounts(detail.player.socialAccounts),
        externalLinks: {
          wikipedia: detail.player.wikipediaUrl,
          rugbypass: detail.player.rugbypassUrl,
          wikidata: detail.player.wikidataId,
        },
        sourceStatus: {
          wikipediaSyncedAt: detail.player.archiveSyncedAt,
          rugbypassSyncedAt: detail.player.rugbypassSyncedAt,
          rugbypassSlug: detail.player.rugbypassSlug,
          rugbypassPlayerId: detail.player.rugbypassPlayerId,
        },
      },
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "enrich-wikipedia") {
      const { enrichPlayerFromWikipediaAndWait } = await import("@/lib/player-wikipedia-enrich");
      const archive = await enrichPlayerFromWikipediaAndWait(id, body.name ? String(body.name) : undefined, {
        ...(body.sourceUrl ? { sourceUrl: String(body.sourceUrl) } : {}),
      });
      const detail = await getPlayerDetail(id);
      if (!archive.enriched && archive.reason && archive.reason !== "matched_no_new_data") {
        return NextResponse.json(
          { ok: false, ...archive, player: detail?.player },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true, archive, player: detail?.player });
    }

    if (body.action === "enrich-rugbypass") {
      const { enrichPlayerFromRugbyPass } = await import("@/lib/rugbypass-player-import-service");
      const result = await enrichPlayerFromRugbyPass(
        id,
        body.sourceUrl ? String(body.sourceUrl) : undefined,
      );
      const detail = await getPlayerDetail(id);
      if (!result.enriched) {
        return NextResponse.json({ ok: false, ...result, player: detail?.player }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ...result, player: detail?.player });
    }

    const transfer = body.transfer as Record<string, unknown> | undefined;
    if (transfer) {
      const row = await createPlayerTransfer({
        playerId: id,
        fromTeamId: transfer.fromTeamId ? String(transfer.fromTeamId) : undefined,
        toTeamId: transfer.toTeamId ? String(transfer.toTeamId) : undefined,
        fromClub: transfer.fromClub ? String(transfer.fromClub) : undefined,
        toClub: transfer.toClub ? String(transfer.toClub) : undefined,
        transferType:
          transfer.transferType === "international" ? "international" : "club",
        effectiveDate: transfer.effectiveDate ? String(transfer.effectiveDate) : undefined,
        notes: transfer.notes ? String(transfer.notes) : undefined,
      });
      return NextResponse.json({ transfer: row });
    }

    const player = await updatePlayer(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.positionName !== undefined ? { positionName: String(body.positionName) } : {}),
      ...(body.clubName !== undefined ? { clubName: String(body.clubName) } : {}),
      ...(body.countryName !== undefined ? { countryName: String(body.countryName) } : {}),
      ...(body.nationCode !== undefined ? { nationCode: String(body.nationCode) } : {}),
      ...(body.clubTeamId !== undefined
        ? { clubTeamId: body.clubTeamId ? String(body.clubTeamId) : null }
        : {}),
      ...(body.internationalTeamId !== undefined
        ? { internationalTeamId: body.internationalTeamId ? String(body.internationalTeamId) : null }
        : {}),
      ...(body.externalProviderId !== undefined
        ? { externalProviderId: String(body.externalProviderId) }
        : {}),
      ...(body.fullName !== undefined ? { fullName: body.fullName ? String(body.fullName) : null } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate ? String(body.birthDate) : null } : {}),
      ...(body.birthPlace !== undefined
        ? { birthPlace: body.birthPlace ? String(body.birthPlace) : null }
        : {}),
      ...(body.heightCm !== undefined
        ? { heightCm: body.heightCm === null || body.heightCm === "" ? null : Number(body.heightCm) }
        : {}),
      ...(body.weightKg !== undefined
        ? { weightKg: body.weightKg === null || body.weightKg === "" ? null : Number(body.weightKg) }
        : {}),
      ...(body.socialAccounts !== undefined && typeof body.socialAccounts === "object"
        ? {
            socialAccounts: normalizeSocialAccounts(body.socialAccounts) as Record<string, string | null>,
          }
        : {}),
      ...(body.squadNumber !== undefined
        ? {
            squadNumber:
              body.squadNumber === null || body.squadNumber === ""
                ? null
                : Number(body.squadNumber),
          }
        : {}),
      ...(body.careerStatus !== undefined ? { careerStatus: String(body.careerStatus) } : {}),
      ...(body.isPublic !== undefined ? { isPublic: Boolean(body.isPublic) } : {}),
      ...(body.publishStatus !== undefined ? { publishStatus: String(body.publishStatus) } : {}),
      ...(body.seoTitle !== undefined
        ? { seoTitle: body.seoTitle ? String(body.seoTitle) : null }
        : {}),
      ...(body.seoDescription !== undefined
        ? { seoDescription: body.seoDescription ? String(body.seoDescription) : null }
        : {}),
      ...(body.ogImageUrl !== undefined
        ? { ogImageUrl: body.ogImageUrl ? String(body.ogImageUrl) : null }
        : {}),
      ...(body.imageUrl !== undefined
        ? { imageUrl: body.imageUrl ? String(body.imageUrl) : null }
        : {}),
      ...(body.publicIntroOverride !== undefined
        ? { publicIntroOverride: body.publicIntroOverride ? String(body.publicIntroOverride) : null }
        : {}),
      ...(body.preferredFoot !== undefined
        ? { preferredFoot: body.preferredFoot ? String(body.preferredFoot) : null }
        : {}),
      ...(body.statusOverride !== undefined
        ? { statusOverride: body.statusOverride ? String(body.statusOverride) : null }
        : {}),
      ...(body.contractExpiresOn !== undefined
        ? { contractExpiresOn: body.contractExpiresOn ? String(body.contractExpiresOn) : null }
        : {}),
      ...(body.reportedSalaryGbp !== undefined
        ? {
            reportedSalaryGbp:
              body.reportedSalaryGbp === null || body.reportedSalaryGbp === ""
                ? null
                : Number(body.reportedSalaryGbp),
          }
        : {}),
      ...(body.salaryAsOf !== undefined
        ? { salaryAsOf: body.salaryAsOf ? String(body.salaryAsOf) : null }
        : {}),
      ...(body.agentName !== undefined
        ? { agentName: body.agentName ? String(body.agentName) : null }
        : {}),
      ...(body.agentAgency !== undefined
        ? { agentAgency: body.agentAgency ? String(body.agentAgency) : null }
        : {}),
      ...(body.clubDebutOn !== undefined
        ? { clubDebutOn: body.clubDebutOn ? String(body.clubDebutOn) : null }
        : {}),
    });
    return NextResponse.json({ player });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update player";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deletePlayer(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete player";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
