"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PersonBioSections, PersonBioType, PersonRoleType } from "@/lib/person-intelligence-types";

const COACH_BIO_TYPES: Array<{ type: PersonBioType; label: string }> = [
  { type: "coach_short_bio", label: "Short bio" },
  { type: "coach_full_profile", label: "Full profile" },
  { type: "coach_career_summary", label: "Career summary" },
  { type: "coach_rating_explanation", label: "Rating explanation" },
];

const REFEREE_BIO_TYPES: Array<{ type: PersonBioType; label: string }> = [
  { type: "referee_short_bio", label: "Short bio" },
  { type: "referee_full_profile", label: "Full profile" },
  { type: "referee_appointment_summary", label: "Appointments" },
  { type: "referee_experience_profile", label: "Experience profile" },
];

const SECTION_LABELS: Record<keyof PersonBioSections, string> = {
  shortIntro: "Short intro",
  fullBio: "Full bio",
  careerSummary: "Career summary",
  ratingExplanation: "Rating / profile score explanation",
  appointmentSummary: "Appointment summary",
  experienceProfile: "Experience profile",
};

export function PersonIntelligencePanel({
  roleType,
  roleEntityId,
  intelligenceUrl,
  onApplied,
}: {
  roleType: PersonRoleType;
  roleEntityId: string;
  intelligenceUrl: string;
  onApplied?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [packet, setPacket] = useState<{
    score?: { displayScore?: number | null; explanation?: string; supportingScores?: Record<string, number | null> };
  } | null>(null);
  const [profile, setProfile] = useState<Record<string, string | null> | null>(null);
  const [latestSuggestion, setLatestSuggestion] = useState<{
    id: string;
    status: string;
    triggerReason: string;
    confidenceScore: number | null;
    suggestedSections: PersonBioSections;
    verificationReport?: { summary?: string; missingFields?: Array<{ label: string }> };
  } | null>(null);
  const [draftSections, setDraftSections] = useState<PersonBioSections | null>(null);

  const bioTypes = roleType === "coach" ? COACH_BIO_TYPES : REFEREE_BIO_TYPES;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(intelligenceUrl);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load intelligence");
      setLoading(false);
      return;
    }
    setPersonId(data.person?.id ?? null);
    setPacket(data.packet ?? null);
    setProfile(data.profile ?? null);
    setLatestSuggestion(data.latestSuggestion ?? null);
    setDraftSections(data.latestSuggestion?.suggestedSections ?? null);
    setLoading(false);
  }, [intelligenceUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const changes = useMemo(() => {
    if (!latestSuggestion) return [];
    const current = profile as PersonBioSections | null;
    return (Object.keys(SECTION_LABELS) as Array<keyof PersonBioSections>).filter(
      (key) => (current?.[key] ?? "").trim() !== latestSuggestion.suggestedSections[key].trim(),
    );
  }, [profile, latestSuggestion]);

  async function generate(bioType: PersonBioType) {
    if (!personId) return;
    setRunning(true);
    const res = await fetch(`/api/admin/people/${personId}/bio-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bioType, triggerReason: `Manual ${bioType} generation` }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Generation failed");
    else await load();
    setRunning(false);
  }

  async function approve() {
    if (!personId || !latestSuggestion || !draftSections) return;
    setRunning(true);
    const res = await fetch(`/api/admin/people/${personId}/bio-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        suggestionId: latestSuggestion.id,
        sections: draftSections,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Approve failed");
    } else {
      await load();
      onApplied?.();
    }
    setRunning(false);
  }

  async function reject() {
    if (!personId || !latestSuggestion) return;
    setRunning(true);
    const res = await fetch(`/api/admin/people/${personId}/bio-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", suggestionId: latestSuggestion.id }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Reject failed");
    } else await load();
    setRunning(false);
  }

  const scoreLabel =
    roleType === "coach" ? "Coach Rating" : "Referee Profile Score";

  return (
    <div className="cms-card mb-4 border border-indigo-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold m-0">Intelligence / Bio Automation</h3>
        <span className="text-xs text-zinc-500">Editor approval required</span>
      </div>

      {loading ? <p className="text-sm text-zinc-500 m-0">Loading…</p> : null}
      {error ? <p className="text-red-400 text-sm m-0 mb-3">{error}</p> : null}

      {packet?.score ? (
        <div className="text-sm mb-4 space-y-1">
          <p className="m-0">
            <span className="text-zinc-500">{scoreLabel}:</span>{" "}
            <strong>{packet.score.displayScore ?? "—"}</strong>
          </p>
          <p className="m-0 text-zinc-400">{packet.score.explanation}</p>
          {packet.score.supportingScores ? (
            <p className="m-0 text-zinc-500 text-xs">
              {Object.entries(packet.score.supportingScores)
                .map(([key, value]) => `${key}: ${value ?? "—"}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {bioTypes.map((item) => (
          <button
            key={item.type}
            type="button"
            className="cms-btn cms-btn--secondary touch-target"
            disabled={running || !personId}
            onClick={() => void generate(item.type)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {profile?.shortIntro ? (
        <section className="mb-4">
          <h4 className="text-sm font-medium m-0 mb-1">Approved intro</h4>
          <p className="text-sm text-zinc-300 m-0 whitespace-pre-wrap">{profile.shortIntro}</p>
        </section>
      ) : null}

      {latestSuggestion ? (
        <section className="space-y-3">
          <p className="text-sm text-amber-300 m-0">{latestSuggestion.triggerReason}</p>
          {changes.length > 0 ? (
            <p className="text-sm text-zinc-400 m-0">
              Changed sections: {changes.map((key) => SECTION_LABELS[key]).join(", ")}
            </p>
          ) : null}
          {draftSections
            ? (Object.keys(SECTION_LABELS) as Array<keyof PersonBioSections>)
                .filter((key) => draftSections[key].trim())
                .map((key) => (
                  <label key={key} className="block text-sm">
                    <span className="text-zinc-400">{SECTION_LABELS[key]}</span>
                    <textarea
                      className="cms-input w-full mt-1 min-h-[80px]"
                      value={draftSections[key]}
                      onChange={(e) =>
                        setDraftSections((current) =>
                          current ? { ...current, [key]: e.target.value } : current,
                        )
                      }
                    />
                  </label>
                ))
            : null}
          {latestSuggestion.status === "pending" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="cms-btn touch-target" disabled={running} onClick={() => void approve()}>
                Approve bio
              </button>
              <button type="button" className="cms-btn cms-btn--secondary touch-target" disabled={running} onClick={() => void reject()}>
                Reject
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
