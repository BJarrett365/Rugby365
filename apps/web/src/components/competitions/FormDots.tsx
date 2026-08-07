"use client";

import { padFormForDisplay, parseStandingForm } from "@/lib/standing-form";
import type { FormResult } from "@/lib/table-lab/table-types";

/**
 * Renders form as W/D/L dots (oldest → newest).
 * By default shows only real results (no · padding). Pass `slots` + `pad` to force a fixed width.
 */
export function FormDots({
  form,
  sequence,
  slots,
  pad = false,
}: {
  form?: string | null;
  /** Newest-first W/D/L sequence (Table Lab / live form convention). */
  sequence?: FormResult[] | null;
  /** Max results to keep (pool stage: 3 or 4; leagues: 5). */
  slots?: number;
  /** When true, left-pad shorter sequences with · up to `slots`. */
  pad?: boolean;
}) {
  const fromSequence =
    sequence && sequence.length
      ? [...sequence].reverse().join("")
      : null;
  const letters = parseStandingForm(fromSequence ?? form).lastFive ?? "";
  const max = slots != null && slots > 0 ? slots : undefined;
  const clipped = max != null ? letters.slice(-max) : letters;
  const display =
    pad && max != null
      ? padFormForDisplay(clipped, max)
      : clipped;

  if (!display) {
    return <span className="text-zinc-600">—</span>;
  }

  return (
    <span className="inline-flex gap-0.5">
      {display.split("").map((c, i) => (
        <span
          key={`${c}-${i}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            c === "W"
              ? "bg-emerald-600 text-white"
              : c === "L"
                ? "bg-red-600 text-white"
                : c === "D"
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-800 text-zinc-500"
          }`}
          title={c === "W" ? "Win" : c === "L" ? "Loss" : c === "D" ? "Draw" : "No result"}
        >
          {c === "-" ? "·" : c}
        </span>
      ))}
    </span>
  );
}
