import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { RefereeIdentityHero } from "@/components/referees/RefereeIdentityHero";
import { RefereePublicSubNav } from "@/components/referees/RefereePublicSubNav";
import { PublicEntityPreviewBanner } from "@/components/entities/PublicEntityProfileBits";
import type { RefereeDashboardModel } from "@/lib/referee-dashboard-types";
import type { ReactNode } from "react";

export function RefereeProfileChrome({
  model,
  active,
  children,
  showHeroAside,
  preview = false,
}: {
  model: RefereeDashboardModel;
  active: string;
  children: ReactNode;
  showHeroAside?: ReactNode;
  preview?: boolean;
}) {
  return (
    <article className="pr-player-v2">
      <PublicEntityPreviewBanner preview={preview} />
      <PlayerPublicBreadcrumb
        items={[
          { label: "Referees" },
          { label: model.name, href: `/referees/${model.slug}` },
          ...(active !== "overview" ? [{ label: active[0]!.toUpperCase() + active.slice(1) }] : []),
        ]}
      />
      <RefereePublicSubNav slug={model.slug} active={active} />
      {showHeroAside ? (
        <div className="pr-player-v2__hero-lead">
          <RefereeIdentityHero model={model} />
          {showHeroAside}
        </div>
      ) : (
        <div className="pr-player-v2__hero-lead">
          <RefereeIdentityHero model={model} />
        </div>
      )}
      {children}
    </article>
  );
}
