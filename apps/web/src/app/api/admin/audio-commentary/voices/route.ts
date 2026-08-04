import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getAdminVoiceLibrary } from "@/lib/audio-commentary-voices-service";

/** Admin-only ElevenLabs + OpenAI voice library. Never expose on public match audio. */
export async function GET() {
  try {
    const library = await getAdminVoiceLibrary();
    return NextResponse.json(library);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load voice library");
  }
}
