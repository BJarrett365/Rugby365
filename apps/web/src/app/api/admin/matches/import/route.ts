import { NextResponse } from "next/server";
import { importFixtureFromSport365 } from "@/lib/sport365-import-service";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sport365Url?: string;
      createTeams?: boolean;
      importEvents?: boolean;
      slug?: string;
    };

    if (!body.sport365Url?.trim()) {
      return NextResponse.json({ error: "sport365Url is required" }, { status: 400 });
    }

    const result = await importFixtureFromSport365({
      sport365Url: body.sport365Url.trim(),
      createTeams: body.createTeams,
      importEvents: body.importEvents,
      slug: body.slug,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    const status = message.includes("Slug") || message.includes("Teams") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
