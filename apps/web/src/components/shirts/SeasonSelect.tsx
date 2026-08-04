"use client";

import { useRouter } from "next/navigation";

export function SeasonSelect({
  competitionSlug,
  currentSeasonSlug,
  seasons,
}: {
  competitionSlug: string;
  currentSeasonSlug: string;
  seasons: Array<{ slug: string; label: string }>;
}) {
  const router = useRouter();
  if (seasons.length === 0) return null;
  return (
    <label className="block">
      <span className="sr-only">Season</span>
      <select
        className="slp__season-select"
        value={currentSeasonSlug}
        onChange={(e) => {
          router.push(`/shirt-library/${competitionSlug}/${e.target.value}`);
        }}
      >
        {seasons.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
