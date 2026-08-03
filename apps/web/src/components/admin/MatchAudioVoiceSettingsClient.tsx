"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ActiveVoice = {
  profileId: string;
  slug: string;
  displayName: string;
  creatorProfileLabel?: string;
  role: string;
  provider: string;
  speed: number;
  tone: string;
  voiceStyle?: string;
  deliveryStyle?: string;
  source: string;
  voiceConfigured: boolean;
  defaultsLabel: string | null;
  accentLabel: string | null;
  stadiumAmbienceKey: string | null;
};

type Settings = {
  fixtureId: string;
  hasOverride: boolean;
  presenterCount?: number;
  activeRoles?: string[];
  leadProfileId: string | null;
  analystProfileId: string | null;
  leadSpeed: number | null;
  analystSpeed: number | null;
  leadTone: string | null;
  analystTone: string | null;
  leadVoiceStyle: string | null;
  analystVoiceStyle: string | null;
  leadDeliveryStyle: string | null;
  analystDeliveryStyle: string | null;
  optimiseDualCommentary: boolean | null;
  emphasiseScoreboard: boolean | null;
  aiPrompt: string | null;
  notes: string | null;
  competitionScope: string;
  defaultsLabel: string | null;
  accentLabel: string | null;
  stadiumAmbienceKey: string | null;
  active: { lead: ActiveVoice; analyst?: ActiveVoice };
};

type ProfileOption = {
  id: string;
  label: string;
  creatorProfileLabel: string;
  role: string;
  competitionScope: string | null;
  voiceStyle: string;
  deliveryStyle: string;
  tone: string;
  speed: number;
};

const TONE_OPTIONS = ["", "energetic", "calm", "analytical", "broadcast", "neutral"] as const;
const VOICE_STYLE_OPTIONS = [
  { value: "", label: "Inherit default" },
  { value: "journalist", label: "Journalist" },
  { value: "television", label: "Television" },
  { value: "analyst", label: "Analyst" },
  { value: "former_player", label: "Former player" },
  { value: "storyteller", label: "Storyteller" },
] as const;
const DELIVERY_OPTIONS = [
  { value: "", label: "Inherit default" },
  { value: "balanced", label: "Balanced" },
  { value: "energetic", label: "Energetic" },
  { value: "calm", label: "Calm" },
] as const;

function fieldClass() {
  return "w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100";
}

function labelClass() {
  return "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
}

function sourceLabel(source: string, defaultsLabel: string | null) {
  if (source === "match_override") return "Match override";
  if (defaultsLabel) return `Using ${defaultsLabel}`;
  if (source === "competition_default") return "Competition defaults";
  return "Profile defaults";
}

export function MatchAudioVoiceSettingsClient({ matchId }: { matchId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  const [leadProfileId, setLeadProfileId] = useState("");
  const [analystProfileId, setAnalystProfileId] = useState("");
  const [leadSpeed, setLeadSpeed] = useState("");
  const [analystSpeed, setAnalystSpeed] = useState("");
  const [leadTone, setLeadTone] = useState("");
  const [analystTone, setAnalystTone] = useState("");
  const [leadVoiceStyle, setLeadVoiceStyle] = useState("");
  const [analystVoiceStyle, setAnalystVoiceStyle] = useState("");
  const [leadDelivery, setLeadDelivery] = useState("");
  const [analystDelivery, setAnalystDelivery] = useState("");
  const [optimiseDual, setOptimiseDual] = useState(true);
  const [emphasiseScoreboard, setEmphasiseScoreboard] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");

  const applySettings = useCallback((s: Settings) => {
    setSettings(s);
    setLeadProfileId(s.leadProfileId ?? "");
    setAnalystProfileId(s.analystProfileId ?? "");
    setLeadSpeed(s.leadSpeed != null ? String(s.leadSpeed) : "");
    setAnalystSpeed(s.analystSpeed != null ? String(s.analystSpeed) : "");
    setLeadTone(s.leadTone ?? "");
    setAnalystTone(s.analystTone ?? "");
    setLeadVoiceStyle(s.leadVoiceStyle ?? "");
    setAnalystVoiceStyle(s.analystVoiceStyle ?? "");
    setLeadDelivery(s.leadDeliveryStyle ?? "");
    setAnalystDelivery(s.analystDeliveryStyle ?? "");
    setOptimiseDual(s.optimiseDualCommentary ?? true);
    setEmphasiseScoreboard(s.emphasiseScoreboard ?? true);
    setAiPrompt(s.aiPrompt ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/audio/voice-settings`);
      const data = (await res.json()) as {
        settings?: Settings;
        profiles?: ProfileOption[];
        error?: string;
      };
      if (!res.ok || !data.settings) throw new Error(data.error || "Failed to load");
      applySettings(data.settings);
      setProfiles(data.profiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [applySettings, matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  function onLeadChange(id: string) {
    setLeadProfileId(id);
    const p = profiles.find((x) => x.id === id);
    if (p) {
      setLeadTone(p.tone);
      setLeadSpeed(String(p.speed));
      setLeadVoiceStyle(p.voiceStyle);
      setLeadDelivery(p.deliveryStyle);
    }
  }

  function onAnalystChange(id: string) {
    setAnalystProfileId(id);
    const p = profiles.find((x) => x.id === id);
    if (p) {
      setAnalystTone(p.tone);
      setAnalystSpeed(String(p.speed));
      setAnalystVoiceStyle(p.voiceStyle);
      setAnalystDelivery(p.deliveryStyle);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/audio/voice-settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadProfileId: leadProfileId || null,
          analystProfileId: analystProfileId || null,
          leadSpeed: leadSpeed === "" ? null : Number(leadSpeed),
          analystSpeed: analystSpeed === "" ? null : Number(analystSpeed),
          leadTone: leadTone || null,
          analystTone: analystTone || null,
          leadVoiceStyle: leadVoiceStyle || null,
          analystVoiceStyle: analystVoiceStyle || null,
          leadDeliveryStyle: leadDelivery || null,
          analystDeliveryStyle: analystDelivery || null,
          optimiseDualCommentary: optimiseDual,
          emphasiseScoreboard,
          aiPrompt: aiPrompt || null,
        }),
      });
      const data = (await res.json()) as { settings?: Settings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || "Save failed");
      applySettings(data.settings);
      setStatus(
        data.settings.hasOverride
          ? "Match override saved — TTS will use these Creator Profiles."
          : "Saved (no override fields set — still using division defaults).",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/audio/voice-settings`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { settings?: Settings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || "Clear failed");
      applySettings(data.settings);
      setStatus("Cleared match override — using division defaults.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  async function regeneratePriority() {
    setRegen(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/audio/regenerate-priority`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "priority",
          limit: 12,
          speakers: ["lead", "analyst"],
          force: true,
        }),
      });
      const data = (await res.json()) as {
        regenerated?: number;
        failed?: number;
        skipped?: number;
        message?: string;
        error?: string;
        errors?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Regenerate failed");
      if (data.message) {
        setStatus(data.message);
      } else {
        setStatus(
          `Regenerated ${data.regenerated ?? 0} segments with active voices` +
            (data.failed ? ` (${data.failed} failed)` : "") +
            (data.skipped ? ` · ${data.skipped} skipped` : "") +
            ".",
        );
      }
      if (data.errors?.length) {
        setError(data.errors.slice(0, 3).join(" · "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegen(false);
    }
  }

  async function generateRemainingAudio() {
    setRegen(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/audio/regenerate-priority`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "remaining",
          speakers: ["lead", "analyst"],
        }),
      });
      const data = (await res.json()) as {
        regenerated?: number;
        failed?: number;
        skipped?: number;
        scriptCount?: number;
        message?: string;
        error?: string;
        errors?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Generate failed");
      if (data.message) {
        setStatus(data.message);
      } else {
        setStatus(
          `Full match audio: ${data.regenerated ?? 0} new segments` +
            (data.skipped ? ` · ${data.skipped} already ready` : "") +
            (data.failed ? ` · ${data.failed} failed` : "") +
            ` across ${data.scriptCount ?? "?"} scripts.`,
        );
      }
      if (data.errors?.length) {
        setError(data.errors.slice(0, 3).join(" · "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setRegen(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading voice settings…</p>;
  }

  if (!settings) {
    return (
      <p className="text-sm text-rose-400">{error ?? "Could not load voice settings."}</p>
    );
  }

  const leadOpts = profiles.filter((p) => p.role === "lead");
  const analystOpts = profiles.filter((p) => p.role === "analyst");

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-zinc-400">
        Prefer the hub for full Voice Settings (ElevenLabs picker, 1–4 presenters):{" "}
        <Link href="/admin/audio-commentary" className="text-emerald-400 hover:underline">
          Admin → Audio Commentary
        </Link>{" "}
        → Match override.
      </p>
      <div
        className={`rounded-md border px-3 py-3 ${
          settings.hasOverride
            ? "border-amber-800/50 bg-amber-950/20"
            : "border-emerald-800/40 bg-emerald-950/15"
        }`}
      >
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Active voices
        </p>
        <p className="mt-1 mb-0 text-sm text-zinc-100">
          {settings.hasOverride
            ? "Match override"
            : sourceLabel(settings.active.lead.source, settings.defaultsLabel)}
        </p>
        <p className="mt-1 mb-0 text-xs text-zinc-500">
          Scope <code>{settings.competitionScope}</code>
          {settings.accentLabel ? ` · ${settings.accentLabel}` : ""}
          {settings.stadiumAmbienceKey ? ` · ambience ${settings.stadiumAmbienceKey}` : ""}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["lead", "analyst"] as const).map((role) => {
            const v = settings.active[role];
            return (
              <div
                key={role}
                className="rounded border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 text-xs text-zinc-300"
              >
                <p className="m-0 font-semibold capitalize text-zinc-100">{role}</p>
                {v ? (
                  <>
                    <p className="m-0 mt-0.5">
                      {v.creatorProfileLabel ?? v.displayName}
                    </p>
                    <p className="m-0 text-zinc-500">
                      {v.provider} · speed {v.speed.toFixed(2)} · {v.tone}
                      {v.voiceStyle ? ` · ${v.voiceStyle}` : ""}
                      {!v.voiceConfigured ? " · voice ID missing" : ""}
                    </p>
                  </>
                ) : (
                  <p className="m-0 mt-0.5 text-zinc-500">
                    Not active (presenter count {settings.presenterCount ?? 1}) — set division
                    defaults to 2 for Lead + Analyst.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error ? <p className="m-0 text-sm text-rose-400">{error}</p> : null}
      {status ? <p className="m-0 text-sm text-emerald-400">{status}</p> : null}

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Voiceover settings — match override
          </h3>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className={labelClass()}>Creator Profile — Lead</label>
            <select
              className={fieldClass()}
              value={leadProfileId}
              onChange={(e) => onLeadChange(e.target.value)}
            >
              <option value="">
                Inherit · {settings.active.lead.creatorProfileLabel ?? settings.active.lead.displayName}
              </option>
              {leadOpts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.creatorProfileLabel || p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()}>Creator Profile — Analyst</label>
            <select
              className={fieldClass()}
              value={analystProfileId}
              onChange={(e) => onAnalystChange(e.target.value)}
            >
              <option value="">
                Inherit ·{" "}
                {settings.active.analyst?.creatorProfileLabel ??
                  settings.active.analyst?.displayName ??
                  "division Analyst"}
              </option>
              {analystOpts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.creatorProfileLabel || p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass()}>Voice style (Lead)</label>
              <select
                className={fieldClass()}
                value={leadVoiceStyle}
                onChange={(e) => setLeadVoiceStyle(e.target.value)}
              >
                {VOICE_STYLE_OPTIONS.map((o) => (
                  <option key={o.value || "inherit"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Delivery style</label>
              <select
                className={fieldClass()}
                value={leadDelivery}
                onChange={(e) => setLeadDelivery(e.target.value)}
              >
                {DELIVERY_OPTIONS.map((o) => (
                  <option key={o.value || "inherit"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Tone (Lead)</label>
              <select
                className={fieldClass()}
                value={leadTone}
                onChange={(e) => setLeadTone(e.target.value)}
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t || "inherit"} value={t}>
                    {t || "Inherit default"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass()}>Voice style (Analyst)</label>
              <select
                className={fieldClass()}
                value={analystVoiceStyle}
                onChange={(e) => setAnalystVoiceStyle(e.target.value)}
              >
                {VOICE_STYLE_OPTIONS.map((o) => (
                  <option key={o.value || "inherit-a"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Delivery (Analyst)</label>
              <select
                className={fieldClass()}
                value={analystDelivery}
                onChange={(e) => setAnalystDelivery(e.target.value)}
              >
                {DELIVERY_OPTIONS.map((o) => (
                  <option key={o.value || "inherit-ad"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Tone (Analyst)</label>
              <select
                className={fieldClass()}
                value={analystTone}
                onChange={(e) => setAnalystTone(e.target.value)}
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t || "inherit-at"} value={t}>
                    {t || "Inherit default"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass()}>Lead speed (blank = default)</label>
              <input
                type="number"
                min={0.75}
                max={1.5}
                step={0.01}
                className={fieldClass()}
                value={leadSpeed}
                placeholder={String(settings.active.lead.speed)}
                onChange={(e) => setLeadSpeed(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Analyst speed</label>
              <input
                type="number"
                min={0.75}
                max={1.5}
                step={0.01}
                className={fieldClass()}
                value={analystSpeed}
                placeholder={String(settings.active.analyst.speed)}
                onChange={(e) => setAnalystSpeed(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimiseDual}
                onChange={(e) => setOptimiseDual(e.target.checked)}
              />
              Optimise for dual commentary
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

          <div className="border-t border-zinc-800 pt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowAiPrompt((v) => !v)}
            >
              <span className={labelClass() + " mb-0"}>AI prompt (editable)</span>
              <span className="rounded border border-emerald-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                {showAiPrompt ? "Hide" : "Show"}
              </span>
            </button>
            {showAiPrompt ? (
              <textarea
                className={`${fieldClass()} mt-2 min-h-[80px] font-mono text-xs`}
                value={aiPrompt}
                placeholder="Optional match-level TTS direction override…"
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save script + AI voice settings"}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={saving || !settings.hasOverride}
          onClick={() => void clearOverride()}
        >
          Clear override
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={regen}
          onClick={() => void regeneratePriority()}
        >
          {regen ? "Working…" : "Regenerate priority audio with new voices"}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={regen}
          onClick={() => void generateRemainingAudio()}
        >
          {regen ? "Working…" : "Generate remaining / full match audio"}
        </button>
        <Link href="/admin/audio-commentary" className="cms-btn cms-btn--secondary">
          Division Creator Profiles
        </Link>
      </div>
    </div>
  );
}
