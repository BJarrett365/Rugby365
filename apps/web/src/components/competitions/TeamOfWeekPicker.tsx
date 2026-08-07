"use client";

import { useRouter } from "next/navigation";
import {
  defaultRoundForSeason,
  sortTotwRounds,
  type TotwPickerSeason,
} from "@/lib/team-of-week-picker";

export type { TotwPickerRound, TotwPickerSeason } from "@/lib/team-of-week-picker";

export function TeamOfWeekPicker({
  slug,
  seasons,
  selectedYear,
  selectedRoundKey,
}: {
  slug: string;
  seasons: TotwPickerSeason[];
  selectedYear: number;
  selectedRoundKey: string;
}) {
  const router = useRouter();
  const season =
    seasons.find((s) => s.year === selectedYear) ?? seasons[0] ?? null;
  const rounds = season ? sortTotwRounds(season.rounds) : [];

  if (!seasons.length || !season) return null;

  function hrefFor(year: number, roundKey: string) {
    return `/competitions/${slug}/team-of-the-week/${year}/${roundKey}`;
  }

  return (
    <div className="totw-picker">
      <label className="totw-picker__field">
        <span className="totw-picker__label">Season</span>
        <select
          className="totw-picker__select"
          value={String(season.year)}
          onChange={(e) => {
            const year = Number(e.target.value);
            const next = seasons.find((s) => s.year === year);
            const round = defaultRoundForSeason(next);
            if (!next || !round) return;
            router.push(hrefFor(next.year, round.roundKey));
          }}
        >
          {seasons.map((s) => (
            <option key={s.year} value={String(s.year)}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="totw-picker__field">
        <span className="totw-picker__label">Round</span>
        <select
          className="totw-picker__select"
          value={selectedRoundKey}
          onChange={(e) => {
            router.push(hrefFor(season.year, e.target.value));
          }}
        >
          {rounds.map((r) => (
            <option key={r.roundKey} value={r.roundKey}>
              {r.roundName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
