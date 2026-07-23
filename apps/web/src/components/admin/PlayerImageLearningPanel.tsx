"use client";

import { useCallback, useEffect, useState } from "react";

type LearningRule = {
  id: string;
  ruleKey: string;
  kind: string;
  pattern: string;
  penalty: number;
  scope: string;
  rationale: string;
  status: string;
  sourceSnapshot?: {
    playerName?: string;
    imageUrl?: string;
    altText?: string | null;
    articleTitle?: string | null;
  } | null;
};

export function PlayerImageLearningPanel() {
  const [pending, setPending] = useState<LearningRule[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/player-image-learning?status=pending", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setPending(data.rules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load learning rules");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function learnFromRejected() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/player-image-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "learn_from_rejected" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Learn failed");
      setPending(data.pending ?? []);
      setMessage(
        `Scanned ${data.scanned} rejected image(s); created ${data.created} new proposal(s). ${data.pendingCount} pending review.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Learn failed");
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/player-image-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      setMessage(action === "approve" ? "Rule approved — now used in scoring." : "Proposal rejected.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cms-card mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold m-0">Learn from rejected images</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Builds match-rule proposals from editor rejections. Nothing changes live scoring until
            you approve a proposal.
          </p>
        </div>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={busy}
          onClick={() => void learnFromRejected()}
        >
          {busy ? "Working…" : "Learn from rejected images"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-400 mb-2">{message}</p> : null}
      {error ? <p className="text-sm text-red-400 mb-2">{error}</p> : null}

      {pending.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">No pending learning proposals.</p>
      ) : (
        <ul className="m-0 p-0 list-none space-y-3">
          {pending.map((rule) => (
            <li
              key={rule.id}
              className="rounded border border-white/10 bg-black/20 p-3 text-sm"
            >
              <p className="m-0 font-medium text-zinc-200">
                {rule.kind} · <code className="text-amber-300">{rule.pattern}</code>
              </p>
              <p className="m-0 mt-1 text-zinc-400">{rule.rationale}</p>
              {rule.sourceSnapshot?.playerName ? (
                <p className="m-0 mt-1 text-xs text-zinc-500">
                  From {rule.sourceSnapshot.playerName}
                  {rule.sourceSnapshot.articleTitle
                    ? ` · ${rule.sourceSnapshot.articleTitle}`
                    : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--primary"
                  disabled={busy}
                  onClick={() => void review(rule.id, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={busy}
                  onClick={() => void review(rule.id, "reject")}
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
