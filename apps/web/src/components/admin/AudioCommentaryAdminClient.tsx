"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PresenterVoiceSettingsPanel,
  type AdminLibraryVoice,
  type PresenterVoiceDraft,
} from "@/components/admin/PresenterVoiceSettingsPanel";
import type {
  AudioPresenterCount,
  AudioSpeakerRole,
  AudioTtsProvider,
  MatchVoiceOverridesMap,
} from "@/lib/audio-voice-settings";
import {
  AUDIO_SPEAKER_ROLE_LABELS,
  clampPresenterCount,
  normalizeTtsProvider,
  rolesForPresenterCount,
} from "@/lib/audio-voice-settings";

type VoiceProfile = {
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
  elevenlabsVoiceId: string | null;
  openaiVoice: string | null;
  voiceConfigured: boolean;
  speed: number;
  tone: string;
  competitionScope: string | null;
  isDefault: boolean;
  status: string;
};

type DefaultsRow = {
  id: string;
  competitionScope: string;
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
};

type ScopeOption = { scope: string; label: string; accentHint: string };

type FixtureRow = {
  id: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  competitionName: string | null;
  competitionScope: string;
  kickoffAt: string | null;
  status: string | null;
};

type MatchSettings = {
  fixtureId: string;
  hasOverride: boolean;
  presenterCount: number;
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
  voiceOverrides: MatchVoiceOverridesMap;
  competitionScope: string;
  defaultsLabel: string | null;
  accentLabel: string | null;
  active: Partial<
    Record<
      AudioSpeakerRole,
      {
        profileId: string;
        creatorProfileLabel?: string;
        displayName: string;
        provider: string;
        elevenlabsVoiceId: string | null;
        openaiVoice: string | null;
        speed: number;
        tone: string;
        voiceStyle?: string;
        deliveryStyle?: string;
      }
    >
  >;
};

function fieldClass() {
  return "w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100";
}

function labelClass() {
  return "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
}

function emptyPresenter(role: AudioSpeakerRole): PresenterVoiceDraft {
  const defaults: Record<AudioSpeakerRole, PresenterVoiceDraft> = {
    lead: {
      role: "lead",
      profileId: "",
      provider: "auto",
      elevenlabsVoiceId: "",
      openaiVoice: "onyx",
      tone: "energetic",
      speed: 1.05,
      voiceStyle: "television",
      deliveryStyle: "energetic",
    },
    analyst: {
      role: "analyst",
      profileId: "",
      provider: "auto",
      elevenlabsVoiceId: "",
      openaiVoice: "nova",
      tone: "analytical",
      speed: 0.98,
      voiceStyle: "analyst",
      deliveryStyle: "balanced",
    },
    sideline: {
      role: "sideline",
      profileId: "",
      provider: "auto",
      elevenlabsVoiceId: "",
      openaiVoice: "echo",
      tone: "energetic",
      speed: 1.02,
      voiceStyle: "former_player",
      deliveryStyle: "energetic",
    },
    guest: {
      role: "guest",
      profileId: "",
      provider: "auto",
      elevenlabsVoiceId: "",
      openaiVoice: "fable",
      tone: "broadcast",
      speed: 0.98,
      voiceStyle: "storyteller",
      deliveryStyle: "calm",
    },
  };
  return { ...defaults[role] };
}

export function AudioCommentaryAdminClient() {
  const [mode, setMode] = useState<"division" | "match">("division");
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [defaults, setDefaults] = useState<DefaultsRow[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [selectedScope, setSelectedScope] = useState("currie_cup");
  const [presenterCount, setPresenterCount] = useState<AudioPresenterCount>(2);
  const [presenters, setPresenters] = useState<
    Partial<Record<AudioSpeakerRole, PresenterVoiceDraft>>
  >({
    lead: emptyPresenter("lead"),
    analyst: emptyPresenter("analyst"),
  });
  const [draftLabel, setDraftLabel] = useState("");
  const [accentLabel, setAccentLabel] = useState("");
  const [stadiumAmbienceKey, setStadiumAmbienceKey] = useState("");
  const [optimiseDual, setOptimiseDual] = useState(true);
  const [emphasiseScoreboard, setEmphasiseScoreboard] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");

  const [voices, setVoices] = useState<AdminLibraryVoice[]>([]);
  const [openaiVoices, setOpenaiVoices] = useState<string[]>([]);
  const [voicesStatus, setVoicesStatus] = useState("loading");
  const [voicesMessage, setVoicesMessage] = useState<string | null>(null);
  const [configureUrl, setConfigureUrl] = useState("/admin/keys#elevenlabs");
  const [voicesLoading, setVoicesLoading] = useState(true);

  const [fixtureQ, setFixtureQ] = useState("");
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [matchSettings, setMatchSettings] = useState<MatchSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadVoices = useCallback(async () => {
    setVoicesLoading(true);
    try {
      const res = await fetch("/api/admin/audio-commentary/voices");
      const data = (await res.json()) as {
        elevenlabs?: {
          voices?: AdminLibraryVoice[];
          status?: string;
          message?: string | null;
          configureUrl?: string;
        };
        openai?: { voices?: Array<{ id: string }> };
      };
      setVoices(data.elevenlabs?.voices ?? []);
      setVoicesStatus(data.elevenlabs?.status ?? "empty");
      setVoicesMessage(data.elevenlabs?.message ?? null);
      setConfigureUrl(data.elevenlabs?.configureUrl ?? "/admin/keys#elevenlabs");
      setOpenaiVoices((data.openai?.voices ?? []).map((v) => v.id));
    } catch {
      setVoices([]);
      setVoicesStatus("network_error");
      setVoicesMessage("Could not load voice library.");
    } finally {
      setVoicesLoading(false);
    }
  }, []);

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audio-commentary");
      const data = (await res.json()) as {
        profiles?: VoiceProfile[];
        defaults?: DefaultsRow[];
        scopes?: ScopeOption[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setProfiles(data.profiles ?? []);
      setDefaults(data.defaults ?? []);
      setScopes(data.scopes ?? []);
      const preferred =
        data.defaults?.find((d) => d.competitionScope === "currie_cup")
          ?.competitionScope ??
        data.defaults?.[0]?.competitionScope ??
        "currie_cup";
      setSelectedScope(preferred);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFixtures = useCallback(async (q: string) => {
    try {
      const res = await fetch(
        `/api/admin/audio-commentary/fixtures?q=${encodeURIComponent(q)}&limit=40`,
      );
      const data = (await res.json()) as { fixtures?: FixtureRow[] };
      setFixtures(data.fixtures ?? []);
    } catch {
      setFixtures([]);
    }
  }, []);

  useEffect(() => {
    void loadDefaults();
    void loadVoices();
  }, [loadDefaults, loadVoices]);

  useEffect(() => {
    if (mode !== "match") return;
    const t = setTimeout(() => void loadFixtures(fixtureQ), 200);
    return () => clearTimeout(t);
  }, [mode, fixtureQ, loadFixtures]);

  const activeDefaults = useMemo(() => {
    return (
      defaults.find((d) => d.competitionScope === selectedScope) ?? {
        id: `new:${selectedScope}`,
        competitionScope: selectedScope,
        label: scopes.find((s) => s.scope === selectedScope)?.label ?? selectedScope,
        accentLabel: null,
        locale: "en",
        stadiumAmbienceKey: null,
        presenterCount: 2,
        leadProfileId: null,
        analystProfileId: null,
        sidelineProfileId: null,
        guestProfileId: null,
        voiceStyle: "journalist",
        deliveryStyle: "balanced",
        optimiseDualCommentary: true,
        emphasiseScoreboard: true,
        aiPrompt: null,
        notes: null,
      }
    );
  }, [defaults, selectedScope, scopes]);

  const syncPresentersFromProfiles = useCallback(
    (
      count: AudioPresenterCount,
      ids: Partial<Record<AudioSpeakerRole, string | null>>,
      voiceOverrides?: MatchVoiceOverridesMap,
    ) => {
      const roles = rolesForPresenterCount(count);
      const next: Partial<Record<AudioSpeakerRole, PresenterVoiceDraft>> = {};
      for (const role of roles) {
        const base = emptyPresenter(role);
        const profileId = ids[role] ?? "";
        const profile = profiles.find((p) => p.id === profileId);
        const override = voiceOverrides?.[role];
        next[role] = {
          ...base,
          profileId,
          provider: normalizeTtsProvider(
            override?.provider ?? profile?.provider ?? base.provider,
          ),
          elevenlabsVoiceId:
            override?.elevenlabsVoiceId ?? profile?.elevenlabsVoiceId ?? "",
          openaiVoice: override?.openaiVoice ?? profile?.openaiVoice ?? base.openaiVoice,
          tone: profile?.tone ?? base.tone,
          speed: profile?.speed ?? base.speed,
          voiceStyle: profile?.voiceStyle ?? base.voiceStyle,
          deliveryStyle: profile?.deliveryStyle ?? base.deliveryStyle,
        };
      }
      setPresenters(next);
      setPresenterCount(count);
    },
    [profiles],
  );

  // Sync division draft when scope / profiles change
  useEffect(() => {
    if (mode !== "division") return;
    const count = clampPresenterCount(activeDefaults.presenterCount);
    syncPresentersFromProfiles(count, {
      lead: activeDefaults.leadProfileId,
      analyst: activeDefaults.analystProfileId,
      sideline: activeDefaults.sidelineProfileId,
      guest: activeDefaults.guestProfileId,
    });
    setDraftLabel(activeDefaults.label);
    setAccentLabel(activeDefaults.accentLabel ?? "");
    setStadiumAmbienceKey(activeDefaults.stadiumAmbienceKey ?? "");
    setOptimiseDual(activeDefaults.optimiseDualCommentary);
    setEmphasiseScoreboard(activeDefaults.emphasiseScoreboard);
    setAiPrompt(activeDefaults.aiPrompt ?? "");
  }, [mode, activeDefaults, syncPresentersFromProfiles]);

  async function loadMatch(fixtureId: string) {
    setSelectedFixtureId(fixtureId);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/audio/voice-settings`);
      const data = (await res.json()) as { settings?: MatchSettings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || "Failed to load match");
      setMatchSettings(data.settings);
      const count = clampPresenterCount(data.settings.presenterCount);
      const ids: Partial<Record<AudioSpeakerRole, string | null>> = {
        lead: data.settings.leadProfileId ?? data.settings.active.lead?.profileId ?? null,
        analyst:
          data.settings.analystProfileId ?? data.settings.active.analyst?.profileId ?? null,
        sideline:
          data.settings.sidelineProfileId ??
          data.settings.active.sideline?.profileId ??
          null,
        guest:
          data.settings.guestProfileId ?? data.settings.active.guest?.profileId ?? null,
      };
      // Prefer active resolved voices for picker state
      const roles = rolesForPresenterCount(count);
      const next: Partial<Record<AudioSpeakerRole, PresenterVoiceDraft>> = {};
      for (const role of roles) {
        const base = emptyPresenter(role);
        const active = data.settings.active[role];
        const override = data.settings.voiceOverrides?.[role];
        next[role] = {
          ...base,
          profileId: ids[role] ?? "",
          provider: normalizeTtsProvider(
            override?.provider ?? active?.provider ?? base.provider,
          ),
          elevenlabsVoiceId:
            override?.elevenlabsVoiceId ?? active?.elevenlabsVoiceId ?? "",
          openaiVoice: override?.openaiVoice ?? active?.openaiVoice ?? base.openaiVoice,
          tone:
            (role === "lead"
              ? data.settings.leadTone
              : role === "analyst"
                ? data.settings.analystTone
                : role === "sideline"
                  ? data.settings.sidelineTone
                  : data.settings.guestTone) ??
            active?.tone ??
            base.tone,
          speed:
            (role === "lead"
              ? data.settings.leadSpeed
              : role === "analyst"
                ? data.settings.analystSpeed
                : role === "sideline"
                  ? data.settings.sidelineSpeed
                  : data.settings.guestSpeed) ??
            active?.speed ??
            base.speed,
          voiceStyle:
            (role === "lead"
              ? data.settings.leadVoiceStyle
              : role === "analyst"
                ? data.settings.analystVoiceStyle
                : role === "sideline"
                  ? data.settings.sidelineVoiceStyle
                  : data.settings.guestVoiceStyle) ??
            active?.voiceStyle ??
            base.voiceStyle,
          deliveryStyle:
            (role === "lead"
              ? data.settings.leadDeliveryStyle
              : role === "analyst"
                ? data.settings.analystDeliveryStyle
                : role === "sideline"
                  ? data.settings.sidelineDeliveryStyle
                  : data.settings.guestDeliveryStyle) ??
            active?.deliveryStyle ??
            base.deliveryStyle,
        };
      }
      setPresenters(next);
      setPresenterCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load match");
      setMatchSettings(null);
    }
  }

  function onPresenterCountChange(count: AudioPresenterCount) {
    const roles = rolesForPresenterCount(count);
    setPresenterCount(count);
    setPresenters((prev) => {
      const next: Partial<Record<AudioSpeakerRole, PresenterVoiceDraft>> = {};
      for (const role of roles) {
        next[role] = prev[role] ?? emptyPresenter(role);
      }
      return next;
    });
  }

  function onProfileChange(role: AudioSpeakerRole, profileId: string) {
    const profile = profiles.find((p) => p.id === profileId);
    setPresenters((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] ?? emptyPresenter(role)),
        profileId,
        provider: normalizeTtsProvider(profile?.provider),
        elevenlabsVoiceId: profile?.elevenlabsVoiceId ?? "",
        openaiVoice: profile?.openaiVoice ?? (prev[role]?.openaiVoice || ""),
        tone: profile?.tone ?? prev[role]?.tone ?? "broadcast",
        speed: profile?.speed ?? prev[role]?.speed ?? 1,
        voiceStyle: profile?.voiceStyle ?? prev[role]?.voiceStyle ?? "journalist",
        deliveryStyle: profile?.deliveryStyle ?? prev[role]?.deliveryStyle ?? "balanced",
      },
    }));
  }

  function patchPresenter(role: AudioSpeakerRole, patch: Partial<PresenterVoiceDraft>) {
    setPresenters((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? emptyPresenter(role)), ...patch },
    }));
  }

  async function saveDivision() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const roles = rolesForPresenterCount(presenterCount);
      // Only patch profile IDs for active presenter slots — never null out
      // Analyst/Sideline/Guest when lowering presenterCount (keeps them for restore).
      const profilePatch: Record<string, string | null> = {
        leadProfileId: presenters.lead?.profileId || null,
      };
      if (roles.includes("analyst")) {
        profilePatch.analystProfileId = presenters.analyst?.profileId || null;
      }
      if (roles.includes("sideline")) {
        profilePatch.sidelineProfileId = presenters.sideline?.profileId || null;
      }
      if (roles.includes("guest")) {
        profilePatch.guestProfileId = presenters.guest?.profileId || null;
      }
      const defaultsRes = await fetch("/api/admin/audio-commentary", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "defaults",
          competitionScope: selectedScope,
          patch: {
            label: draftLabel,
            accentLabel: accentLabel || null,
            stadiumAmbienceKey: stadiumAmbienceKey || null,
            presenterCount,
            ...profilePatch,
            voiceStyle: presenters.lead?.voiceStyle ?? "television",
            deliveryStyle: presenters.lead?.deliveryStyle ?? "balanced",
            optimiseDualCommentary: optimiseDual,
            emphasiseScoreboard,
            aiPrompt: aiPrompt || null,
          },
        }),
      });
      const defaultsData = (await defaultsRes.json()) as { error?: string };
      if (!defaultsRes.ok) throw new Error(defaultsData.error || "Save defaults failed");

      for (const role of roles) {
        const p = presenters[role];
        if (!p?.profileId) continue;
        const res = await fetch("/api/admin/audio-commentary", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "profile",
            profileId: p.profileId,
            patch: {
              provider: p.provider,
              elevenlabsVoiceId: p.elevenlabsVoiceId || null,
              openaiVoice: p.openaiVoice || null,
              tone: p.tone,
              speed: p.speed,
              voiceStyle: p.voiceStyle,
              deliveryStyle: p.deliveryStyle,
              aiPrompt: role === "lead" ? aiPrompt || null : undefined,
            },
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || `Save ${role} failed`);
      }

      setStatus(`Saved defaults for ${draftLabel || selectedScope}.`);
      await loadDefaults();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveMatch() {
    if (!selectedFixtureId) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const roles = rolesForPresenterCount(presenterCount);
      const voiceOverrides: MatchVoiceOverridesMap = {};
      for (const role of roles) {
        const p = presenters[role];
        if (!p) continue;
        voiceOverrides[role] = {
          provider: p.provider,
          elevenlabsVoiceId: p.elevenlabsVoiceId || null,
          openaiVoice: p.openaiVoice || null,
        };
      }

      const body: Record<string, unknown> = {
        presenterCount,
        leadProfileId: presenters.lead?.profileId || null,
        analystProfileId: presenters.analyst?.profileId || null,
        sidelineProfileId: presenters.sideline?.profileId || null,
        guestProfileId: presenters.guest?.profileId || null,
        leadSpeed: presenters.lead?.speed ?? null,
        analystSpeed: presenters.analyst?.speed ?? null,
        sidelineSpeed: presenters.sideline?.speed ?? null,
        guestSpeed: presenters.guest?.speed ?? null,
        leadTone: presenters.lead?.tone ?? null,
        analystTone: presenters.analyst?.tone ?? null,
        sidelineTone: presenters.sideline?.tone ?? null,
        guestTone: presenters.guest?.tone ?? null,
        leadVoiceStyle: presenters.lead?.voiceStyle ?? null,
        analystVoiceStyle: presenters.analyst?.voiceStyle ?? null,
        sidelineVoiceStyle: presenters.sideline?.voiceStyle ?? null,
        guestVoiceStyle: presenters.guest?.voiceStyle ?? null,
        leadDeliveryStyle: presenters.lead?.deliveryStyle ?? null,
        analystDeliveryStyle: presenters.analyst?.deliveryStyle ?? null,
        sidelineDeliveryStyle: presenters.sideline?.deliveryStyle ?? null,
        guestDeliveryStyle: presenters.guest?.deliveryStyle ?? null,
        voiceOverrides,
        optimiseDualCommentary: optimiseDual,
        emphasiseScoreboard,
        aiPrompt: aiPrompt || null,
      };

      const res = await fetch(
        `/api/admin/matches/${selectedFixtureId}/audio/voice-settings`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { settings?: MatchSettings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || "Save failed");
      setMatchSettings(data.settings);
      const fx = fixtures.find((f) => f.id === selectedFixtureId);
      setStatus(
        `Saved override for ${fx?.label ?? "match"} — division defaults unchanged.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearMatchOverride() {
    if (!selectedFixtureId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/matches/${selectedFixtureId}/audio/voice-settings`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { settings?: MatchSettings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || "Clear failed");
      setStatus("Cleared match override — using division defaults.");
      await loadMatch(selectedFixtureId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  const activeRoles = rolesForPresenterCount(presenterCount);
  const scopeMeta = scopes.find((s) => s.scope === selectedScope);
  const selectedFixture = fixtures.find((f) => f.id === selectedFixtureId);
  const competitionScopeForFilter =
    mode === "match"
      ? matchSettings?.competitionScope ?? selectedFixture?.competitionScope
      : selectedScope;

  if (loading && mode === "division") {
    return <p className="text-sm text-zinc-500">Loading Creator Profiles…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="cms-card space-y-3 text-sm text-zinc-300">
        <p className="m-0 text-zinc-400">
          Configure <strong className="font-medium text-zinc-200">division defaults</strong>{" "}
          or a specific <strong className="font-medium text-zinc-200">match override</strong>.
          Pick ElevenLabs / OpenAI voices per presenter. Keys on{" "}
          <Link href="/admin/keys#elevenlabs" className="text-emerald-400 hover:underline">
            Admin → Keys
          </Link>
          .
        </p>
        {error ? <p className="m-0 text-rose-400">{error}</p> : null}
        {status ? <p className="m-0 text-emerald-400">{status}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`cms-btn ${mode === "division" ? "cms-btn--primary" : "cms-btn--secondary"}`}
          onClick={() => setMode("division")}
        >
          Division defaults
        </button>
        <button
          type="button"
          className={`cms-btn ${mode === "match" ? "cms-btn--primary" : "cms-btn--secondary"}`}
          onClick={() => {
            setMode("match");
            void loadFixtures(fixtureQ);
          }}
        >
          Match override
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-200">
            {mode === "division"
              ? `Defaults for ${draftLabel || scopeMeta?.label || selectedScope}`
              : selectedFixture
                ? `Override for ${selectedFixture.label}`
                : "Select a match"}
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            {presenterCount} presenter{presenterCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-4 p-4">
          {mode === "division" ? (
            <>
              <div>
                <label className={labelClass()}>Competition / Division</label>
                <select
                  className={fieldClass()}
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                >
                  {(scopes.length
                    ? scopes
                    : [{ scope: "currie_cup", label: "Currie Cup (SA)", accentHint: "SA" }]
                  ).map((s) => (
                    <option key={s.scope} value={s.scope}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {scopeMeta ? (
                  <p className="mt-1 mb-0 text-xs text-zinc-500">
                    Regional accent hint: {scopeMeta.accentHint}
                  </p>
                ) : null}
              </div>
              <div>
                <label className={labelClass()}>Duo / team label</label>
                <input
                  className={fieldClass()}
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className={labelClass()}>Match / fixture</label>
              <input
                className={fieldClass()}
                placeholder="Search Boland, Pumas, Currie Cup…"
                value={fixtureQ}
                onChange={(e) => setFixtureQ(e.target.value)}
              />
              <select
                className={fieldClass()}
                value={selectedFixtureId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) void loadMatch(id);
                  else {
                    setSelectedFixtureId("");
                    setMatchSettings(null);
                  }
                }}
              >
                <option value="">Select match…</option>
                {fixtures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                    {f.competitionName ? ` · ${f.competitionName}` : ""}
                    {f.kickoffAt
                      ? ` · ${new Date(f.kickoffAt).toLocaleString()}`
                      : ""}
                    {f.status ? ` · ${f.status}` : ""}
                  </option>
                ))}
              </select>
              {matchSettings ? (
                <p className="m-0 text-xs text-zinc-500">
                  {matchSettings.hasOverride
                    ? "Match override active"
                    : `Using ${matchSettings.defaultsLabel ?? "division defaults"}`}
                  {matchSettings.accentLabel ? ` · ${matchSettings.accentLabel}` : ""}
                  {" · "}
                  <Link
                    href={`/admin/matches/${selectedFixtureId}/audio`}
                    className="text-emerald-400 hover:underline"
                  >
                    Open full match audio page
                  </Link>
                </p>
              ) : null}
            </div>
          )}

          <div>
            <label className={labelClass()}>Presenter count</label>
            <div className="flex flex-wrap gap-2">
              {([1, 2, 3, 4] as AudioPresenterCount[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                    presenterCount === n
                      ? "border-emerald-600 bg-emerald-700 text-white"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300"
                  }`}
                  onClick={() => onPresenterCountChange(n)}
                >
                  {n} —{" "}
                  {n === 1
                    ? "Lead only"
                    : n === 2
                      ? "Lead + Analyst"
                      : n === 3
                        ? "Lead + Analyst + Sideline"
                        : "Lead + Analyst + Sideline + Guest"}
                </button>
              ))}
            </div>
            <p className="mt-1 mb-0 text-xs text-zinc-500">
              Default for Currie Cup stays 2. Short events may still use fewer speakers
              even when count is 3–4.
            </p>
          </div>

          {(mode === "division" || selectedFixtureId) &&
            activeRoles.map((role) => {
              const draft = presenters[role] ?? emptyPresenter(role);
              return (
                <PresenterVoiceSettingsPanel
                  key={role}
                  role={role}
                  draft={draft}
                  profiles={profiles}
                  voices={voices}
                  openaiVoices={openaiVoices}
                  voicesStatus={voicesStatus}
                  voicesMessage={voicesMessage}
                  configureUrl={configureUrl}
                  voicesLoading={voicesLoading}
                  competitionScope={competitionScopeForFilter}
                  onChange={(patch) => patchPresenter(role, patch)}
                  onProfileChange={(id) => onProfileChange(role, id)}
                />
              );
            })}

          {mode === "division" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass()}>Accent label</label>
                <input
                  className={fieldClass()}
                  value={accentLabel}
                  onChange={(e) => setAccentLabel(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass()}>Stadium ambience key</label>
                <input
                  className={fieldClass()}
                  value={stadiumAmbienceKey}
                  onChange={(e) => setStadiumAmbienceKey(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimiseDual}
                onChange={(e) => setOptimiseDual(e.target.checked)}
              />
              Optimise for multi-presenter commentary
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={emphasiseScoreboard}
                onChange={(e) => setEmphasiseScoreboard(e.target.checked)}
              />
              Emphasise scoreboard moments
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === "division" ? (
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={saving}
                onClick={() => void saveDivision()}
              >
                {saving ? "Saving…" : "Save division voice settings"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="cms-btn cms-btn--primary"
                  disabled={saving || !selectedFixtureId}
                  onClick={() => void saveMatch()}
                >
                  {saving ? "Saving…" : "Save match voice override"}
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={saving || !matchSettings?.hasOverride}
                  onClick={() => void clearMatchOverride()}
                >
                  Clear override
                </button>
              </>
            )}
          </div>

          <p className="m-0 text-xs text-zinc-500">
            Active roles:{" "}
            {activeRoles.map((r) => AUDIO_SPEAKER_ROLE_LABELS[r]).join(" · ")}
          </p>
        </div>
      </section>
    </div>
  );
}
