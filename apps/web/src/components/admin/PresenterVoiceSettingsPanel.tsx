"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioSpeakerRole, AudioTtsProvider } from "@/lib/audio-voice-settings";
import {
  AUDIO_SPEAKER_ROLE_HINTS,
  AUDIO_SPEAKER_ROLE_LABELS,
  preferredAccentFiltersForScope,
} from "@/lib/audio-voice-settings";

export type AdminLibraryVoice = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  labels: Record<string, string | undefined>;
  previewUrl: string | null;
  source: string;
  groupLabel: string;
};

export type PresenterVoiceDraft = {
  role: AudioSpeakerRole;
  profileId: string;
  provider: AudioTtsProvider;
  elevenlabsVoiceId: string;
  openaiVoice: string;
  tone: string;
  speed: number;
  voiceStyle: string;
  deliveryStyle: string;
};

type ProfileOption = {
  id: string;
  creatorProfileLabel: string;
  role: string;
  competitionScope?: string | null;
  tone?: string;
  speed?: number;
  voiceStyle?: string;
  deliveryStyle?: string;
  provider?: string;
  elevenlabsVoiceId?: string | null;
  openaiVoice?: string | null;
};

type Props = {
  role: AudioSpeakerRole;
  draft: PresenterVoiceDraft;
  profiles: ProfileOption[];
  voices: AdminLibraryVoice[];
  openaiVoices: string[];
  voicesStatus: string;
  voicesMessage: string | null;
  configureUrl: string;
  voicesLoading: boolean;
  competitionScope?: string | null;
  /** Optional voice preset label shown above provider (Creator Profile name). */
  voicePresetLabel?: string | null;
  disabled?: boolean;
  onChange: (patch: Partial<PresenterVoiceDraft>) => void;
  onProfileChange: (profileId: string) => void;
};

const PROVIDER_OPTIONS: Array<{ value: AudioTtsProvider; label: string }> = [
  { value: "auto", label: "Auto: ElevenLabs, fallback to OpenAI" },
  { value: "elevenlabs", label: "ElevenLabs premium voices" },
  { value: "openai", label: "OpenAI TTS cheaper backup" },
];

function fieldClass() {
  return "w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100";
}

function labelClass() {
  return "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
}

function prettyLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function voiceOptionLabel(v: AdminLibraryVoice): string {
  return [
    v.name,
    v.category,
    v.labels.accent,
    v.labels.use_case,
    v.labels.age,
  ]
    .filter(Boolean)
    .map((x) => prettyLabel(String(x)))
    .join(" · ");
}

export function PresenterVoiceSettingsPanel({
  role,
  draft,
  profiles,
  voices,
  openaiVoices,
  voicesStatus,
  voicesMessage,
  configureUrl,
  voicesLoading,
  competitionScope,
  voicePresetLabel,
  disabled,
  onChange,
  onProfileChange,
}: Props) {
  const [useCaseFilter, setUseCaseFilter] = useState("All");
  const [accentFilter, setAccentFilter] = useState("All");
  const [search, setSearch] = useState("");
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const regionalDefaults = useMemo(
    () => preferredAccentFiltersForScope(competitionScope),
    [competitionScope],
  );

  useEffect(() => {
    // Soft-default accent chip from competition when nothing chosen yet
    if (accentFilter === "All" && regionalDefaults.length === 1) {
      setAccentFilter(regionalDefaults[0]!);
    }
  }, [regionalDefaults, accentFilter]);

  const roleProfiles = useMemo(
    () => profiles.filter((p) => p.role === role),
    [profiles, role],
  );

  const useCaseOptions = useMemo(() => {
    const values = new Set<string>();
    for (const v of voices) {
      const uc = v.labels.use_case?.trim();
      if (uc) values.add(uc);
    }
    return ["All", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [voices]);

  const accentOptions = useMemo(() => {
    const values = new Set<string>();
    for (const hint of regionalDefaults) values.add(hint);
    for (const v of voices) {
      const a = v.labels.accent?.trim();
      if (a) values.add(prettyLabel(a));
    }
    // Keep regional chips first
    const rest = Array.from(values)
      .filter((a) => !regionalDefaults.includes(a))
      .sort((a, b) => a.localeCompare(b));
    return ["All", ...regionalDefaults, ...rest];
  }, [voices, regionalDefaults]);

  const filteredVoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voices.filter((v) => {
      if (useCaseFilter !== "All" && v.labels.use_case?.trim() !== useCaseFilter) {
        return false;
      }
      if (accentFilter !== "All") {
        const accent = (v.labels.accent ?? "").toLowerCase();
        if (!accent.includes(accentFilter.toLowerCase())) return false;
      }
      if (q) {
        const hay = voiceOptionLabel(v).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [voices, useCaseFilter, accentFilter, search]);

  const grouped = useMemo(() => {
    const acc: Record<string, AdminLibraryVoice[]> = {};
    for (const voice of filteredVoices) {
      const group = voice.groupLabel?.trim() || "Other";
      if (!acc[group]) acc[group] = [];
      acc[group]!.push(voice);
    }
    return acc;
  }, [filteredVoices]);

  const groupOrder = useMemo(() => {
    const priority: Record<string, number> = {
      "My voices": 0,
      Female: 1,
      Male: 2,
      Unspecified: 3,
      Other: 4,
    };
    return Object.keys(grouped).sort((a, b) => {
      const pa = priority[a] ?? 99;
      const pb = priority[b] ?? 99;
      return pa === pb ? a.localeCompare(b) : pa - pb;
    });
  }, [grouped]);

  const selectedVoice =
    voices.find((v) => v.id === draft.elevenlabsVoiceId) ?? null;

  const selectedBadges = selectedVoice
    ? Object.entries(selectedVoice.labels)
        .filter(([, value]) => String(value ?? "").trim())
        .slice(0, 8)
    : [];

  function playPreview() {
    if (!selectedVoice?.previewUrl) return;
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current = null;
    }
    const audio = new Audio(selectedVoice.previewUrl);
    previewRef.current = audio;
    setPreviewing(true);
    audio.onended = () => setPreviewing(false);
    audio.onerror = () => setPreviewing(false);
    void audio.play().catch(() => setPreviewing(false));
  }

  function stopPreview() {
    previewRef.current?.pause();
    previewRef.current = null;
    setPreviewing(false);
  }

  const openaiOnly = draft.provider === "openai";

  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-100">
            {AUDIO_SPEAKER_ROLE_LABELS[role]} — Voice settings
          </h3>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">
            {AUDIO_SPEAKER_ROLE_HINTS[role]}
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass()}>Creator Profile</label>
        <select
          className={fieldClass()}
          value={draft.profileId}
          disabled={disabled}
          onChange={(e) => onProfileChange(e.target.value)}
        >
          <option value="">Select Creator Profile…</option>
          {roleProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.creatorProfileLabel}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass()}>Voice preset</label>
        <input
          className={fieldClass()}
          readOnly
          value={
            voicePresetLabel ||
            roleProfiles.find((p) => p.id === draft.profileId)?.creatorProfileLabel ||
            "—"
          }
        />
      </div>

      <div>
        <label className={labelClass()}>Audio provider</label>
        <select
          className={fieldClass()}
          value={draft.provider}
          disabled={disabled}
          onChange={(e) =>
            onChange({ provider: e.target.value as AudioTtsProvider })
          }
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 mb-0 text-xs leading-relaxed text-zinc-500">
          OpenAI TTS is the cheaper backup if ElevenLabs credits run out. In Auto
          mode the build tries ElevenLabs first, then switches to OpenAI when
          available.
        </p>
      </div>

      <div className={openaiOnly ? "opacity-60" : undefined}>
        <label className={labelClass()}>ElevenLabs voice</label>
        {voicesStatus === "missing_key" || voicesStatus === "auth_failed" ? (
          <p className="m-0 rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {voicesMessage || "ElevenLabs key missing."}{" "}
            <Link href={configureUrl} className="text-emerald-400 hover:underline">
              Configure at /admin/keys#elevenlabs
            </Link>
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {useCaseOptions.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled || openaiOnly}
              onClick={() => setUseCaseFilter(option)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                useCaseFilter === option
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {prettyLabel(option)}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {accentOptions.slice(0, 10).map((option) => (
            <button
              key={`accent-${option}`}
              type="button"
              disabled={disabled || openaiOnly}
              onClick={() => setAccentFilter(option)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide transition ${
                accentFilter === option
                  ? "border-sky-600 bg-sky-700 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {option === "All" ? "All accents" : option}
            </button>
          ))}
        </div>

        <input
          className={`${fieldClass()} mt-2`}
          placeholder="Search voices…"
          value={search}
          disabled={disabled || openaiOnly || voicesLoading}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className={`${fieldClass()} mt-2`}
          value={draft.elevenlabsVoiceId}
          disabled={disabled || openaiOnly || voicesLoading || filteredVoices.length === 0}
          onChange={(e) => onChange({ elevenlabsVoiceId: e.target.value })}
        >
          {filteredVoices.length === 0 ? (
            <option value="">
              {voicesLoading ? "Loading voices…" : "No voices available"}
            </option>
          ) : (
            <>
              <option value="">Select ElevenLabs voice…</option>
              {groupOrder.map((group) => (
                <optgroup key={group} label={group}>
                  {grouped[group]!.map((v) => (
                    <option key={v.id} value={v.id}>
                      {voiceOptionLabel(v)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </>
          )}
        </select>
      </div>

      {selectedVoice && !openaiOnly ? (
        <div className="rounded-md border border-zinc-700 bg-zinc-900/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-sm font-semibold text-zinc-100">{selectedVoice.name}</p>
            <span className="rounded-full bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white">
              Using now
            </span>
          </div>
          {selectedVoice.description ? (
            <p className="mt-2 mb-0 text-xs leading-relaxed text-zinc-400">
              {selectedVoice.description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedVoice.category ? (
              <span className="rounded-full border border-emerald-800/40 bg-emerald-950/50 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                {prettyLabel(selectedVoice.category)}
              </span>
            ) : null}
            {selectedBadges.map(([key, value]) => (
              <span
                key={key}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold text-zinc-300"
              >
                {prettyLabel(key)}: {prettyLabel(String(value))}
              </span>
            ))}
          </div>
          {selectedVoice.previewUrl ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={disabled}
                onClick={() => (previewing ? stopPreview() : playPreview())}
              >
                {previewing ? "Stop preview" : "Preview"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className={labelClass()}>OpenAI voice (fallback / OpenAI mode)</label>
        <select
          className={fieldClass()}
          value={draft.openaiVoice}
          disabled={disabled}
          onChange={(e) => onChange({ openaiVoice: e.target.value })}
        >
          <option value="">—</option>
          {openaiVoices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass()}>Tone</label>
          <select
            className={fieldClass()}
            value={draft.tone}
            disabled={disabled}
            onChange={(e) => onChange({ tone: e.target.value })}
          >
            {["energetic", "calm", "analytical", "broadcast", "neutral"].map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass()}>Voice style</label>
          <select
            className={fieldClass()}
            value={draft.voiceStyle}
            disabled={disabled}
            onChange={(e) => onChange({ voiceStyle: e.target.value })}
          >
            <option value="journalist">Journalist</option>
            <option value="television">Television</option>
            <option value="analyst">Analyst</option>
            <option value="former_player">Former player</option>
            <option value="storyteller">Storyteller</option>
          </select>
        </div>
        <div>
          <label className={labelClass()}>Delivery</label>
          <select
            className={fieldClass()}
            value={draft.deliveryStyle}
            disabled={disabled}
            onChange={(e) => onChange({ deliveryStyle: e.target.value })}
          >
            <option value="balanced">Balanced</option>
            <option value="energetic">Energetic</option>
            <option value="calm">Calm</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass()}>
          Speed ({draft.speed.toFixed(2)}×)
        </label>
        <input
          type="range"
          min={0.75}
          max={1.5}
          step={0.01}
          className="w-full"
          value={draft.speed}
          disabled={disabled}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
        />
      </div>
    </section>
  );
}
