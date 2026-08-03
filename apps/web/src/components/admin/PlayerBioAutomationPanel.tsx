"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlayerBioSections, PlayerProfileBioType } from "@/lib/player-bio-types";
import { PLAYER_PROFILE_BIO_TYPES } from "@/lib/player-bio-types";
import {
  BIO_TAB_LABELS,
  sectionsForBioTab,
} from "@/lib/player-bio-variant-utils";

type BioSuggestion = {
  id: string;
  bioType: string;
  triggerReason: string;
  status: string;
  confidenceScore: number | null;
  createdAt: string;
  suggestedSections: PlayerBioSections;
  verificationReport?: {
    summary?: string;
    missingFields?: Array<{ field: string; label: string; importance: string }>;
    conflictingFields?: Array<{ field: string; label: string }>;
    suggestedEditorAction?: string;
    sourceUrls?: Array<{ label: string; url: string }>;
  };
};

type BioVariants = Record<PlayerProfileBioType, PlayerBioSections>;

const SECTION_LABELS: Record<keyof PlayerBioSections, string> = {
  shortIntro: "Short intro",
  fullBio: "Full profile",
  playingStyle: "Playing style",
  strengths: "Strengths",
  areasToImprove: "Areas to improve",
  careerSummary: "Career summary",
  internationalSummary: "International summary",
  currentSeasonSummary: "Current season summary",
  scoutingSummary: "Scouting summary",
  ratingExplanation: "Rating explanation",
  legendSummary: "Legend summary",
};

function emptySections(): PlayerBioSections {
  return {
    shortIntro: "",
    fullBio: "",
    playingStyle: "",
    strengths: "",
    areasToImprove: "",
    careerSummary: "",
    internationalSummary: "",
    currentSeasonSummary: "",
    scoutingSummary: "",
    ratingExplanation: "",
    legendSummary: "",
  };
}

export function PlayerBioAutomationPanel({
  playerId,
  onApplied,
  preferredTab,
}: {
  playerId: string;
  onApplied?: () => void;
  /** Sync CMS Club / International / Scout category into the bio tab */
  preferredTab?: PlayerProfileBioType;
}) {
  const [activeTab, setActiveTab] = useState<PlayerProfileBioType>(
    preferredTab ?? "domestic",
  );

  useEffect(() => {
    if (preferredTab) setActiveTab(preferredTab);
  }, [preferredTab]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<BioVariants>({
    domestic: emptySections(),
    international: emptySections(),
    scouting: emptySections(),
  });
  const [savedVariants, setSavedVariants] = useState<BioVariants>({
    domestic: emptySections(),
    international: emptySections(),
    scouting: emptySections(),
  });
  const [suggestions, setSuggestions] = useState<BioSuggestion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/players/${playerId}/bio-suggestions`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load bio automation");
      setLoading(false);
      return;
    }

    const nextVariants = (data.variants ?? {
      domestic: emptySections(),
      international: emptySections(),
      scouting: emptySections(),
    }) as BioVariants;

    for (const bioType of PLAYER_PROFILE_BIO_TYPES) {
      const pending = (data.suggestions ?? []).find(
        (row: BioSuggestion) => row.bioType === bioType && row.status === "pending",
      );
      if (pending) nextVariants[bioType] = pending.suggestedSections;
    }

    setVariants(nextVariants);
    setSavedVariants(
      (data.variants ?? {
        domestic: emptySections(),
        international: emptySections(),
        scouting: emptySections(),
      }) as BioVariants,
    );
    setSuggestions(data.suggestions ?? []);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingSuggestion = useMemo(
    () => suggestions.find((row) => row.bioType === activeTab && row.status === "pending") ?? null,
    [suggestions, activeTab],
  );

  const draftSections = variants[activeTab];

  const tabSections = sectionsForBioTab(activeTab);

  const hasUnsavedEdits = useMemo(() => {
    return tabSections.some(
      (key) => (variants[activeTab][key] ?? "").trim() !== (savedVariants[activeTab][key] ?? "").trim(),
    );
  }, [variants, savedVariants, activeTab, tabSections]);

  function updateDraftSection(key: keyof PlayerBioSections, value: string) {
    setVariants((current) => ({
      ...current,
      [activeTab]: { ...current[activeTab], [key]: value },
    }));
  }

  async function generateSuggestion(bioType: PlayerProfileBioType) {
    setRunning(true);
    setError("");
    const res = await fetch(`/api/admin/players/${playerId}/bio-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bioType,
        triggerReason: `Manual ${bioType} bio generation from CMS`,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Bio generation failed");
    else await load();
    setRunning(false);
  }

  async function saveProfile() {
    setRunning(true);
    setError("");
    const res = await fetch(`/api/admin/players/${playerId}/bio-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bioType: activeTab,
        sections: variants[activeTab],
        changeSummary: `Manual save of ${activeTab} bio`,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Save failed");
    else {
      await load();
      onApplied?.();
    }
    setRunning(false);
  }

  async function approve() {
    if (!pendingSuggestion) return;
    setRunning(true);
    setError("");
    const res = await fetch(`/api/admin/players/${playerId}/bio-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionId: pendingSuggestion.id,
        action: "approve",
        sections: variants[activeTab],
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Approve failed");
    else {
      await load();
      onApplied?.();
    }
    setRunning(false);
  }

  async function reject() {
    if (!pendingSuggestion) return;
    setRunning(true);
    const res = await fetch(`/api/admin/players/${playerId}/bio-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionId: pendingSuggestion.id, action: "reject" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Reject failed");
    else await load();
    setRunning(false);
  }

  return (
    <div className="cms-card mb-4 border border-sky-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold m-0">Bio profiles</h3>
        <span className="text-xs text-zinc-500">Club, International and Scout saved separately</span>
      </div>
      <p className="text-sm text-zinc-500 mt-0 mb-3">
        Each profile is stored independently. Player updates (club moves, caps, ratings, match stats) queue
        refresh suggestions for the relevant Club / International / Scout profiles without overwriting the others.
      </p>

      <div className="cms-tabs mb-4">
        {PLAYER_PROFILE_BIO_TYPES.map((bioType) => {
          const hasPending = suggestions.some((row) => row.bioType === bioType && row.status === "pending");
          const hasSaved = Object.values(savedVariants[bioType]).some((value) => value.trim());
          return (
            <button
              key={bioType}
              type="button"
              className={`cms-tab${activeTab === bioType ? " cms-tab--active" : ""}`}
              onClick={() => setActiveTab(bioType)}
            >
              {BIO_TAB_LABELS[bioType]}
              {hasPending ? " •" : hasSaved ? "" : " (empty)"}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="cms-btn cms-btn--secondary touch-target"
          disabled={running}
          onClick={() => void generateSuggestion(activeTab)}
        >
          Generate {BIO_TAB_LABELS[activeTab].toLowerCase()}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--primary touch-target"
          disabled={running || !hasUnsavedEdits || Boolean(pendingSuggestion)}
          onClick={() => void saveProfile()}
        >
          Save {BIO_TAB_LABELS[activeTab].toLowerCase()}
        </button>
      </div>

      {error ? <p className="text-red-400 text-sm m-0 mb-3">{error}</p> : null}
      {loading ? <p className="text-sm text-zinc-500 m-0">Loading bio profiles…</p> : null}

      {!loading ? (
        <section className="space-y-4">
          {pendingSuggestion ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-2">
              <p className="m-0 text-amber-300">
                Pending AI suggestion — {pendingSuggestion.triggerReason}
              </p>
              {pendingSuggestion.verificationReport?.summary ? (
                <p className="m-0 text-zinc-400">{pendingSuggestion.verificationReport.summary}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="cms-btn touch-target" disabled={running} onClick={() => void approve()}>
                  Approve {BIO_TAB_LABELS[activeTab].toLowerCase()}
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary touch-target"
                  disabled={running}
                  onClick={() => void reject()}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}

          {tabSections.map((key) => (
              <label key={key} className="block text-sm">
                <span className="text-zinc-400">{SECTION_LABELS[key]}</span>
                <textarea
                  className="cms-input w-full mt-1 min-h-[90px]"
                  value={variants[activeTab][key]}
                  onChange={(e) => updateDraftSection(key, e.target.value)}
                />
              </label>
            ))}
        </section>
      ) : null}
    </div>
  );
}
