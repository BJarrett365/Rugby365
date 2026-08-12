import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCoachDetail } from "@/lib/coach-admin-service";
import { listCoachPlayingStints } from "@/lib/coach-history-cms-service";
import { resolveCoachStintToCmsTeam } from "@/lib/coach-team-resolve-service";
import { normalizeCoachingRole, coachingRoleLabel } from "@/lib/coach-types";
import { parseWikipediaArchive, type WikipediaCoachArchive } from "@rugby365/import-sdk";
import { getWikimediaEnterpriseAccessToken } from "@/lib/wikimedia-enterprise-client";

/**
 * Read-only career diff vs Wikipedia. Never overwrites verified Rugby365 data.
 * POST { source?: "wikipedia" }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { source?: string };
    const source = body.source || "wikipedia";
    if (source !== "wikipedia") {
      return NextResponse.json(
        { error: "Only wikipedia source is supported currently" },
        { status: 400 },
      );
    }

    const detail = await getCoachDetail(id);
    if (!detail) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const wikiUrl = detail.coach.wikipediaUrl?.trim();
    if (!wikiUrl) {
      return NextResponse.json(
        { error: "Coach has no Wikipedia URL — set one before checking career data" },
        { status: 400 },
      );
    }

    const token = await getWikimediaEnterpriseAccessToken().catch(() => null);
    const archive = (await parseWikipediaArchive({
      articleTitleOrUrl: wikiUrl,
      entityType: "coach",
      accessToken: token ?? undefined,
    })) as WikipediaCoachArchive;

    const coachingCareer = archive.coachingCareer ?? [];
    const playingCareer = archive.playingCareer ?? [];
    const playingStints = await listCoachPlayingStints(id);
    const assignments = detail.assignments;

    const foundCoaching = [];
    for (const stint of coachingCareer) {
      const team = await resolveCoachStintToCmsTeam(stint.teamName);
      const role = normalizeCoachingRole(stint.roleHint?.trim() || "head_coach");
      const startY = stint.startYear ?? null;
      const endY = stint.endYear ?? null;
      const match = assignments.find((a) => {
        const aStart = a.startDate ? Number(a.startDate.slice(0, 4)) : null;
        const aEnd = a.endDate ? Number(a.endDate.slice(0, 4)) : null;
        const sameTeam = team
          ? a.teamId === team.id
          : a.teamName.toLowerCase().includes(stint.teamName.toLowerCase());
        const sameRole = a.role === role || (!stint.roleHint && a.role === "head_coach");
        const sameStart = startY == null || aStart === startY;
        const sameEnd = endY == null || aEnd === endY || (endY == null && a.isCurrent);
        return sameTeam && sameRole && sameStart && sameEnd;
      });
      foundCoaching.push({
        kind: "coaching" as const,
        foundValue: {
          yearsLabel: stint.yearsLabel,
          teamName: stint.teamName,
          roleHint: stint.roleHint ?? null,
          role: coachingRoleLabel(role),
          resolvedTeamId: team?.id ?? null,
          resolvedTeamName: team?.name ?? null,
        },
        rugby365Value: match
          ? {
              id: match.id,
              yearsLabel: `${match.startDate ?? "?"}–${match.endDate ?? (match.isCurrent ? "" : "?")}`,
              teamName: match.teamName,
              role: match.roleLabel,
              showOnOverview: match.showOnOverview,
              verifiedAt: match.verifiedAt,
            }
          : null,
        source: wikiUrl,
        confidence: team ? "high" : "medium",
        status: match ? (match.verifiedAt ? "matched_verified" : "matched") : "missing",
        action: match?.verifiedAt ? "ignore" : "review",
      });
    }

    const foundPlaying = [];
    for (const stint of playingCareer) {
      const team = await resolveCoachStintToCmsTeam(stint.teamName);
      const match = playingStints.find((p) => {
        const sameTeam =
          (team && p.teamId === team.id) ||
          p.teamName.toLowerCase() === stint.teamName.toLowerCase();
        const sameStart = stint.startYear == null || p.startYear === stint.startYear;
        return sameTeam && sameStart;
      });
      foundPlaying.push({
        kind: "playing" as const,
        foundValue: {
          yearsLabel: stint.yearsLabel,
          teamName: stint.teamName,
          careerType: stint.careerType,
          resolvedTeamId: team?.id ?? null,
          resolvedTeamName: team?.name ?? null,
        },
        rugby365Value: match
          ? {
              id: match.id,
              yearsLabel: match.yearsLabel,
              teamName: match.teamName,
              showOnOverview: match.showOnOverview,
              verifiedAt: match.verifiedAt?.toISOString?.() ?? null,
            }
          : null,
        source: wikiUrl,
        confidence: team ? "high" : "medium",
        status: match ? (match.verifiedAt ? "matched_verified" : "matched") : "missing",
        action: match?.verifiedAt ? "ignore" : "review",
      });
    }

    return NextResponse.json({
      ok: true,
      source: "wikipedia",
      sourceUrl: wikiUrl,
      summary: {
        coachingFound: foundCoaching.length,
        coachingMissing: foundCoaching.filter((r) => r.status === "missing").length,
        playingFound: foundPlaying.length,
        playingMissing: foundPlaying.filter((r) => r.status === "missing").length,
      },
      rows: [...foundPlaying, ...foundCoaching],
      note: "Read-only diff. Use CMS History to ACCEPT rows. Verified Rugby365 data is never auto-overwritten.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to check career data");
  }
}
