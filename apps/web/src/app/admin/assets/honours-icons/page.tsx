"use client";

import { HonourAwardIcon, HonourMedal, HonourTrophyIcon } from "@/components/honours/HonourIcons";
import { PageHeader } from "@/components/shell/PageHeader";

const MEDALS = ["gold", "silver", "bronze"] as const;

export default function HonoursIconsAdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Assets"
        title="Honours icon library"
        description="Reusable Rugby365 medal, trophy, and award marks. Do not upload per-profile medal artwork."
      />

      <div className="cms-card space-y-6 mb-4">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 m-0 mb-3">
            Medals
          </h2>
          <div className="flex flex-wrap gap-6 items-end">
            {MEDALS.map((type) => (
              <div key={type} className="text-center space-y-2">
                <HonourMedal type={type} size={56} />
                <div className="text-xs text-zinc-400 uppercase">{type}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 m-0 mb-3">
            Personal awards
          </h2>
          <div className="flex flex-wrap gap-6 items-end">
            {(
              [
                ["coach", "award_coach"],
                ["world", "award_world"],
                ["player", "award_player"],
                ["generic", "award"],
              ] as const
            ).map(([variant, key]) => (
              <div key={key} className="text-center space-y-2">
                <HonourAwardIcon
                  size={44}
                  variant={variant === "generic" ? "generic" : variant}
                />
                <div className="text-xs text-zinc-400">{key}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 m-0 mb-3">
            Trophies
          </h2>
          <div className="flex flex-wrap gap-6 items-end">
            <div className="text-center space-y-2">
              <HonourTrophyIcon size={44} variant="major" />
              <div className="text-xs text-zinc-400">trophy_major</div>
            </div>
            <div className="text-center space-y-2">
              <HonourTrophyIcon size={44} variant="domestic" />
              <div className="text-xs text-zinc-400">trophy_domestic</div>
            </div>
          </div>
        </section>

        <p className="text-sm text-zinc-500 m-0">
          Competition logos and team crests continue to come from Competition / Team assets — not
          from this library.
        </p>
      </div>
    </>
  );
}
