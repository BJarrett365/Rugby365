import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { commentarySuggestions } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { approveCommentarySuggestion } from "@/lib/publish-commentary-service";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    suggestionId: string;
    selectedIndex: number;
    editedBody?: string;
  };

  const db = getDb();
  const [suggestion] = await db
    .select()
    .from(commentarySuggestions)
    .where(eq(commentarySuggestions.id, body.suggestionId))
    .limit(1);

  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const line = await approveCommentarySuggestion(
    body.suggestionId,
    body.selectedIndex,
    body.editedBody,
  );
  if (!line) return NextResponse.json({ error: "Invalid selection" }, { status: 400 });

  return NextResponse.json({ line });
}
