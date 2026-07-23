import {
  matchProviderLabel,
  matchProviderPillClass,
} from "@/lib/match-cms-list-utils";

/** Compact source pill — existing cms-status styles only. */
export function SourceProviderPill({
  provider,
  title,
}: {
  provider: string;
  title?: string;
}) {
  return (
    <span
      className={`match-cms-provider-pill ${matchProviderPillClass(provider)}`}
      title={title ?? matchProviderLabel(provider)}
    >
      {matchProviderLabel(provider)}
    </span>
  );
}
