"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";

export default function MatchCommentaryBridgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/matches/${id}`);
        const data = await res.json();
        if (!cancelled && res.ok && data.fixture?.slug) {
          setSlug(String(data.fixture.slug));
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Live Commentary"
      description="Open the public commentary page or operator console for live updates."
    >
      <div className="cms-card text-sm text-zinc-400 space-y-3">
        <p className="m-0">
          Commentary is published on the public match page and driven from the operator console.
          Use Events / Comment for timeline edits in CMS.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/operator" className="cms-btn cms-btn--primary">
            Operator console
          </Link>
          <Link href={`/admin/matches/${id}/events`} className="cms-btn cms-btn--secondary">
            Match events / comments
          </Link>
          {slug ? (
            <Link
              href={`/matches/${slug}/commentary`}
              className="cms-btn cms-btn--secondary"
              target="_blank"
              rel="noreferrer"
            >
              Public commentary
            </Link>
          ) : null}
        </div>
      </div>
    </MatchCmsFeatureShell>
  );
}
