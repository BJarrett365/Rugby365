"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import type { MatchAnimationPublicPayload } from "@/lib/match-animation-types";

const MatchAnimationPanel = dynamic(
  () =>
    import("./MatchAnimationPanel").then((m) => m.MatchAnimationPanel),
  {
    ssr: false,
    loading: () => (
      <div className="pr-ma-loading" role="status">
        Loading Match Animation…
      </div>
    ),
  },
);

/** Lazy-loads the animation engine only when the Match Animation tab is mounted. */
export function MatchAnimationSection({ payload }: { payload: MatchAnimationPublicPayload }) {
  const pathname = usePathname();
  return (
    <Suspense
      fallback={
        <div className="pr-ma-loading" role="status">
          Loading Match Animation…
        </div>
      }
    >
      <MatchAnimationPanel payload={payload} detailsHref={pathname} />
    </Suspense>
  );
}
