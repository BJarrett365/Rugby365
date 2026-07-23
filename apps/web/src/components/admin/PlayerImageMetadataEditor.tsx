/**
 * Lightweight CMS metadata editor for player images.
 * Extends Planet Rugby discovery panel with alt/caption/credit/licence/focal/OG.
 */
"use client";

import { useState } from "react";
import { MEDIA_LICENCE_LABELS, MEDIA_LICENCES } from "@/lib/media-tokens";

type MetaFields = {
  altText: string;
  caption: string;
  credit: string;
  photographer: string;
  licence: string;
  focalX: string;
  focalY: string;
  isAiGenerated: boolean;
  setOgImage: boolean;
};

export function PlayerImageMetadataEditor({
  playerId,
  imageId,
  initial,
  onSaved,
}: {
  playerId: string;
  imageId: string;
  initial: {
    altText?: string | null;
    caption?: string | null;
    credit?: string | null;
    photographer?: string | null;
    licence?: string | null;
    focalX?: number | null;
    focalY?: number | null;
    isAiGenerated?: boolean | null;
  };
  onSaved: (images: unknown[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<MetaFields>({
    altText: initial.altText ?? "",
    caption: initial.caption ?? "",
    credit: initial.credit ?? "",
    photographer: initial.photographer ?? "",
    licence: initial.licence ?? "planet_rugby",
    focalX: initial.focalX != null ? String(initial.focalX) : "50",
    focalY: initial.focalY != null ? String(initial.focalY) : "28",
    isAiGenerated: Boolean(initial.isAiGenerated),
    setOgImage: false,
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_metadata",
          imageId,
          metadata: {
            altText: fields.altText,
            caption: fields.caption,
            credit: fields.credit,
            photographer: fields.photographer,
            licence: fields.licence,
            focalX: fields.focalX === "" ? null : Number(fields.focalX),
            focalY: fields.focalY === "" ? null : Number(fields.focalY),
            isAiGenerated: fields.isAiGenerated,
            setOgImage: fields.setOgImage,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data.images ?? []);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="cms-btn cms-btn--secondary text-xs px-2 py-1"
        onClick={() => setOpen(true)}
      >
        Edit metadata
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-white/10 p-2 bg-black/30">
      <label className="block text-xs text-zinc-400">
        Alt text
        <input
          className="mt-1 w-full"
          value={fields.altText}
          onChange={(e) => setFields((f) => ({ ...f, altText: e.target.value }))}
        />
      </label>
      <label className="block text-xs text-zinc-400">
        Caption
        <input
          className="mt-1 w-full"
          value={fields.caption}
          onChange={(e) => setFields((f) => ({ ...f, caption: e.target.value }))}
        />
      </label>
      <label className="block text-xs text-zinc-400">
        Credit
        <input
          className="mt-1 w-full"
          value={fields.credit}
          onChange={(e) => setFields((f) => ({ ...f, credit: e.target.value }))}
        />
      </label>
      <label className="block text-xs text-zinc-400">
        Photographer
        <input
          className="mt-1 w-full"
          value={fields.photographer}
          onChange={(e) => setFields((f) => ({ ...f, photographer: e.target.value }))}
        />
      </label>
      <label className="block text-xs text-zinc-400">
        Licence
        <select
          className="mt-1 w-full"
          value={fields.licence}
          onChange={(e) => setFields((f) => ({ ...f, licence: e.target.value }))}
        >
          {MEDIA_LICENCES.map((licence) => (
            <option key={licence} value={licence}>
              {MEDIA_LICENCE_LABELS[licence]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-zinc-400">
          Focal X %
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full"
            value={fields.focalX}
            onChange={(e) => setFields((f) => ({ ...f, focalX: e.target.value }))}
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Focal Y %
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full"
            value={fields.focalY}
            onChange={(e) => setFields((f) => ({ ...f, focalY: e.target.value }))}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={fields.isAiGenerated}
          onChange={(e) => setFields((f) => ({ ...f, isAiGenerated: e.target.checked }))}
        />
        AI generated
      </label>
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={fields.setOgImage}
          onChange={(e) => setFields((f) => ({ ...f, setOgImage: e.target.checked }))}
        />
        Use as Open Graph / Discover image
      </label>
      {error ? <p className="text-xs text-red-400 m-0">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="cms-btn cms-btn--primary text-xs px-2 py-1"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save metadata"}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--secondary text-xs px-2 py-1"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
