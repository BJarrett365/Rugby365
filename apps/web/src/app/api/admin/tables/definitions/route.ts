import { NextResponse } from "next/server";
import { listRugbyTableDefinitions, rugbyTableCategories } from "@/lib/table-lab/table-definition-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const definitions = listRugbyTableDefinitions(
    category as Parameters<typeof listRugbyTableDefinitions>[0],
  );
  return NextResponse.json({
    categories: rugbyTableCategories(),
    definitions,
  });
}
