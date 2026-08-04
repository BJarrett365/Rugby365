"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { RugbyShirtSvg } from "@/components/shirts/RugbyShirtSvg";
import { ShirtPitchPreview } from "@/components/shirts/ShirtPitchPreview";
import { checkNumberContrast } from "@/lib/shirt-library-math";
import { NATIONS_CHAMPIONSHIP_SHIRT_SEEDS } from "@/lib/shirt-library-nations-seed";
import type { ShirtSvgConfig } from "@/lib/shirt-library-types";
import { SHIRT_PATTERNS } from "@/lib/shirt-library-types";
import "@/styles/shirt-library.css";

type ShirtBundle = {
  shirt: {
    id: string;
    kitType: string;
    name: string;
    status: string;
    crestId?: string | null;
    approvedForPitchUse: boolean;
    approvedBy: string | null;
    approvedAt: string | null;
    updatedAt: string;
    createdBy: string | null;
    useOnLineups: boolean;
    useOnTeamOfWeek: boolean;
    useOnMatchAnimations: boolean;
    useOnSocialGraphics: boolean;
    useOnBettingGraphics: boolean;
  };
  latestVersion: {
    id: string;
    versionNumber: number;
    bodyColour: string;
    secondaryColour: string | null;
    sleeveColour: string | null;
    collarColour: string | null;
    cuffColour: string | null;
    sidePanelColour: string | null;
    patternType: string;
    patternColour: string | null;
    patternSettings: Record<string, unknown>;
    numberColour: string;
    numberBorderColour: string | null;
    crestEnabled: boolean;
  } | null;
  svgConfig: ShirtSvgConfig | null;
  references: Array<{ id: string; imageUrl: string; imageType: string }>;
  reviews: Array<{
    id: string;
    status: string;
    reviewNotes: string | null;
    reviewedBy: string | null;
    reviewedAt: string;
  }>;
};

const KIT_ORDER = ["HOME", "AWAY", "THIRD", "ALTERNATE"] as const;

const DEFAULT_COLOURS: Record<string, Partial<ShirtSvgConfig> & { bodyColour: string }> = {
  HOME: { bodyColour: "#222222", secondaryColour: "#ffffff", numberColour: "#FFFFFF", patternType: "PLAIN" },
  AWAY: { bodyColour: "#FFFFFF", secondaryColour: "#222222", numberColour: "#111111", patternType: "PLAIN" },
  THIRD: { bodyColour: "#1a237e", secondaryColour: "#ffffff", numberColour: "#FFFFFF", patternType: "PLAIN" },
  ALTERNATE: { bodyColour: "#4a148c", secondaryColour: "#ffffff", numberColour: "#FFFFFF", patternType: "PLAIN" },
};

/** Prefill Create form from Nations seed guide when the team matches. */
function nationsPrefill(teamName: string, kit: string): (Partial<ShirtSvgConfig> & { bodyColour: string }) | null {
  const seed = NATIONS_CHAMPIONSHIP_SHIRT_SEEDS.find((s) =>
    s.teamNames.some((n) => n.toLowerCase() === teamName.trim().toLowerCase()),
  );
  const kitSeed = seed?.kits.find((k) => k.kitType === kit);
  if (!kitSeed) return null;
  return {
    bodyColour: kitSeed.bodyColour,
    secondaryColour: kitSeed.secondaryColour,
    sleeveColour: kitSeed.sleeveColour ?? kitSeed.bodyColour,
    collarColour: kitSeed.collarColour ?? kitSeed.bodyColour,
    cuffColour: kitSeed.cuffColour ?? kitSeed.bodyColour,
    sidePanelColour: kitSeed.sidePanelColour ?? null,
    patternType: kitSeed.patternType,
    patternColour: kitSeed.patternColour ?? null,
    patternSettings: kitSeed.patternSettings ?? { fabricTexture: true },
    numberColour: kitSeed.numberColour,
  };
}

function StatusPill({ status }: { status: string }) {
  return <span className={`shirt-lib__status-pill shirt-lib__status-pill--${status}`}>{status}</span>;
}

export function ShirtLibraryTeamClient({
  competitionId,
  seasonId,
  teamId,
  competitionName,
  seasonLabel,
  teamName,
  teamImageUrl,
  countryName,
}: {
  competitionId: string;
  seasonId: string;
  teamId: string;
  competitionName: string;
  seasonLabel: string;
  teamName: string;
  teamImageUrl: string | null;
  countryName: string | null;
}) {
  const [shirts, setShirts] = useState<ShirtBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingKit, setEditingKit] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [form, setForm] = useState({
    bodyColour: "#222222",
    secondaryColour: "#ffffff",
    sleeveColour: "",
    collarColour: "",
    cuffColour: "",
    sidePanelColour: "",
    patternType: "PLAIN",
    patternColour: "",
    patternSettings: {} as Record<string, unknown>,
    numberColour: "#FFFFFF",
    crestEnabled: true,
    referenceUrl: "",
  });

  async function reload() {
    const res = await fetch(
      `/api/admin/shirt-library/teams/${teamId}/shirts?competitionId=${competitionId}&seasonId=${seasonId}`,
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load shirts");
    setShirts(json.shirts ?? []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [competitionId, seasonId, teamId]);

  const byKit = useMemo(() => {
    const map = new Map(shirts.map((s) => [s.shirt.kitType, s]));
    return map;
  }, [shirts]);

  const summary = useMemo(() => {
    const home = byKit.get("HOME")?.shirt.status ?? "Not Created";
    const away = byKit.get("AWAY")?.shirt.status ?? "Not Created";
    const third = byKit.get("THIRD")?.shirt.status ?? "Not Created";
    const requiredOk =
      byKit.get("HOME")?.shirt.status === "APPROVED" &&
      byKit.get("AWAY")?.shirt.status === "APPROVED";
    return { home, away, third, setStatus: requiredOk ? "Fully Approved" : "Incomplete" };
  }, [byKit]);

  function openCreate(kit: string) {
    const defaults =
      nationsPrefill(teamName, kit) ?? DEFAULT_COLOURS[kit] ?? DEFAULT_COLOURS.HOME!;
    const body = defaults.bodyColour;
    setEditingKit(kit);
    setForm({
      bodyColour: body,
      secondaryColour: String(defaults.secondaryColour ?? "#ffffff"),
      sleeveColour: String(defaults.sleeveColour ?? body),
      collarColour: String(defaults.collarColour ?? body),
      cuffColour: String(defaults.cuffColour ?? body),
      sidePanelColour: String(defaults.sidePanelColour ?? ""),
      patternType: String(defaults.patternType ?? "PLAIN"),
      patternColour: String(defaults.patternColour ?? ""),
      patternSettings: {
        fabricTexture: true,
        fabricTextureOpacity: 0.1,
        ...((defaults.patternSettings as Record<string, unknown>) ?? {}),
      },
      numberColour: String(defaults.numberColour ?? "#FFFFFF"),
      crestEnabled: true,
      referenceUrl: "",
    });
    setMessage(null);
    setError(null);
  }

  function openEdit(bundle: ShirtBundle) {
    const v = bundle.latestVersion;
    if (!v) return;
    setEditingKit(bundle.shirt.kitType);
    setForm({
      bodyColour: v.bodyColour,
      secondaryColour: v.secondaryColour ?? "#ffffff",
      sleeveColour: v.sleeveColour ?? v.bodyColour,
      collarColour: v.collarColour ?? v.bodyColour,
      cuffColour: v.cuffColour ?? v.bodyColour,
      sidePanelColour: v.sidePanelColour ?? "",
      patternType: v.patternType,
      patternColour: v.patternColour ?? "",
      patternSettings: (v.patternSettings as Record<string, unknown>) ?? {
        fabricTexture: true,
        fabricTextureOpacity: 0.1,
      },
      numberColour: v.numberColour,
      crestEnabled: v.crestEnabled,
      referenceUrl: "",
    });
  }

  const previewConfig: ShirtSvgConfig = {
    bodyColour: form.bodyColour,
    secondaryColour: form.secondaryColour || null,
    sleeveColour: form.sleeveColour || form.bodyColour,
    // Collar/cuffs match body (Italy product style) — do NOT fall back to secondary white.
    collarColour: form.collarColour || form.bodyColour,
    cuffColour: form.cuffColour || form.bodyColour,
    sidePanelColour: form.sidePanelColour || null,
    patternType: form.patternType,
    patternColour: form.patternColour || null,
    patternSettings: {
      fabricTexture: true,
      fabricTextureOpacity: 0.1,
      ...form.patternSettings,
    },
    numberColour: form.numberColour,
    numberBorderColour: null,
    crestEnabled: form.crestEnabled,
  };

  const contrast = checkNumberContrast({
    numberColour: form.numberColour,
    bodyColour: form.bodyColour,
    // Only stripe/hoop patterns sit under the number enough to matter.
    patternColour:
      form.patternType === "HOOPS" ||
      form.patternType === "HORIZONTAL_STRIPES" ||
      form.patternType === "VERTICAL_STRIPES" ||
      form.patternType === "CHEST_BAND"
        ? form.patternColour || form.secondaryColour
        : null,
  });

  function versionPayload() {
    return {
      bodyColour: form.bodyColour,
      secondaryColour: form.secondaryColour || null,
      sleeveColour: form.sleeveColour || form.bodyColour,
      collarColour: form.collarColour || form.bodyColour,
      cuffColour: form.cuffColour || form.bodyColour,
      sidePanelColour: form.sidePanelColour || null,
      patternType: form.patternType,
      patternSettings: {
        fabricTexture: true,
        fabricTextureOpacity: 0.1,
        ...form.patternSettings,
      },
      patternColour: form.patternColour || null,
      numberColour: form.numberColour,
      crestEnabled: form.crestEnabled,
    };
  }

  function saveDraft() {
    if (!editingKit) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const existing = byKit.get(editingKit);
        if (!existing) {
          const res = await fetch("/api/admin/shirt-library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              competitionId,
              seasonId,
              kitType: editingKit,
              version: versionPayload(),
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Create failed");
          if (form.referenceUrl.trim()) {
            await fetch(`/api/admin/shirt-library/shirts/${json.shirt.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "add-reference",
                reference: { imageUrl: form.referenceUrl.trim(), imageType: "front" },
              }),
            });
          }
          setMessage("Draft shirt created (not approved — not public).");
        } else if (existing.shirt.status === "APPROVED") {
          const res = await fetch(`/api/admin/shirt-library/shirts/${existing.shirt.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "new-version", version: versionPayload() }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "New version failed");
          setMessage("New version created. Previous approved kit stays live until this is approved.");
        } else if (existing.latestVersion) {
          const res = await fetch(`/api/admin/shirt-library/shirts/${existing.shirt.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update-version",
              versionId: existing.latestVersion.id,
              version: versionPayload(),
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Update failed");
          if (form.referenceUrl.trim()) {
            await fetch(`/api/admin/shirt-library/shirts/${existing.shirt.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "add-reference",
                reference: { imageUrl: form.referenceUrl.trim(), imageType: "front" },
              }),
            });
          }
          setMessage("Draft updated.");
        }
        setEditingKit(null);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function runAction(
    shirtId: string,
    action: "submit" | "approve" | "request-changes" | "reject" | "archive",
  ) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        if (
          (action === "request-changes" || action === "reject") &&
          !reviewNotes.trim()
        ) {
          throw new Error("Add a review note before requesting changes or rejecting");
        }
        const res = await fetch(`/api/admin/shirt-library/shirts/${shirtId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: reviewNotes }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Action failed");
        setReviewNotes("");
        setMessage(
          action === "approve"
            ? "Approved for pitch use."
            : action === "submit"
              ? "Submitted for review."
              : `Marked ${action}.`,
        );
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="shirt-lib space-y-4">
      <section className="cms-card">
        <div className="flex flex-wrap items-center gap-3">
          {teamImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamImageUrl} alt="" width={48} height={48} className="rounded" />
          ) : null}
          <div>
            <p className="text-sm text-[var(--pr-grey)] mb-0">
              {competitionName} · {seasonLabel}
            </p>
            <h2 className="text-xl font-semibold mt-0 mb-0">{teamName}</h2>
            {countryName ? (
              <p className="text-sm text-[var(--pr-grey)] mb-0">{countryName}</p>
            ) : null}
            <p className="text-sm text-[var(--pr-grey)] mt-1 mb-0">
              Team-linked kits ·{" "}
              <Link href={`/admin/crest-library/${competitionId}/${seasonId}/${teamId}`}>
                Manage crest
              </Link>
              {shirts.some((s) => s.shirt.crestId)
                ? ` · ${shirts.filter((s) => s.shirt.crestId).length} kit(s) crest-linked`
                : " · crest not linked yet"}
            </p>
          </div>
          <Link
            href={`/admin/shirt-library/${competitionId}/${seasonId}`}
            className="cms-btn cms-btn--secondary ml-auto"
          >
            ← Competition dashboard
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 text-sm">
          <span>
            Home: <StatusPill status={summary.home} />
          </span>
          <span>
            Away: <StatusPill status={summary.away} />
          </span>
          <span>
            Third: <StatusPill status={summary.third} />
          </span>
          <span>
            Team Shirt Set: <StatusPill status={summary.setStatus} />
          </span>
        </div>
      </section>

      {error ? <p className="text-sm text-red-400 mb-0">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--pr-gold)] mb-0">{message}</p> : null}

      <div className="shirt-lib__shirt-cards">
        {KIT_ORDER.map((kit) => {
          const bundle = byKit.get(kit);
          if (!bundle) {
            return (
              <div key={kit} className="shirt-lib__card">
                <h3 className="mt-0 mb-2">{kit} Shirt</h3>
                <p className="text-sm text-[var(--pr-grey)]">No {kit} Shirt Created</p>
                <button
                  type="button"
                  className="cms-btn cms-btn--primary"
                  onClick={() => openCreate(kit)}
                >
                  Create {kit} Shirt
                </button>
              </div>
            );
          }

          const cfg = bundle.svgConfig;
          return (
            <div key={kit} className="shirt-lib__card">
              <div className="flex items-center justify-between gap-2">
                <h3 className="mt-0 mb-0">{bundle.shirt.name}</h3>
                <StatusPill status={bundle.shirt.status} />
              </div>
              <p className="text-xs text-[var(--pr-grey)] mb-0">
                v{bundle.latestVersion?.versionNumber ?? "—"} ·{" "}
                {bundle.shirt.approvedForPitchUse ? "Approved for pitch use" : "Not for public use"}
              </p>

              {cfg ? (
                <div className="shirt-lib__card-previews">
                  <RugbyShirtSvg {...cfg} number={10} size={96} />
                  <ShirtPitchPreview config={cfg} number={10} size={36} />
                  <ShirtPitchPreview config={cfg} number={1} size={36} variant="light" />
                </div>
              ) : null}

              {bundle.references[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bundle.references[0].imageUrl}
                  alt="Reference"
                  className="rounded border border-[var(--sl-border)] max-h-28 object-contain mb-2"
                />
              ) : (
                <p className="text-xs text-[var(--pr-grey)]">No reference image</p>
              )}

              <p className="text-xs text-[var(--pr-grey)] mb-2">
                Updated {new Date(bundle.shirt.updatedAt).toLocaleString()}
                {bundle.shirt.approvedBy
                  ? ` · Approved by ${bundle.shirt.approvedBy}`
                  : ""}
              </p>

              {bundle.shirt.status === "CHANGES_REQUIRED" && bundle.reviews[0]?.reviewNotes ? (
                <p className="text-sm text-amber-300">
                  Changes required: {bundle.reviews[0].reviewNotes}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  onClick={() => openEdit(bundle)}
                >
                  Edit
                </button>
                {bundle.shirt.status === "DRAFT" ||
                bundle.shirt.status === "CHANGES_REQUIRED" ? (
                  <button
                    type="button"
                    className="cms-btn cms-btn--secondary"
                    disabled={pending}
                    onClick={() => runAction(bundle.shirt.id, "submit")}
                  >
                    Submit for review
                  </button>
                ) : null}
                {bundle.shirt.status === "AWAITING_REVIEW" ||
                bundle.shirt.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="cms-btn cms-btn--primary"
                    disabled={pending}
                    onClick={() => runAction(bundle.shirt.id, "approve")}
                  >
                    Approve Shirt
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={pending}
                  onClick={() => runAction(bundle.shirt.id, "request-changes")}
                >
                  Request changes
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={pending}
                  onClick={() => runAction(bundle.shirt.id, "reject")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={pending}
                  onClick={() => runAction(bundle.shirt.id, "archive")}
                >
                  Archive
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <section className="cms-card">
        <label className="block text-sm">
          Review notes (required for request changes / reject)
          <textarea
            className="cms-input mt-1 w-full"
            rows={2}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="e.g. Collar should be gold; number contrast too low on pitch"
          />
        </label>
      </section>

      {editingKit ? (
        <section className="cms-card">
          <h3 className="mt-0">Edit {editingKit} shirt</h3>
          <div className="shirt-lib__editor-grid">
            <div>
              <RugbyShirtSvg {...previewConfig} number={10} size={160} />
              <div className="flex gap-2 mt-3">
                <ShirtPitchPreview config={previewConfig} number={7} />
                <ShirtPitchPreview config={previewConfig} number={15} variant="light" />
              </div>
              {!contrast.ok && contrast.warning ? (
                <p className="text-sm text-amber-300 mt-2">{contrast.warning}</p>
              ) : (
                <p className="text-xs text-[var(--pr-grey)] mt-2">
                  Number contrast OK ({contrast.ratio}:1)
                </p>
              )}
            </div>
            <div>
              {(
                [
                  ["bodyColour", "Body"],
                  ["secondaryColour", "Secondary"],
                  ["sleeveColour", "Sleeve"],
                  ["collarColour", "Collar"],
                  ["cuffColour", "Cuff"],
                  ["sidePanelColour", "Side panel"],
                  ["patternColour", "Pattern"],
                  ["numberColour", "Number"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="shirt-lib__colour-row text-sm">
                  <span>
                    {label}
                    <input
                      className="cms-input mt-1 w-full font-mono text-xs"
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder="#RRGGBB"
                    />
                  </span>
                  <input
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(form[key] || "")
                        ? form[key]!
                        : key === "bodyColour"
                          ? "#222222"
                          : "#ffffff"
                    }
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}

              <label className="block text-sm mb-2">
                Pattern
                <select
                  className="cms-input mt-1 w-full"
                  value={form.patternType}
                  onChange={(e) => setForm((f) => ({ ...f, patternType: e.target.value }))}
                >
                  {SHIRT_PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm mb-2">
                Reference image URL (internal review only)
                <input
                  className="cms-input mt-1 w-full"
                  value={form.referenceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, referenceUrl: e.target.value }))}
                  placeholder="https://…"
                />
              </label>

              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={form.crestEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, crestEnabled: e.target.checked }))}
                />
                Crest area enabled
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--primary"
                  disabled={pending}
                  onClick={saveDraft}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  onClick={() => setEditingKit(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
