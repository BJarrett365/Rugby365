import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { commentarySuggestions } from "@rugby365/db";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixtureId");
  if (!fixtureId) return NextResponse.json({ error: "fixtureId required" }, { status: 400 });

  const db = getDb();
  const rows = await db
    .select()
    .from(commentarySuggestions)
    .where(eq(commentarySuggestions.fixtureId, fixtureId))
    .orderBy(desc(commentarySuggestions.createdAt));

  const pending = rows.filter((r) => r.status === "pending");
  return NextResponse.json({ suggestions: pending });
}
