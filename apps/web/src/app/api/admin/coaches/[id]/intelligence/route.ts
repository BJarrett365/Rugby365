import { NextResponse } from "next/server";
import { ensurePersonForCoach } from "@/lib/person-intelligence-service";
import { getPersonBioAutomationState } from "@/lib/person-bio-automation-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const person = await ensurePersonForCoach(id);
    const state = await getPersonBioAutomationState(person.id);
    return NextResponse.json(state);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load coach intelligence");
  }
}
