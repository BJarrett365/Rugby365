import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  applyPlayerImageAction,
  findPlanetRugbyImagesForPlayer,
  listPlayerImages,
  refreshPlayerPlanetRugbyImages,
  updatePlayerImageMetadata,
  type PlayerImageRole,
} from "@/lib/player-image-service";
import {
  clearPlayerBadgeCutout,
  fetchPlayerImageBytesForEditor,
  savePlayerBadgeCutout,
} from "@/lib/player-badge-cutout-service";
import { getDb } from "@/lib/db";
import { players } from "@rugby365/db";
import { eq } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const sourceImageId = url.searchParams.get("sourceImageId");

    if (sourceImageId) {
      const { bytes, contentType } = await fetchPlayerImageBytesForEditor(id, sourceImageId);
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const images = await listPlayerImages(id);
    const db = getDb();
    const [player] = await db
      .select({
        imageUrl: players.imageUrl,
        badgeImageUrl: players.badgeImageUrl,
        badgeImageId: players.badgeImageId,
      })
      .from(players)
      .where(eq(players.id, id))
      .limit(1);

    return NextResponse.json({ images, player: player ?? null });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player images");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      imageId?: string;
      role?: PlayerImageRole;
      reason?: string;
      dataUrl?: string;
      sourceImageId?: string | null;
      metadata?: Record<string, unknown>;
    };

    if (body.action === "find" || body.action === "refresh") {
      const result =
        body.action === "refresh"
          ? await refreshPlayerPlanetRugbyImages(id, body.reason ?? "manual_refresh")
          : await findPlanetRugbyImagesForPlayer(id);
      return NextResponse.json(result);
    }

    if (body.action === "save_badge_cutout") {
      if (!body.dataUrl) {
        return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
      }
      const result = await savePlayerBadgeCutout({
        playerId: id,
        dataUrl: body.dataUrl,
        sourceImageId: body.sourceImageId ?? body.imageId ?? null,
        updatedBy: "admin",
      });
      return NextResponse.json({
        ...result,
        images: await listPlayerImages(id),
      });
    }

    if (body.action === "clear_badge_cutout") {
      const result = await clearPlayerBadgeCutout(id);
      return NextResponse.json({
        ...result,
        images: await listPlayerImages(id),
      });
    }

    if (body.action === "update_metadata") {
      if (!body.imageId) {
        return NextResponse.json({ error: "imageId required" }, { status: 400 });
      }
      const meta = body.metadata ?? {};
      const result = await updatePlayerImageMetadata(id, body.imageId, {
        altText: meta.altText as string | null | undefined,
        caption: meta.caption as string | null | undefined,
        credit: meta.credit as string | null | undefined,
        photographer: meta.photographer as string | null | undefined,
        agency: meta.agency as string | null | undefined,
        copyright: meta.copyright as string | null | undefined,
        licence: meta.licence as string | null | undefined,
        title: meta.title as string | null | undefined,
        description: meta.description as string | null | undefined,
        focalX: meta.focalX as number | null | undefined,
        focalY: meta.focalY as number | null | undefined,
        imageType: meta.imageType as string | null | undefined,
        isAiGenerated: meta.isAiGenerated as boolean | undefined,
        isPublic: meta.isPublic as boolean | undefined,
        setOgImage: Boolean(meta.setOgImage),
        updatedBy: "admin",
      });
      return NextResponse.json({
        ...result,
        images: await listPlayerImages(id),
      });
    }

    if (!body.imageId || !body.action) {
      return NextResponse.json({ error: "imageId and action required" }, { status: 400 });
    }

    const actionMap: Record<string, Parameters<typeof applyPlayerImageAction>[2]> = {
      set_primary: "set_primary",
      add_gallery: "add_gallery",
      set_role: "set_role",
      reject: "reject",
      incorrect_player: "incorrect_player",
      remove_public: "remove_public",
      approve: "approve",
    };
    const mapped = actionMap[body.action];
    if (!mapped) {
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    const result = await applyPlayerImageAction(id, body.imageId, mapped, {
      role: body.role,
    });
    return NextResponse.json({
      ...result,
      images: await listPlayerImages(id),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update player images");
  }
}
