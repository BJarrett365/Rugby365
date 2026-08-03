import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  AUDIO_COMPETITION_SCOPES,
  AUDIO_DELIVERY_STYLES,
  AUDIO_DELIVERY_STYLE_LABELS,
  AUDIO_TONE_PRESETS,
  AUDIO_VOICE_STYLES,
  AUDIO_VOICE_STYLE_LABELS,
  OPENAI_VOICE_OPTIONS,
  listAdminVoiceProfiles,
  listCommentaryDefaults,
  updateCommentaryDefaults,
  updateVoiceProfile,
  type AudioTtsProvider,
} from "@/lib/audio-voice-settings-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? undefined;
    const [profiles, defaults] = await Promise.all([
      listAdminVoiceProfiles(scope ? { competitionScope: scope } : undefined),
      listCommentaryDefaults(),
    ]);
    return NextResponse.json({
      ok: true,
      profiles,
      defaults,
      scopes: AUDIO_COMPETITION_SCOPES,
      tonePresets: AUDIO_TONE_PRESETS,
      voiceStyles: AUDIO_VOICE_STYLES,
      voiceStyleLabels: AUDIO_VOICE_STYLE_LABELS,
      deliveryStyles: AUDIO_DELIVERY_STYLES,
      deliveryStyleLabels: AUDIO_DELIVERY_STYLE_LABELS,
      openaiVoices: OPENAI_VOICE_OPTIONS,
      speakerRoles: ["lead", "analyst", "sideline", "guest"],
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load audio commentary settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      kind?: "profile" | "defaults";
      profileId?: string;
      competitionScope?: string;
      patch?: Record<string, unknown>;
    };

    if (body.kind === "defaults") {
      const scope = body.competitionScope?.trim();
      if (!scope) {
        return NextResponse.json({ error: "competitionScope required" }, { status: 400 });
      }
      const patch = body.patch ?? {};
      const updated = await updateCommentaryDefaults(scope, {
        label: typeof patch.label === "string" ? patch.label : undefined,
        accentLabel:
          patch.accentLabel === null
            ? null
            : typeof patch.accentLabel === "string"
              ? patch.accentLabel
              : undefined,
        locale: typeof patch.locale === "string" ? patch.locale : undefined,
        stadiumAmbienceKey:
          patch.stadiumAmbienceKey === null
            ? null
            : typeof patch.stadiumAmbienceKey === "string"
              ? patch.stadiumAmbienceKey
              : undefined,
        presenterCount:
          typeof patch.presenterCount === "number" ? patch.presenterCount : undefined,
        leadProfileId:
          patch.leadProfileId === null
            ? null
            : typeof patch.leadProfileId === "string"
              ? patch.leadProfileId
              : undefined,
        analystProfileId:
          patch.analystProfileId === null
            ? null
            : typeof patch.analystProfileId === "string"
              ? patch.analystProfileId
              : undefined,
        sidelineProfileId:
          patch.sidelineProfileId === null
            ? null
            : typeof patch.sidelineProfileId === "string"
              ? patch.sidelineProfileId
              : undefined,
        guestProfileId:
          patch.guestProfileId === null
            ? null
            : typeof patch.guestProfileId === "string"
              ? patch.guestProfileId
              : undefined,
        voiceStyle:
          patch.voiceStyle === null
            ? null
            : typeof patch.voiceStyle === "string"
              ? patch.voiceStyle
              : undefined,
        deliveryStyle:
          patch.deliveryStyle === null
            ? null
            : typeof patch.deliveryStyle === "string"
              ? patch.deliveryStyle
              : undefined,
        optimiseDualCommentary:
          typeof patch.optimiseDualCommentary === "boolean"
            ? patch.optimiseDualCommentary
            : undefined,
        emphasiseScoreboard:
          typeof patch.emphasiseScoreboard === "boolean"
            ? patch.emphasiseScoreboard
            : undefined,
        aiPrompt:
          patch.aiPrompt === null
            ? null
            : typeof patch.aiPrompt === "string"
              ? patch.aiPrompt
              : undefined,
        notes:
          patch.notes === null
            ? null
            : typeof patch.notes === "string"
              ? patch.notes
              : undefined,
      });
      return NextResponse.json({ ok: true, defaults: updated });
    }

    const profileId = body.profileId?.trim();
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }
    const patch = body.patch ?? {};
    const provider =
      patch.provider === "openai" ||
      patch.provider === "elevenlabs" ||
      patch.provider === "auto"
        ? (patch.provider as AudioTtsProvider)
        : undefined;

    const updated = await updateVoiceProfile(profileId, {
      displayName: typeof patch.displayName === "string" ? patch.displayName : undefined,
      organisationLabel:
        patch.organisationLabel === null
          ? null
          : typeof patch.organisationLabel === "string"
            ? patch.organisationLabel
            : undefined,
      topicLabel:
        patch.topicLabel === null
          ? null
          : typeof patch.topicLabel === "string"
            ? patch.topicLabel
            : undefined,
      voiceStyle: typeof patch.voiceStyle === "string" ? patch.voiceStyle : undefined,
      deliveryStyle:
        typeof patch.deliveryStyle === "string" ? patch.deliveryStyle : undefined,
      aiPrompt:
        patch.aiPrompt === null
          ? null
          : typeof patch.aiPrompt === "string"
            ? patch.aiPrompt
            : undefined,
      provider,
      elevenlabsVoiceId:
        patch.elevenlabsVoiceId === null
          ? null
          : typeof patch.elevenlabsVoiceId === "string"
            ? patch.elevenlabsVoiceId
            : undefined,
      openaiVoice:
        patch.openaiVoice === null
          ? null
          : typeof patch.openaiVoice === "string"
            ? patch.openaiVoice
            : undefined,
      speed: typeof patch.speed === "number" ? patch.speed : undefined,
      tone: typeof patch.tone === "string" ? patch.tone : undefined,
      pitch:
        patch.pitch === null
          ? null
          : typeof patch.pitch === "string"
            ? patch.pitch
            : undefined,
      stability:
        patch.stability === null
          ? null
          : typeof patch.stability === "number"
            ? patch.stability
            : undefined,
      similarityBoost:
        patch.similarityBoost === null
          ? null
          : typeof patch.similarityBoost === "number"
            ? patch.similarityBoost
            : undefined,
      styleExaggeration:
        patch.styleExaggeration === null
          ? null
          : typeof patch.styleExaggeration === "number"
            ? patch.styleExaggeration
            : undefined,
      accent:
        patch.accent === null
          ? null
          : typeof patch.accent === "string"
            ? patch.accent
            : undefined,
      locale: typeof patch.locale === "string" ? patch.locale : undefined,
      isDefault: typeof patch.isDefault === "boolean" ? patch.isDefault : undefined,
      status: typeof patch.status === "string" ? patch.status : undefined,
      notes:
        patch.notes === null
          ? null
          : typeof patch.notes === "string"
            ? patch.notes
            : undefined,
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update audio commentary settings");
  }
}
