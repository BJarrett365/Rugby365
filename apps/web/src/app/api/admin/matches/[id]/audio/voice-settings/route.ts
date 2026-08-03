import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  AUDIO_DELIVERY_STYLES,
  AUDIO_DELIVERY_STYLE_LABELS,
  AUDIO_SPEAKER_ROLES,
  AUDIO_SPEAKER_ROLE_LABELS,
  AUDIO_TONE_PRESETS,
  AUDIO_VOICE_STYLES,
  AUDIO_VOICE_STYLE_LABELS,
  OPENAI_VOICE_OPTIONS,
  assertActiveProfileIds,
  clearMatchVoiceSettings,
  getMatchVoiceSettingsAdmin,
  listActiveProfilesForSelect,
  parseVoiceOverrides,
  upsertMatchVoiceSettings,
} from "@/lib/audio-voice-settings-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const [settings, profiles] = await Promise.all([
      getMatchVoiceSettingsAdmin(id),
      listActiveProfilesForSelect(),
    ]);
    return NextResponse.json({
      ok: true,
      settings,
      profiles,
      tonePresets: AUDIO_TONE_PRESETS,
      voiceStyles: AUDIO_VOICE_STYLES,
      voiceStyleLabels: AUDIO_VOICE_STYLE_LABELS,
      deliveryStyles: AUDIO_DELIVERY_STYLES,
      deliveryStyleLabels: AUDIO_DELIVERY_STYLE_LABELS,
      speakerRoles: AUDIO_SPEAKER_ROLES,
      speakerRoleLabels: AUDIO_SPEAKER_ROLE_LABELS,
      openaiVoices: OPENAI_VOICE_OPTIONS,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match voice settings");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    await assertActiveProfileIds([
      body.leadProfileId as string | null | undefined,
      body.analystProfileId as string | null | undefined,
      body.sidelineProfileId as string | null | undefined,
      body.guestProfileId as string | null | undefined,
    ]);

    const settings = await upsertMatchVoiceSettings(id, {
      presenterCount:
        body.presenterCount === null
          ? null
          : typeof body.presenterCount === "number"
            ? body.presenterCount
            : undefined,
      leadProfileId: (body.leadProfileId as string | null | undefined) ?? undefined,
      analystProfileId: (body.analystProfileId as string | null | undefined) ?? undefined,
      sidelineProfileId:
        (body.sidelineProfileId as string | null | undefined) ?? undefined,
      guestProfileId: (body.guestProfileId as string | null | undefined) ?? undefined,
      leadSpeed: (body.leadSpeed as number | null | undefined) ?? undefined,
      analystSpeed: (body.analystSpeed as number | null | undefined) ?? undefined,
      sidelineSpeed: (body.sidelineSpeed as number | null | undefined) ?? undefined,
      guestSpeed: (body.guestSpeed as number | null | undefined) ?? undefined,
      leadTone: (body.leadTone as string | null | undefined) ?? undefined,
      analystTone: (body.analystTone as string | null | undefined) ?? undefined,
      sidelineTone: (body.sidelineTone as string | null | undefined) ?? undefined,
      guestTone: (body.guestTone as string | null | undefined) ?? undefined,
      leadVoiceStyle: (body.leadVoiceStyle as string | null | undefined) ?? undefined,
      analystVoiceStyle:
        (body.analystVoiceStyle as string | null | undefined) ?? undefined,
      sidelineVoiceStyle:
        (body.sidelineVoiceStyle as string | null | undefined) ?? undefined,
      guestVoiceStyle: (body.guestVoiceStyle as string | null | undefined) ?? undefined,
      leadDeliveryStyle:
        (body.leadDeliveryStyle as string | null | undefined) ?? undefined,
      analystDeliveryStyle:
        (body.analystDeliveryStyle as string | null | undefined) ?? undefined,
      sidelineDeliveryStyle:
        (body.sidelineDeliveryStyle as string | null | undefined) ?? undefined,
      guestDeliveryStyle:
        (body.guestDeliveryStyle as string | null | undefined) ?? undefined,
      voiceOverrides:
        body.voiceOverrides === null
          ? null
          : body.voiceOverrides !== undefined
            ? parseVoiceOverrides(body.voiceOverrides)
            : undefined,
      optimiseDualCommentary:
        (body.optimiseDualCommentary as boolean | null | undefined) ?? undefined,
      emphasiseScoreboard:
        (body.emphasiseScoreboard as boolean | null | undefined) ?? undefined,
      aiPrompt: (body.aiPrompt as string | null | undefined) ?? undefined,
      notes: (body.notes as string | null | undefined) ?? undefined,
    });

    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save match voice settings");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const settings = await clearMatchVoiceSettings(id);
    return NextResponse.json({ ok: true, settings, cleared: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to clear match voice overrides");
  }
}
