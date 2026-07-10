import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.slug, slug)).limit(1);
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const teamRows = await db.select().from(teams);
  return NextResponse.json({ fixture, teams: teamRows });
}
