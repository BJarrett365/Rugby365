import { NextResponse } from "next/server";
import { readKnowledgePage, writeKnowledgePage } from "@/lib/knowledge-service";
import { apiErrorResponse } from "@/lib/api-errors";
import { writeAuditLog } from "@/lib/provider-mapping-service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const page = await readKnowledgePage(slug);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(page);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load knowledge page");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await req.json()) as { content?: string };
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "content string required" }, { status: 400 });
    }
    const meta = await writeKnowledgePage(slug, body.content);
    await writeAuditLog({
      entityType: "knowledge",
      entityId: slug,
      field: "markdown",
      action: "knowledge_page_updated",
      source: "cms",
      userLabel: "admin",
      reason: `Updated ${meta.file}`,
    });
    return NextResponse.json({ meta, ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save knowledge page";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
