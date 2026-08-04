/**
 * Resolve Live Audio Commentary voice profiles:
 * match override → competition defaults → Currie Cup / global fallback.
 * Voice IDs stay server-side — never ship on public Match Animation APIs.
 */

import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  audioCommentaryDefaults,
  audioCommentaryScripts,
  audioMatchVoiceSettings,
  audioVoiceProfiles,
  competitions,
  fixtures,
  teams,
} from "@rugby365/db";
import {
  AUDIO_COMPETITION_SCOPES,
  AUDIO_DELIVERY_STYLES,
  AUDIO_DELIVERY_STYLE_LABELS,
  AUDIO_SPEAKER_ROLES,
  AUDIO_SPEAKER_ROLE_HINTS,
  AUDIO_SPEAKER_ROLE_LABELS,
  AUDIO_TONE_PRESETS,
  AUDIO_VOICE_STYLES,
  AUDIO_VOICE_STYLE_LABELS,
  OPENAI_VOICE_OPTIONS,
  accentDisplayLabel,
  clampPresenterCount,
  clampSpeechSpeed,
  competitionScopeFromSlugOrName,
  formatCreatorProfileLabel,
  normalizeDeliveryStyle,
  normalizeTtsProvider,
  normalizeVoiceStyle,
  parseVoiceOverrides,
  preferredAccentFiltersForScope,
  rolesForPresenterCount,
  scopeTopicLabel,
  tonePresetSettings,
  type AudioDeliveryStyle,
  type AudioPresenterCount,
  type AudioSpeakerRole,
  type AudioTtsProvider,
  type AudioVoiceStyle,
  type MatchVoiceOverridesMap,
} from "./audio-voice-settings";
import { getDb } from "./db";

export {
  AUDIO_COMPETITION_SCOPES,
  AUDIO_DELIVERY_STYLES,
  AUDIO_DELIVERY_STYLE_LABELS,
  AUDIO_SPEAKER_ROLES,
  AUDIO_SPEAKER_ROLE_HINTS,
  AUDIO_SPEAKER_ROLE_LABELS,
  AUDIO_TONE_PRESETS,
  AUDIO_VOICE_STYLES,
  AUDIO_VOICE_STYLE_LABELS,
  OPENAI_VOICE_OPTIONS,
  accentDisplayLabel,
  clampPresenterCount,
  clampSpeechSpeed,
  competitionScopeFromSlugOrName,
  formatCreatorProfileLabel,
  normalizeDeliveryStyle,
  normalizeTtsProvider,
  normalizeVoiceStyle,
  parseVoiceOverrides,
  preferredAccentFiltersForScope,
  rolesForPresenterCount,
  scopeTopicLabel,
  tonePresetSettings,
};
export type {
  AudioDeliveryStyle,
  AudioPresenterCount,
  AudioSpeakerRole,
  AudioTtsProvider,
  AudioVoiceStyle,
  MatchVoiceOverridesMap,
};

export type ResolvedVoiceProfile = {
  profileId: string;
  slug: string;
  displayName: string;
  /** Plexa-style: Name · Accent · Competition */
  creatorProfileLabel: string;
  role: AudioSpeakerRole;
  provider: AudioTtsProvider;
  elevenlabsVoiceId: string | null;
  openaiVoice: string | null;
  speed: number;
  tone: string;
  voiceStyle: AudioVoiceStyle;
  deliveryStyle: AudioDeliveryStyle;
  aiPrompt: string | null;
  pitch: string | null;
  stability: number | null;
  similarityBoost: number | null;
  styleExaggeration: number | null;
  accent: string | null;
  organisationLabel: string | null;
  topicLabel: string | null;
  locale: string;
  competitionScope: string | null;
  source: "match_override" | "competition_default" | "profile_default" | "fallback";
  defaultsLabel: string | null;
  stadiumAmbienceKey: string | null;
  accentLabel: string | null;
  optimiseDualCommentary: boolean;
  emphasiseScoreboard: boolean;
};

export type AdminVoiceProfileDto = {
  id: string;
  slug: string;
  displayName: string;
  creatorProfileLabel: string;
  role: string;
  accent: string | null;
  organisationLabel: string | null;
  topicLabel: string | null;
  locale: string;
  voiceStyle: string;
  deliveryStyle: string;
  aiPrompt: string | null;
  provider: string;
  /** Admin-only — never forward to public APIs. */
  elevenlabsVoiceId: string | null;
  openaiVoice: string | null;
  voiceConfigured: boolean;
  speed: number;
  tone: string;
  pitch: string | null;
  stability: number | null;
  similarityBoost: number | null;
  styleExaggeration: number | null;
  competitionScope: string | null;
  isDefault: boolean;
  status: string;
  notes: string | null;
};

export type AdminCommentaryDefaultsDto = {
  id: string;
  competitionScope: string;
  label: string;
  accentLabel: string | null;
  locale: string;
  stadiumAmbienceKey: string | null;
  presenterCount: AudioPresenterCount;
  leadProfileId: string | null;
  analystProfileId: string | null;
  sidelineProfileId: string | null;
  guestProfileId: string | null;
  voiceStyle: string | null;
  deliveryStyle: string | null;
  optimiseDualCommentary: boolean;
  emphasiseScoreboard: boolean;
  aiPrompt: string | null;
  notes: string | null;
};

export type MatchVoiceSettingsDto = {
  fixtureId: string;
  hasOverride: boolean;
  presenterCount: AudioPresenterCount;
  /** Null when inheriting division default count. */
  presenterCountOverride: number | null;
  leadProfileId: string | null;
  analystProfileId: string | null;
  sidelineProfileId: string | null;
  guestProfileId: string | null;
  leadSpeed: number | null;
  analystSpeed: number | null;
  sidelineSpeed: number | null;
  guestSpeed: number | null;
  leadTone: string | null;
  analystTone: string | null;
  sidelineTone: string | null;
  guestTone: string | null;
  leadVoiceStyle: string | null;
  analystVoiceStyle: string | null;
  sidelineVoiceStyle: string | null;
  guestVoiceStyle: string | null;
  leadDeliveryStyle: string | null;
  analystDeliveryStyle: string | null;
  sidelineDeliveryStyle: string | null;
  guestDeliveryStyle: string | null;
  /** Admin-only per-role voice ID overrides for this match. */
  voiceOverrides: MatchVoiceOverridesMap;
  optimiseDualCommentary: boolean | null;
  emphasiseScoreboard: boolean | null;
  aiPrompt: string | null;
  notes: string | null;
  competitionScope: string;
  defaultsLabel: string | null;
  accentLabel: string | null;
  stadiumAmbienceKey: string | null;
  activeRoles: AudioSpeakerRole[];
  active: Partial<Record<AudioSpeakerRole, ResolvedVoiceProfilePublic>> & {
    lead: ResolvedVoiceProfilePublic;
  };
};

/** Safe for admin UI — includes voice IDs only for editing. */
export type ResolvedVoiceProfilePublic = Omit<
  ResolvedVoiceProfile,
  "elevenlabsVoiceId" | "openaiVoice"
> & {
  voiceConfigured: boolean;
  elevenlabsVoiceId: string | null;
  openaiVoice: string | null;
};

function toAdminProfile(
  row: typeof audioVoiceProfiles.$inferSelect,
): AdminVoiceProfileDto {
  const organisationLabel = row.organisationLabel;
  const topicLabel = row.topicLabel;
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    creatorProfileLabel: formatCreatorProfileLabel({
      displayName: row.displayName,
      organisationLabel,
      topicLabel,
      accent: row.accent,
      competitionScope: row.competitionScope,
    }),
    role: row.role,
    accent: row.accent,
    organisationLabel,
    topicLabel,
    locale: row.locale,
    voiceStyle: normalizeVoiceStyle(row.voiceStyle),
    deliveryStyle: normalizeDeliveryStyle(row.deliveryStyle),
    aiPrompt: row.aiPrompt,
    provider: normalizeTtsProvider(row.provider),
    elevenlabsVoiceId: row.elevenlabsVoiceId,
    openaiVoice: row.openaiVoice,
    voiceConfigured: Boolean(
      normalizeTtsProvider(row.provider) === "openai"
        ? row.openaiVoice?.trim()
        : row.elevenlabsVoiceId?.trim() || row.openaiVoice?.trim(),
    ),
    speed: clampSpeechSpeed(row.speed),
    tone: row.tone || "broadcast",
    pitch: row.pitch,
    stability: row.stability,
    similarityBoost: row.similarityBoost,
    styleExaggeration: row.styleExaggeration,
    competitionScope: row.competitionScope,
    isDefault: row.isDefault,
    status: row.status,
    notes: row.notes,
  };
}

function publicResolved(r: ResolvedVoiceProfile): ResolvedVoiceProfilePublic {
  return {
    ...r,
    voiceConfigured: Boolean(
      r.provider === "openai"
        ? r.openaiVoice?.trim()
        : r.elevenlabsVoiceId?.trim() || r.openaiVoice?.trim(),
    ),
  };
}

function profileIdForRole(
  role: AudioSpeakerRole,
  row: {
    leadProfileId?: string | null;
    analystProfileId?: string | null;
    sidelineProfileId?: string | null;
    guestProfileId?: string | null;
  } | null | undefined,
): string | null {
  if (!row) return null;
  if (role === "lead") return row.leadProfileId ?? null;
  if (role === "analyst") return row.analystProfileId ?? null;
  if (role === "sideline") return row.sidelineProfileId ?? null;
  return row.guestProfileId ?? null;
}

export async function listAdminVoiceProfiles(options?: {
  competitionScope?: string;
  status?: string;
}): Promise<AdminVoiceProfileDto[]> {
  const db = getDb();
  const conditions = [];
  if (options?.competitionScope) {
    conditions.push(eq(audioVoiceProfiles.competitionScope, options.competitionScope));
  }
  if (options?.status) {
    conditions.push(eq(audioVoiceProfiles.status, options.status));
  } else {
    conditions.push(eq(audioVoiceProfiles.status, "active"));
  }

  const rows = await db
    .select()
    .from(audioVoiceProfiles)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(audioVoiceProfiles.competitionScope), asc(audioVoiceProfiles.role));

  return rows.map(toAdminProfile);
}

export async function listCommentaryDefaults(): Promise<AdminCommentaryDefaultsDto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(audioCommentaryDefaults)
    .orderBy(asc(audioCommentaryDefaults.competitionScope));
  return rows.map((row) => ({
    id: row.id,
    competitionScope: row.competitionScope,
    label: row.label,
    accentLabel: row.accentLabel,
    locale: row.locale,
    stadiumAmbienceKey: row.stadiumAmbienceKey,
    presenterCount: clampPresenterCount(row.presenterCount),
    leadProfileId: row.leadProfileId,
    analystProfileId: row.analystProfileId,
    sidelineProfileId: row.sidelineProfileId,
    guestProfileId: row.guestProfileId,
    voiceStyle: row.voiceStyle ? normalizeVoiceStyle(row.voiceStyle) : "journalist",
    deliveryStyle: row.deliveryStyle
      ? normalizeDeliveryStyle(row.deliveryStyle)
      : "balanced",
    optimiseDualCommentary: row.optimiseDualCommentary ?? true,
    emphasiseScoreboard: row.emphasiseScoreboard ?? true,
    aiPrompt: row.aiPrompt,
    notes: row.notes,
  }));
}

export async function updateVoiceProfile(
  profileId: string,
  patch: Partial<{
    displayName: string;
    organisationLabel: string | null;
    topicLabel: string | null;
    voiceStyle: string;
    deliveryStyle: string;
    aiPrompt: string | null;
    provider: AudioTtsProvider;
    elevenlabsVoiceId: string | null;
    openaiVoice: string | null;
    speed: number;
    tone: string;
    pitch: string | null;
    stability: number | null;
    similarityBoost: number | null;
    styleExaggeration: number | null;
    accent: string | null;
    locale: string;
    isDefault: boolean;
    status: string;
    notes: string | null;
  }>,
): Promise<AdminVoiceProfileDto> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(audioVoiceProfiles)
    .where(eq(audioVoiceProfiles.id, profileId))
    .limit(1);
  if (!existing) throw new Error("Voice profile not found");

  const [updated] = await db
    .update(audioVoiceProfiles)
    .set({
      ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
      ...(patch.organisationLabel !== undefined
        ? { organisationLabel: patch.organisationLabel?.trim() || null }
        : {}),
      ...(patch.topicLabel !== undefined
        ? { topicLabel: patch.topicLabel?.trim() || null }
        : {}),
      ...(patch.voiceStyle !== undefined
        ? { voiceStyle: normalizeVoiceStyle(patch.voiceStyle) }
        : {}),
      ...(patch.deliveryStyle !== undefined
        ? { deliveryStyle: normalizeDeliveryStyle(patch.deliveryStyle) }
        : {}),
      ...(patch.aiPrompt !== undefined
        ? { aiPrompt: patch.aiPrompt?.trim() || null }
        : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.elevenlabsVoiceId !== undefined
        ? { elevenlabsVoiceId: patch.elevenlabsVoiceId?.trim() || null }
        : {}),
      ...(patch.openaiVoice !== undefined
        ? { openaiVoice: patch.openaiVoice?.trim() || null }
        : {}),
      ...(patch.speed !== undefined ? { speed: clampSpeechSpeed(patch.speed) } : {}),
      ...(patch.tone !== undefined ? { tone: patch.tone.trim().slice(0, 64) || "broadcast" } : {}),
      ...(patch.pitch !== undefined ? { pitch: patch.pitch?.trim() || null } : {}),
      ...(patch.stability !== undefined ? { stability: patch.stability } : {}),
      ...(patch.similarityBoost !== undefined ? { similarityBoost: patch.similarityBoost } : {}),
      ...(patch.styleExaggeration !== undefined
        ? { styleExaggeration: patch.styleExaggeration }
        : {}),
      ...(patch.accent !== undefined ? { accent: patch.accent?.trim() || null } : {}),
      ...(patch.locale !== undefined ? { locale: patch.locale.trim() || "en-ZA" } : {}),
      ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(audioVoiceProfiles.id, profileId))
    .returning();

  return toAdminProfile(updated!);
}

export async function updateCommentaryDefaults(
  competitionScope: string,
  patch: Partial<{
    label: string;
    accentLabel: string | null;
    locale: string;
    stadiumAmbienceKey: string | null;
    presenterCount: number;
    leadProfileId: string | null;
    analystProfileId: string | null;
    sidelineProfileId: string | null;
    guestProfileId: string | null;
    voiceStyle: string | null;
    deliveryStyle: string | null;
    optimiseDualCommentary: boolean;
    emphasiseScoreboard: boolean;
    aiPrompt: string | null;
    notes: string | null;
  }>,
): Promise<AdminCommentaryDefaultsDto> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(audioCommentaryDefaults)
    .where(eq(audioCommentaryDefaults.competitionScope, competitionScope))
    .limit(1);

  const toDto = (row: typeof audioCommentaryDefaults.$inferSelect): AdminCommentaryDefaultsDto => ({
    id: row.id,
    competitionScope: row.competitionScope,
    label: row.label,
    accentLabel: row.accentLabel,
    locale: row.locale,
    stadiumAmbienceKey: row.stadiumAmbienceKey,
    presenterCount: clampPresenterCount(row.presenterCount),
    leadProfileId: row.leadProfileId,
    analystProfileId: row.analystProfileId,
    sidelineProfileId: row.sidelineProfileId,
    guestProfileId: row.guestProfileId,
    voiceStyle: row.voiceStyle ? normalizeVoiceStyle(row.voiceStyle) : "journalist",
    deliveryStyle: row.deliveryStyle
      ? normalizeDeliveryStyle(row.deliveryStyle)
      : "balanced",
    optimiseDualCommentary: row.optimiseDualCommentary ?? true,
    emphasiseScoreboard: row.emphasiseScoreboard ?? true,
    aiPrompt: row.aiPrompt,
    notes: row.notes,
  });

  if (!existing) {
    const [created] = await db
      .insert(audioCommentaryDefaults)
      .values({
        competitionScope,
        label: patch.label?.trim() || competitionScope,
        accentLabel: patch.accentLabel ?? null,
        locale: patch.locale?.trim() || "en-ZA",
        stadiumAmbienceKey: patch.stadiumAmbienceKey ?? null,
        presenterCount: clampPresenterCount(patch.presenterCount ?? 2),
        leadProfileId: patch.leadProfileId ?? null,
        analystProfileId: patch.analystProfileId ?? null,
        sidelineProfileId: patch.sidelineProfileId ?? null,
        guestProfileId: patch.guestProfileId ?? null,
        voiceStyle: patch.voiceStyle
          ? normalizeVoiceStyle(patch.voiceStyle)
          : "journalist",
        deliveryStyle: patch.deliveryStyle
          ? normalizeDeliveryStyle(patch.deliveryStyle)
          : "balanced",
        optimiseDualCommentary: patch.optimiseDualCommentary ?? true,
        emphasiseScoreboard: patch.emphasiseScoreboard ?? true,
        aiPrompt: patch.aiPrompt ?? null,
        notes: patch.notes ?? null,
      })
      .returning();
    return toDto(created!);
  }

  const [updated] = await db
    .update(audioCommentaryDefaults)
    .set({
      ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
      ...(patch.accentLabel !== undefined
        ? { accentLabel: patch.accentLabel?.trim() || null }
        : {}),
      ...(patch.locale !== undefined ? { locale: patch.locale.trim() || "en-ZA" } : {}),
      ...(patch.stadiumAmbienceKey !== undefined
        ? { stadiumAmbienceKey: patch.stadiumAmbienceKey?.trim() || null }
        : {}),
      ...(patch.presenterCount !== undefined
        ? { presenterCount: clampPresenterCount(patch.presenterCount) }
        : {}),
      ...(patch.leadProfileId !== undefined ? { leadProfileId: patch.leadProfileId } : {}),
      ...(patch.analystProfileId !== undefined
        ? { analystProfileId: patch.analystProfileId }
        : {}),
      ...(patch.sidelineProfileId !== undefined
        ? { sidelineProfileId: patch.sidelineProfileId }
        : {}),
      ...(patch.guestProfileId !== undefined
        ? { guestProfileId: patch.guestProfileId }
        : {}),
      ...(patch.voiceStyle !== undefined
        ? {
            voiceStyle: patch.voiceStyle
              ? normalizeVoiceStyle(patch.voiceStyle)
              : null,
          }
        : {}),
      ...(patch.deliveryStyle !== undefined
        ? {
            deliveryStyle: patch.deliveryStyle
              ? normalizeDeliveryStyle(patch.deliveryStyle)
              : null,
          }
        : {}),
      ...(patch.optimiseDualCommentary !== undefined
        ? { optimiseDualCommentary: patch.optimiseDualCommentary }
        : {}),
      ...(patch.emphasiseScoreboard !== undefined
        ? { emphasiseScoreboard: patch.emphasiseScoreboard }
        : {}),
      ...(patch.aiPrompt !== undefined
        ? { aiPrompt: patch.aiPrompt?.trim() || null }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(audioCommentaryDefaults.id, existing.id))
    .returning();

  return toDto(updated!);
}

async function loadFixtureCompetition(fixtureId: string): Promise<{
  fixtureId: string;
  competitionScope: string;
  competitionSlug: string | null;
  competitionName: string | null;
}> {
  const db = getDb();
  const [row] = await db
    .select({
      fixtureId: fixtures.id,
      competitionName: fixtures.competitionName,
      competitionSlug: competitions.slug,
      competitionDbName: competitions.name,
    })
    .from(fixtures)
    .leftJoin(competitions, eq(competitions.id, fixtures.competitionId))
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  if (!row) throw new Error("Fixture not found");

  const scope = competitionScopeFromSlugOrName(
    row.competitionSlug,
    row.competitionDbName ?? row.competitionName,
  );
  return {
    fixtureId: row.fixtureId,
    competitionScope: scope,
    competitionSlug: row.competitionSlug,
    competitionName: row.competitionDbName ?? row.competitionName,
  };
}

async function loadDefaultsRow(scope: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(audioCommentaryDefaults)
    .where(eq(audioCommentaryDefaults.competitionScope, scope))
    .limit(1);
  if (row) return row;
  if (scope !== "currie_cup") {
    const [currie] = await db
      .select()
      .from(audioCommentaryDefaults)
      .where(eq(audioCommentaryDefaults.competitionScope, "currie_cup"))
      .limit(1);
    if (currie) return currie;
  }
  const [global] = await db
    .select()
    .from(audioCommentaryDefaults)
    .where(eq(audioCommentaryDefaults.competitionScope, "global"))
    .limit(1);
  return global ?? null;
}

async function loadProfileById(id: string | null | undefined) {
  if (!id) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(audioVoiceProfiles)
    .where(and(eq(audioVoiceProfiles.id, id), eq(audioVoiceProfiles.status, "active")))
    .limit(1);
  return row ?? null;
}

async function loadDefaultProfileForRole(
  role: AudioSpeakerRole,
  scope: string,
): Promise<typeof audioVoiceProfiles.$inferSelect | null> {
  const db = getDb();
  const scopes = scope === "currie_cup" ? ["currie_cup", "global"] : [scope, "currie_cup", "global"];
  for (const s of scopes) {
    const [row] = await db
      .select()
      .from(audioVoiceProfiles)
      .where(
        and(
          eq(audioVoiceProfiles.role, role),
          eq(audioVoiceProfiles.competitionScope, s),
          eq(audioVoiceProfiles.isDefault, true),
          eq(audioVoiceProfiles.status, "active"),
        ),
      )
      .limit(1);
    if (row) return row;
  }
  const [any] = await db
    .select()
    .from(audioVoiceProfiles)
    .where(and(eq(audioVoiceProfiles.role, role), eq(audioVoiceProfiles.status, "active")))
    .limit(1);
  return any ?? null;
}

function buildResolved(input: {
  profile: typeof audioVoiceProfiles.$inferSelect;
  role: AudioSpeakerRole;
  speedOverride?: number | null;
  toneOverride?: string | null;
  voiceStyleOverride?: string | null;
  deliveryStyleOverride?: string | null;
  aiPromptOverride?: string | null;
  voiceOverride?: MatchVoiceOverridesMap[AudioSpeakerRole];
  source: ResolvedVoiceProfile["source"];
  defaultsLabel: string | null;
  stadiumAmbienceKey: string | null;
  accentLabel: string | null;
  defaultsVoiceStyle?: string | null;
  defaultsDeliveryStyle?: string | null;
  defaultsAiPrompt?: string | null;
  optimiseDualCommentary: boolean;
  emphasiseScoreboard: boolean;
}): ResolvedVoiceProfile {
  const provider: AudioTtsProvider = normalizeTtsProvider(
    input.voiceOverride?.provider ?? input.profile.provider,
  );
  const organisationLabel = input.profile.organisationLabel;
  const topicLabel = input.profile.topicLabel;
  const voiceStyle = normalizeVoiceStyle(
    input.voiceStyleOverride ||
      input.defaultsVoiceStyle ||
      input.profile.voiceStyle,
  );
  const deliveryStyle = normalizeDeliveryStyle(
    input.deliveryStyleOverride ||
      input.defaultsDeliveryStyle ||
      input.profile.deliveryStyle,
  );
  const aiPrompt =
    input.aiPromptOverride?.trim() ||
    input.defaultsAiPrompt?.trim() ||
    input.profile.aiPrompt?.trim() ||
    null;

  const elevenlabsVoiceId =
    input.voiceOverride?.elevenlabsVoiceId !== undefined
      ? input.voiceOverride.elevenlabsVoiceId
      : input.profile.elevenlabsVoiceId;
  const openaiVoice =
    input.voiceOverride?.openaiVoice !== undefined
      ? input.voiceOverride.openaiVoice
      : input.profile.openaiVoice;

  return {
    profileId: input.profile.id,
    slug: input.profile.slug,
    displayName: input.profile.displayName,
    creatorProfileLabel: formatCreatorProfileLabel({
      displayName: input.profile.displayName,
      organisationLabel,
      topicLabel,
      accent: input.profile.accent,
      competitionScope: input.profile.competitionScope,
    }),
    role: input.role,
    provider,
    elevenlabsVoiceId,
    openaiVoice,
    speed: clampSpeechSpeed(
      input.speedOverride ?? input.profile.speed,
      clampSpeechSpeed(input.profile.speed),
    ),
    tone: (input.toneOverride?.trim() || input.profile.tone || "broadcast").slice(0, 64),
    voiceStyle,
    deliveryStyle,
    aiPrompt,
    pitch: input.profile.pitch,
    stability: input.profile.stability,
    similarityBoost: input.profile.similarityBoost,
    styleExaggeration: input.profile.styleExaggeration,
    accent: input.profile.accent,
    organisationLabel,
    topicLabel,
    locale: input.profile.locale,
    competitionScope: input.profile.competitionScope,
    source: input.source,
    defaultsLabel: input.defaultsLabel,
    stadiumAmbienceKey: input.stadiumAmbienceKey,
    accentLabel: input.accentLabel ?? organisationLabel ?? accentDisplayLabel(input.profile.accent),
    optimiseDualCommentary: input.optimiseDualCommentary,
    emphasiseScoreboard: input.emphasiseScoreboard,
  };
}

/**
 * Resolve the active voice for a fixture speaker role.
 * Precedence: match override profile (+ optional speed/tone/voice IDs) → competition defaults → profile defaults.
 */
export async function resolveVoiceProfileForFixture(
  fixtureId: string,
  role: AudioSpeakerRole,
): Promise<ResolvedVoiceProfile> {
  const { competitionScope } = await loadFixtureCompetition(fixtureId);
  const defaults = await loadDefaultsRow(competitionScope);
  const db = getDb();
  const [matchRow] = await db
    .select()
    .from(audioMatchVoiceSettings)
    .where(eq(audioMatchVoiceSettings.fixtureId, fixtureId))
    .limit(1);

  const voiceOverrides = parseVoiceOverrides(matchRow?.voiceOverrides);

  const overrideProfileId = profileIdForRole(role, matchRow);
  const speedOverride =
    role === "lead"
      ? matchRow?.leadSpeed
      : role === "analyst"
        ? matchRow?.analystSpeed
        : role === "sideline"
          ? matchRow?.sidelineSpeed
          : matchRow?.guestSpeed;
  const toneOverride =
    role === "lead"
      ? matchRow?.leadTone
      : role === "analyst"
        ? matchRow?.analystTone
        : role === "sideline"
          ? matchRow?.sidelineTone
          : matchRow?.guestTone;
  const voiceStyleOverride =
    role === "lead"
      ? matchRow?.leadVoiceStyle
      : role === "analyst"
        ? matchRow?.analystVoiceStyle
        : role === "sideline"
          ? matchRow?.sidelineVoiceStyle
          : matchRow?.guestVoiceStyle;
  const deliveryStyleOverride =
    role === "lead"
      ? matchRow?.leadDeliveryStyle
      : role === "analyst"
        ? matchRow?.analystDeliveryStyle
        : role === "sideline"
          ? matchRow?.sidelineDeliveryStyle
          : matchRow?.guestDeliveryStyle;

  const defaultsProfileId = profileIdForRole(role, defaults);

  let profile = await loadProfileById(overrideProfileId ?? undefined);
  let source: ResolvedVoiceProfile["source"] = "match_override";

  if (!profile) {
    profile = await loadProfileById(defaultsProfileId ?? undefined);
    source = "competition_default";
  }
  if (!profile) {
    profile = await loadDefaultProfileForRole(role, competitionScope);
    source = "profile_default";
  }
  if (!profile) {
    throw new Error(
      `No voice profile for ${role} (scope ${competitionScope}). Configure Admin → Audio Commentary.`,
    );
  }

  const roleVoiceOverride = voiceOverrides[role];
  const hasVoiceIdOverride = Boolean(
    roleVoiceOverride &&
      (roleVoiceOverride.elevenlabsVoiceId ||
        roleVoiceOverride.openaiVoice ||
        roleVoiceOverride.provider),
  );

  // Speed/tone/style-only match overrides still count as match_override when set.
  const hasStyleOverride = Boolean(
    speedOverride != null ||
      (toneOverride && toneOverride.trim()) ||
      (voiceStyleOverride && voiceStyleOverride.trim()) ||
      (deliveryStyleOverride && deliveryStyleOverride.trim()) ||
      matchRow?.optimiseDualCommentary != null ||
      matchRow?.emphasiseScoreboard != null ||
      (matchRow?.aiPrompt && matchRow.aiPrompt.trim()) ||
      hasVoiceIdOverride ||
      matchRow?.presenterCount != null,
  );
  if (matchRow && !overrideProfileId && hasStyleOverride) {
    source = "match_override";
  } else if (!overrideProfileId && source === "match_override") {
    source = defaults ? "competition_default" : "profile_default";
  }

  return buildResolved({
    profile,
    role,
    speedOverride,
    toneOverride,
    voiceStyleOverride,
    deliveryStyleOverride,
    aiPromptOverride: matchRow?.aiPrompt,
    voiceOverride: roleVoiceOverride,
    source,
    defaultsLabel: defaults?.label ?? null,
    stadiumAmbienceKey: defaults?.stadiumAmbienceKey ?? null,
    accentLabel: defaults?.accentLabel ?? null,
    defaultsVoiceStyle: defaults?.voiceStyle,
    defaultsDeliveryStyle: defaults?.deliveryStyle,
    defaultsAiPrompt: defaults?.aiPrompt,
    optimiseDualCommentary:
      matchRow?.optimiseDualCommentary ?? defaults?.optimiseDualCommentary ?? true,
    emphasiseScoreboard:
      matchRow?.emphasiseScoreboard ?? defaults?.emphasiseScoreboard ?? true,
  });
}

export async function resolvePresenterCountForFixture(
  fixtureId: string,
): Promise<AudioPresenterCount> {
  const { competitionScope } = await loadFixtureCompetition(fixtureId);
  const defaults = await loadDefaultsRow(competitionScope);
  const db = getDb();
  const [matchRow] = await db
    .select({ presenterCount: audioMatchVoiceSettings.presenterCount })
    .from(audioMatchVoiceSettings)
    .where(eq(audioMatchVoiceSettings.fixtureId, fixtureId))
    .limit(1);
  if (matchRow?.presenterCount != null) {
    return clampPresenterCount(matchRow.presenterCount);
  }
  return clampPresenterCount(defaults?.presenterCount ?? 2);
}

export async function getMatchVoiceSettingsAdmin(
  fixtureId: string,
): Promise<MatchVoiceSettingsDto> {
  const { competitionScope } = await loadFixtureCompetition(fixtureId);
  const defaults = await loadDefaultsRow(competitionScope);
  const db = getDb();
  const [matchRow] = await db
    .select()
    .from(audioMatchVoiceSettings)
    .where(eq(audioMatchVoiceSettings.fixtureId, fixtureId))
    .limit(1);

  const presenterCount = clampPresenterCount(
    matchRow?.presenterCount ?? defaults?.presenterCount ?? 2,
  );
  const activeRoles = rolesForPresenterCount(presenterCount);
  const voiceOverrides = parseVoiceOverrides(matchRow?.voiceOverrides);

  // Always resolve Lead + Analyst for admin display (scripts are dual-voice),
  // even when presenterCount is temporarily 1 — prevents UI crashes and makes
  // the inherited Analyst profile visible so operators can bump back to 2.
  const displayRoles = Array.from(
    new Set<AudioSpeakerRole>(["lead", "analyst", ...activeRoles]),
  );
  const active: MatchVoiceSettingsDto["active"] = {
    lead: publicResolved(await resolveVoiceProfileForFixture(fixtureId, "lead")),
  };
  for (const role of displayRoles) {
    if (role === "lead") continue;
    try {
      active[role] = publicResolved(await resolveVoiceProfileForFixture(fixtureId, role));
    } catch {
      /* role has no profile yet — omit from active */
    }
  }

  const hasOverride = Boolean(
    matchRow &&
      (matchRow.presenterCount != null ||
        matchRow.leadProfileId ||
        matchRow.analystProfileId ||
        matchRow.sidelineProfileId ||
        matchRow.guestProfileId ||
        matchRow.leadSpeed != null ||
        matchRow.analystSpeed != null ||
        matchRow.sidelineSpeed != null ||
        matchRow.guestSpeed != null ||
        matchRow.leadTone ||
        matchRow.analystTone ||
        matchRow.sidelineTone ||
        matchRow.guestTone ||
        matchRow.leadVoiceStyle ||
        matchRow.analystVoiceStyle ||
        matchRow.sidelineVoiceStyle ||
        matchRow.guestVoiceStyle ||
        matchRow.leadDeliveryStyle ||
        matchRow.analystDeliveryStyle ||
        matchRow.sidelineDeliveryStyle ||
        matchRow.guestDeliveryStyle ||
        matchRow.optimiseDualCommentary != null ||
        matchRow.emphasiseScoreboard != null ||
        matchRow.aiPrompt ||
        Object.keys(voiceOverrides).length > 0),
  );

  return {
    fixtureId,
    hasOverride,
    presenterCount,
    presenterCountOverride: matchRow?.presenterCount ?? null,
    leadProfileId: matchRow?.leadProfileId ?? null,
    analystProfileId: matchRow?.analystProfileId ?? null,
    sidelineProfileId: matchRow?.sidelineProfileId ?? null,
    guestProfileId: matchRow?.guestProfileId ?? null,
    leadSpeed: matchRow?.leadSpeed ?? null,
    analystSpeed: matchRow?.analystSpeed ?? null,
    sidelineSpeed: matchRow?.sidelineSpeed ?? null,
    guestSpeed: matchRow?.guestSpeed ?? null,
    leadTone: matchRow?.leadTone ?? null,
    analystTone: matchRow?.analystTone ?? null,
    sidelineTone: matchRow?.sidelineTone ?? null,
    guestTone: matchRow?.guestTone ?? null,
    leadVoiceStyle: matchRow?.leadVoiceStyle ?? null,
    analystVoiceStyle: matchRow?.analystVoiceStyle ?? null,
    sidelineVoiceStyle: matchRow?.sidelineVoiceStyle ?? null,
    guestVoiceStyle: matchRow?.guestVoiceStyle ?? null,
    leadDeliveryStyle: matchRow?.leadDeliveryStyle ?? null,
    analystDeliveryStyle: matchRow?.analystDeliveryStyle ?? null,
    sidelineDeliveryStyle: matchRow?.sidelineDeliveryStyle ?? null,
    guestDeliveryStyle: matchRow?.guestDeliveryStyle ?? null,
    voiceOverrides,
    optimiseDualCommentary: matchRow?.optimiseDualCommentary ?? null,
    emphasiseScoreboard: matchRow?.emphasiseScoreboard ?? null,
    aiPrompt: matchRow?.aiPrompt ?? null,
    notes: matchRow?.notes ?? null,
    competitionScope,
    defaultsLabel: defaults?.label ?? null,
    accentLabel: defaults?.accentLabel ?? null,
    stadiumAmbienceKey: defaults?.stadiumAmbienceKey ?? null,
    activeRoles,
    active,
  };
}

function optionalSpeed(
  patch: number | null | undefined,
  existing: number | null | undefined,
): number | null {
  if (patch === undefined) return existing ?? null;
  if (patch == null) return null;
  return clampSpeechSpeed(patch);
}

function optionalTone(
  patch: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  if (patch === undefined) return existing ?? null;
  return patch?.trim() || null;
}

function optionalVoiceStyle(
  patch: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  if (patch === undefined) return existing ?? null;
  return patch ? normalizeVoiceStyle(patch) : null;
}

function optionalDelivery(
  patch: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  if (patch === undefined) return existing ?? null;
  return patch ? normalizeDeliveryStyle(patch) : null;
}

export async function upsertMatchVoiceSettings(
  fixtureId: string,
  patch: {
    presenterCount?: number | null;
    leadProfileId?: string | null;
    analystProfileId?: string | null;
    sidelineProfileId?: string | null;
    guestProfileId?: string | null;
    leadSpeed?: number | null;
    analystSpeed?: number | null;
    sidelineSpeed?: number | null;
    guestSpeed?: number | null;
    leadTone?: string | null;
    analystTone?: string | null;
    sidelineTone?: string | null;
    guestTone?: string | null;
    leadVoiceStyle?: string | null;
    analystVoiceStyle?: string | null;
    sidelineVoiceStyle?: string | null;
    guestVoiceStyle?: string | null;
    leadDeliveryStyle?: string | null;
    analystDeliveryStyle?: string | null;
    sidelineDeliveryStyle?: string | null;
    guestDeliveryStyle?: string | null;
    voiceOverrides?: MatchVoiceOverridesMap | null;
    optimiseDualCommentary?: boolean | null;
    emphasiseScoreboard?: boolean | null;
    aiPrompt?: string | null;
    notes?: string | null;
  },
): Promise<MatchVoiceSettingsDto> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(audioMatchVoiceSettings)
    .where(eq(audioMatchVoiceSettings.fixtureId, fixtureId))
    .limit(1);

  const nextOverrides =
    patch.voiceOverrides === undefined
      ? parseVoiceOverrides(existing?.voiceOverrides)
      : patch.voiceOverrides == null
        ? {}
        : parseVoiceOverrides(patch.voiceOverrides);

  const values = {
    presenterCount:
      patch.presenterCount === undefined
        ? existing?.presenterCount ?? null
        : patch.presenterCount == null
          ? null
          : clampPresenterCount(patch.presenterCount),
    leadProfileId:
      patch.leadProfileId === undefined ? existing?.leadProfileId ?? null : patch.leadProfileId,
    analystProfileId:
      patch.analystProfileId === undefined
        ? existing?.analystProfileId ?? null
        : patch.analystProfileId,
    sidelineProfileId:
      patch.sidelineProfileId === undefined
        ? existing?.sidelineProfileId ?? null
        : patch.sidelineProfileId,
    guestProfileId:
      patch.guestProfileId === undefined
        ? existing?.guestProfileId ?? null
        : patch.guestProfileId,
    leadSpeed: optionalSpeed(patch.leadSpeed, existing?.leadSpeed),
    analystSpeed: optionalSpeed(patch.analystSpeed, existing?.analystSpeed),
    sidelineSpeed: optionalSpeed(patch.sidelineSpeed, existing?.sidelineSpeed),
    guestSpeed: optionalSpeed(patch.guestSpeed, existing?.guestSpeed),
    leadTone: optionalTone(patch.leadTone, existing?.leadTone),
    analystTone: optionalTone(patch.analystTone, existing?.analystTone),
    sidelineTone: optionalTone(patch.sidelineTone, existing?.sidelineTone),
    guestTone: optionalTone(patch.guestTone, existing?.guestTone),
    leadVoiceStyle: optionalVoiceStyle(patch.leadVoiceStyle, existing?.leadVoiceStyle),
    analystVoiceStyle: optionalVoiceStyle(
      patch.analystVoiceStyle,
      existing?.analystVoiceStyle,
    ),
    sidelineVoiceStyle: optionalVoiceStyle(
      patch.sidelineVoiceStyle,
      existing?.sidelineVoiceStyle,
    ),
    guestVoiceStyle: optionalVoiceStyle(patch.guestVoiceStyle, existing?.guestVoiceStyle),
    leadDeliveryStyle: optionalDelivery(patch.leadDeliveryStyle, existing?.leadDeliveryStyle),
    analystDeliveryStyle: optionalDelivery(
      patch.analystDeliveryStyle,
      existing?.analystDeliveryStyle,
    ),
    sidelineDeliveryStyle: optionalDelivery(
      patch.sidelineDeliveryStyle,
      existing?.sidelineDeliveryStyle,
    ),
    guestDeliveryStyle: optionalDelivery(
      patch.guestDeliveryStyle,
      existing?.guestDeliveryStyle,
    ),
    voiceOverrides: nextOverrides,
    optimiseDualCommentary:
      patch.optimiseDualCommentary === undefined
        ? existing?.optimiseDualCommentary ?? null
        : patch.optimiseDualCommentary,
    emphasiseScoreboard:
      patch.emphasiseScoreboard === undefined
        ? existing?.emphasiseScoreboard ?? null
        : patch.emphasiseScoreboard,
    aiPrompt:
      patch.aiPrompt === undefined
        ? existing?.aiPrompt ?? null
        : patch.aiPrompt?.trim() || null,
    notes:
      patch.notes === undefined ? existing?.notes ?? null : patch.notes?.trim() || null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(audioMatchVoiceSettings)
      .set(values)
      .where(eq(audioMatchVoiceSettings.id, existing.id));
  } else {
    await db.insert(audioMatchVoiceSettings).values({
      fixtureId,
      ...values,
    });
  }

  return getMatchVoiceSettingsAdmin(fixtureId);
}

export async function clearMatchVoiceSettings(fixtureId: string): Promise<MatchVoiceSettingsDto> {
  const db = getDb();
  await db
    .delete(audioMatchVoiceSettings)
    .where(eq(audioMatchVoiceSettings.fixtureId, fixtureId));
  return getMatchVoiceSettingsAdmin(fixtureId);
}

const PRIORITY_COMBINATION_TYPES = [
  "full_time",
  "half_time",
  "kick_off",
  "major_event",
  "card",
  "momentum",
] as const;

/** List priority script ids for a fixture (for regenerate-with-new-voices). */
export async function listPriorityAudioScriptIds(
  fixtureId: string,
  limit = 20,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: audioCommentaryScripts.id,
      combinationType: audioCommentaryScripts.combinationType,
      priority: audioCommentaryScripts.priority,
    })
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.fixtureId, fixtureId))
    .orderBy(asc(audioCommentaryScripts.minute), asc(audioCommentaryScripts.second));

  const priority = rows.filter((r) =>
    (PRIORITY_COMBINATION_TYPES as readonly string[]).includes(r.combinationType),
  );
  const picked = priority.slice(0, limit);
  if (picked.length < limit) {
    const ids = new Set(picked.map((p) => p.id));
    for (const row of rows) {
      if (picked.length >= limit) break;
      if (ids.has(row.id)) continue;
      picked.push(row);
      ids.add(row.id);
    }
  }
  return picked.map((p) => p.id);
}

/** All audio script ids for a fixture, clock-ordered (full-match TTS). */
export async function listAllAudioScriptIds(fixtureId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: audioCommentaryScripts.id })
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.fixtureId, fixtureId))
    .orderBy(asc(audioCommentaryScripts.minute), asc(audioCommentaryScripts.second));
  return rows.map((r) => r.id);
}

/**
 * Public-safe voice labels for the match Audio tab (display names only — never voice IDs).
 */
export async function getPublicMatchAudioVoiceLabels(fixtureId: string): Promise<{
  presenterCount: AudioPresenterCount;
  defaultsLabel: string | null;
  source: string;
  presenters: Array<{
    role: AudioSpeakerRole;
    label: string;
    provider: string;
  }>;
}> {
  const settings = await getMatchVoiceSettingsAdmin(fixtureId);
  const presenters = settings.activeRoles
    .map((role) => {
      const v = settings.active[role];
      if (!v) return null;
      return {
        role,
        label: v.creatorProfileLabel || v.displayName,
        provider: v.provider === "openai" ? "OpenAI" : v.provider === "auto" ? "Auto" : "ElevenLabs",
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const source =
    settings.hasOverride
      ? "match_override"
      : settings.active.lead.source === "competition_default"
        ? "competition_default"
        : settings.active.lead.source;

  return {
    presenterCount: settings.presenterCount,
    defaultsLabel: settings.defaultsLabel,
    source,
    presenters,
  };
}

export async function listActiveProfilesForSelect(): Promise<
  Array<{
    id: string;
    label: string;
    creatorProfileLabel: string;
    role: string;
    competitionScope: string | null;
    organisationLabel: string | null;
    topicLabel: string | null;
    voiceStyle: string;
    deliveryStyle: string;
    tone: string;
    speed: number;
    provider: string;
    elevenlabsVoiceId: string | null;
    openaiVoice: string | null;
  }>
> {
  const rows = await listAdminVoiceProfiles({ status: "active" });
  return rows.map((r) => ({
    id: r.id,
    label: r.creatorProfileLabel,
    creatorProfileLabel: r.creatorProfileLabel,
    role: r.role,
    competitionScope: r.competitionScope,
    organisationLabel: r.organisationLabel,
    topicLabel: r.topicLabel,
    voiceStyle: r.voiceStyle,
    deliveryStyle: r.deliveryStyle,
    tone: r.tone,
    speed: r.speed,
    provider: r.provider,
    elevenlabsVoiceId: r.elevenlabsVoiceId,
    openaiVoice: r.openaiVoice,
  }));
}

/** Ensure profile IDs in a list exist and are active (for admin PATCH validation). */
export async function assertActiveProfileIds(ids: Array<string | null | undefined>) {
  const clean = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!clean.length) return;
  const db = getDb();
  const rows = await db
    .select({ id: audioVoiceProfiles.id })
    .from(audioVoiceProfiles)
    .where(
      and(inArray(audioVoiceProfiles.id, clean), eq(audioVoiceProfiles.status, "active")),
    );
  if (rows.length !== clean.length) {
    throw new Error("One or more voice profiles are missing or inactive");
  }
}

export type AudioFixturePickerRow = {
  id: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  competitionName: string | null;
  competitionScope: string;
  kickoffAt: string | null;
  status: string | null;
};

/** Searchable recent / upcoming / live fixtures for Audio Commentary match picker. */
export async function listAudioFixturesForPicker(options?: {
  q?: string;
  limit?: number;
}): Promise<AudioFixturePickerRow[]> {
  const db = getDb();
  const limit = Math.min(80, Math.max(10, options?.limit ?? 40));
  const q = options?.q?.trim().toLowerCase() ?? "";
  const homeTeam = alias(teams, "audio_picker_home");
  const awayTeam = alias(teams, "audio_picker_away");

  const rows = await db
    .select({
      id: fixtures.id,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
      competitionName: fixtures.competitionName,
      competitionSlug: competitions.slug,
      competitionDbName: competitions.name,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
    })
    .from(fixtures)
    .leftJoin(homeTeam, eq(homeTeam.id, fixtures.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, fixtures.awayTeamId))
    .leftJoin(competitions, eq(competitions.id, fixtures.competitionId))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(200);

  const now = Date.now();
  const scored = rows.map((row) => {
    const home = row.homeName?.trim() || "Home";
    const away = row.awayName?.trim() || "Away";
    const kickMs = row.kickoffAt ? new Date(row.kickoffAt).getTime() : 0;
    const hoursFromNow = kickMs ? (kickMs - now) / 3_600_000 : 9999;
    let score = 0;
    const status = (row.status ?? "").toLowerCase();
    if (status.includes("live") || status.includes("in_progress")) score += 1000;
    if (hoursFromNow >= -3 && hoursFromNow <= 72) score += 500 - Math.abs(hoursFromNow);
    else if (hoursFromNow < -3 && hoursFromNow > -168) score += 100 + hoursFromNow;
    const label = `${home} v ${away}`;
    const competitionName = row.competitionDbName ?? row.competitionName;
    const hay = `${label} ${competitionName ?? ""} ${status}`.toLowerCase();
    return {
      id: row.id,
      label,
      homeTeam: home,
      awayTeam: away,
      competitionName,
      competitionScope: competitionScopeFromSlugOrName(
        row.competitionSlug,
        competitionName,
      ),
      kickoffAt: row.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
      status: row.status,
      score,
      hay,
    };
  });

  return scored
    .filter((r) => (!q ? true : r.hay.includes(q)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, hay: _h, ...row }) => row);
}
