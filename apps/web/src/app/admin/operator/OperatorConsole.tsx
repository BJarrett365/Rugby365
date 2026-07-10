"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FixturesScheduleBoard } from "@/components/matches/FixturesScheduleBoard";
import type { ScheduleFixture } from "@/components/matches/match-schedule-utils";
import { PageHeader } from "@/components/shell/PageHeader";

type Suggestion = {
  id: string;
  renderedOptions: string[];
  facts: Record<string, unknown>;
  createdAt: string;
};

function suggestionLabel(facts: Record<string, unknown>) {
  if (typeof facts.segment_label === "string") return facts.segment_label;
  if (typeof facts.event_type === "string") return facts.event_type.replace(/_/g, " ");
  return "Commentary";
}

export default function OperatorConsole() {
  const searchParams = useSearchParams();
  const initialFixtureId = searchParams.get("fixtureId") ?? "";

  const [fixtureId, setFixtureId] = useState(initialFixtureId);
  const [selectedFixture, setSelectedFixture] = useState<ScheduleFixture | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialFixtureId) setFixtureId(initialFixtureId);
  }, [initialFixtureId]);

  const handleSelectFixture = useCallback((fixture: ScheduleFixture) => {
    setFixtureId(fixture.id);
    setSelectedFixture(fixture);
  }, []);

  const load = useCallback(async () => {
    if (!fixtureId) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(`/api/operator/commentary/suggestions?fixtureId=${fixtureId}`);
    const data = (await res.json()) as { suggestions: Suggestion[] };
    setSuggestions(data.suggestions ?? []);
  }, [fixtureId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function approve(suggestionId: string, selectedIndex: number) {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/operator/commentary/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionId, selectedIndex }),
    });
    if (res.ok) {
      setMessage("Published!");
      await load();
    } else {
      const data = await res.json();
      setMessage(data.error ?? "Approve failed");
    }
    setLoading(false);
  }

  const fixtureLabel = selectedFixture
    ? `${selectedFixture.homeTeam?.name ?? "Home"} vs ${selectedFixture.awayTeam?.name ?? "Away"}`
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Commentary approval"
        description="Pick a match by date — same calendar as Matches — then approve lines before they go live."
        actions={
          <Link href="/admin/matches" className="cms-btn cms-btn--secondary touch-target">
            Matches
          </Link>
        }
      />

      <FixturesScheduleBoard
        admin
        selectedFixtureId={fixtureId}
        onSelectFixture={handleSelectFixture}
        initialFixtureId={initialFixtureId || undefined}
      />

      {fixtureId && fixtureLabel && (
        <div className="cms-card max-w-3xl my-6 space-y-1">
          <p className="text-sm text-zinc-300 m-0 font-medium">Selected: {fixtureLabel}</p>
          <p className="text-xs text-zinc-600 m-0">
            <Link href={`/matches/${selectedFixture?.slug}/commentary`} className="text-emerald-500 hover:underline">
              Public feed
            </Link>
            {" · "}
            <Link href={`/admin/matches/${fixtureId}/edit`} className="text-zinc-400 hover:underline">
              Edit match
            </Link>
          </p>
        </div>
      )}

      {message && <p className="text-emerald-400 text-sm mb-4">{message}</p>}
      {!fixtureId ? (
        <p className="text-zinc-500 text-sm">Select an imported CMS match above to review pending commentary.</p>
      ) : suggestions.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          No pending suggestions. Sync from Sport365 on the match edit page or run the demo feed.
        </p>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {suggestions.map((s) => (
            <article key={s.id} className="cms-card space-y-3">
              <p className="text-xs text-zinc-500 m-0">
                {suggestionLabel(s.facts)}
                {s.facts?.minute !== undefined ? ` @ ${String(s.facts.minute)}'` : ""}
                {s.facts?.source === "openai" ? " · AI draft" : s.facts?.source === "template" ? " · Template" : ""}
              </p>
              <div className="grid gap-2">
                {(s.renderedOptions as string[]).map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={loading}
                    onClick={() => approve(s.id, i)}
                    className="touch-target text-left rounded-lg border border-zinc-700 px-4 py-3 hover:border-emerald-500 hover:bg-zinc-800 transition text-sm w-full"
                  >
                    <span className="text-zinc-500 mr-2">{i + 1}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
