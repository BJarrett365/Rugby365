"use client";

import Link from "next/link";
import { collectMatchWarnings } from "@/lib/match-cms-warnings";
import type { MatchCmsListRow } from "@/lib/match-cms-list-utils";
import { IconAlert } from "@/components/admin/MatchCmsIcons";

/** Issues badge — opens post-match Wiki/AI fix template. */
export function MatchCmsWarnings({ match }: { match: MatchCmsListRow }) {
  const warnings = collectMatchWarnings(match);
  if (warnings.length === 0) {
    return <span className="match-cms-warn--empty">—</span>;
  }

  const summary = warnings.map((w) => w.label).join(" · ");
  const firstHref = warnings[0]?.href(match.id) ?? `/admin/matches/${match.id}/edit`;

  return (
    <Link
      href={firstHref}
      className="match-cms-warn"
      title={`${summary} — open first issue`}
      aria-label={`${warnings.length} issues: ${summary}. Open first issue.`}
    >
      <IconAlert className="w-3.5 h-3.5" />
      <span className="match-cms-warn__count">{warnings.length}</span>
    </Link>
  );
}
