import { NextResponse } from "next/server";
import { importFixtureFromPlanetRugbyMatchUrl } from "@/lib/planet-rugby-match-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      planetRugbyUrl?: string;
      matchUrl?: string;
      replaceEvents?: boolean;
    };

    const url = (body.planetRugbyUrl ?? body.matchUrl ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "planetRugbyUrl is required" }, { status: 400 });
    }

    const result = await importFixtureFromPlanetRugbyMatchUrl(url, {
      replaceEvents: body.replaceEvents,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return apiErrorResponse(e, "Planet Rugby match import failed");
  }
}
