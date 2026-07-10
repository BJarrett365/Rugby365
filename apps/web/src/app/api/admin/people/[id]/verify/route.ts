import { NextResponse } from "next/server";
import { buildPersonIntelligencePacket } from "@/lib/person-bio-automation-service";
import { buildPersonVerificationReport } from "@/lib/person-verification-service";
import { getPersonById } from "@/lib/person-intelligence-service";
import type { PersonRoleType } from "@/lib/person-intelligence-types";
import { apiErrorResponse } from "@/lib/api-errors";

async function buildVerificationPayload(personId: string) {
  const person = await getPersonById(personId);
  if (!person) return null;

  const packet = await buildPersonIntelligencePacket(
    person.roleType as PersonRoleType,
    person.roleEntityId,
    { persistScore: false },
  );
  const report = buildPersonVerificationReport(packet);
  return { person, packet, report };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await buildVerificationPayload(id);
    if (!payload) return NextResponse.json({ error: "Person not found" }, { status: 404 });
    return NextResponse.json(payload);
  } catch (e) {
    return apiErrorResponse(e, "Failed to create verification report");
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await buildVerificationPayload(id);
    if (!payload) return NextResponse.json({ error: "Person not found" }, { status: 404 });
    return NextResponse.json(payload);
  } catch (e) {
    return apiErrorResponse(e, "Failed to verify person profile");
  }
}
