"use client";

import type { PlayerPositionUsageResult } from "@/lib/player-position-usage-service";

type Props = {
  usage: PlayerPositionUsageResult | null | undefined;
  currentPrimary?: string | null;
  secondaryPositions?: string[] | null;
  publicSlug?: string | null;
};

function dash(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

/**
 * CMS POSITIONS panel — derived usage + coverage (read-only; does not overwrite primary).
 */
export function PlayerCmsPositionsPanel({
  usage,
  currentPrimary,
  secondaryPositions,
  publicSlug,
}: Props) {
  if (!usage) {
    return (
      <div className="cms-card space-y-2 border border-zinc-700">
        <h3 className="font-semibold m-0">POSITIONS</h3>
        <p className="text-sm text-zinc-500 m-0">No linked appearance usage yet.</p>
      </div>
    );
  }

  const derivedTop = usage.positions[0]?.positionName ?? null;
  const reviewNeeded =
    currentPrimary &&
    derivedTop &&
    currentPrimary.trim().toLowerCase() !== derivedTop.trim().toLowerCase() &&
    usage.mode !== "START_POSITION_ONLY";

  return (
    <div className="cms-card space-y-3 border border-zinc-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold m-0">POSITIONS</h3>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            Derived from linked matches ({usage.mode} · {usage.calculationMethod}). Does not
            overwrite the official primary position.
          </p>
        </div>
        {publicSlug ? (
          <a
            className="cms-btn cms-btn--secondary text-xs"
            href={`/players/${publicSlug}?preview=1`}
            target="_blank"
            rel="noreferrer"
          >
            Preview public card
          </a>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Current primary</div>
          <div className="font-medium text-zinc-100">{dash(currentPrimary)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Secondary (CMS)</div>
          <div className="font-medium text-zinc-100">
            {secondaryPositions?.length ? secondaryPositions.join(", ") : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Most-used (derived)</div>
          <div className="font-medium text-zinc-100">
            {derivedTop ? `${derivedTop} (${usage.positions[0]!.usagePercent}%)` : "—"}
          </div>
        </div>
      </div>

      {reviewNeeded ? (
        <p className="text-xs text-amber-400 m-0">
          POSITION REVIEW — registered primary differs from derived most-used position.
        </p>
      ) : null}

      <div>
        <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Derived position data</div>
        {usage.positions.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No field positions labelled yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1 pr-2">Position</th>
                  <th className="py-1 pr-2">Apps</th>
                  <th className="py-1 pr-2">Starts</th>
                  <th className="py-1 pr-2">Minutes</th>
                  <th className="py-1 pr-2">Usage</th>
                  <th className="py-1 pr-2">Rating</th>
                  <th className="py-1">Class</th>
                </tr>
              </thead>
              <tbody>
                {usage.positions.map((p) => (
                  <tr key={p.positionId} className="border-t border-zinc-800">
                    <td className="py-1.5 pr-2">{p.positionName}</td>
                    <td className="py-1.5 pr-2">{p.appearances}</td>
                    <td className="py-1.5 pr-2">{p.starts}</td>
                    <td className="py-1.5 pr-2">{p.minutes ?? "—"}</td>
                    <td className="py-1.5 pr-2">{p.usagePercent}%</td>
                    <td className="py-1.5 pr-2">
                      {p.positionRating ?? p.averageMatchRating ?? "—"}
                    </td>
                    <td className="py-1.5">{p.classification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Appearance role</div>
          <div className="flex gap-4">
            <div>
              <div className="text-lg font-semibold">{usage.appearanceRole.starts}</div>
              <div className="text-xs text-zinc-500">
                Starts · {Math.round(usage.appearanceRole.startsPct)}%
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold">{usage.appearanceRole.bench}</div>
              <div className="text-xs text-zinc-500">
                Bench · {Math.round(usage.appearanceRole.benchPct)}%
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Coverage</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 m-0 text-xs">
            <dt className="text-zinc-500">Verified career</dt>
            <dd className="m-0">{dash(usage.verifiedCareerApps)}</dd>
            <dt className="text-zinc-500">Linked apps</dt>
            <dd className="m-0">{usage.linkedApps}</dd>
            <dt className="text-zinc-500">Position known</dt>
            <dd className="m-0">{usage.positionKnownApps}</dd>
            <dt className="text-zinc-500">Minutes known</dt>
            <dd className="m-0">{usage.minutesKnownApps}</dd>
            <dt className="text-zinc-500">Career coverage</dt>
            <dd className="m-0">
              {usage.coverage.careerCoveragePct != null
                ? `${usage.coverage.careerCoveragePct}%`
                : "—"}
            </dd>
            <dt className="text-zinc-500">Club / Intl linked</dt>
            <dd className="m-0">
              {usage.coverage.clubLinked} / {usage.coverage.internationalLinked}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
