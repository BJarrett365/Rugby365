/**
 * Rugby365 Knowledge Base catalog — markdown under docs/knowledge/.
 * Permanent CMS documentation source of truth.
 */

export type KnowledgePageMeta = {
  slug: string;
  title: string;
  description: string;
  /** Relative to docs/knowledge/ */
  file: string;
  group: "core" | "rules" | "ops" | "changelog";
};

export const KNOWLEDGE_PAGES: KnowledgePageMeta[] = [
  {
    slug: "rule-book",
    title: "Rugby365 Rule Book",
    description: "Permanent standards for seasons, fixtures, loading, imports and mapping.",
    file: "rule-book.md",
    group: "core",
  },
  {
    slug: "user-guide",
    title: "User Guide",
    description: "How to operate Matches CMS, imports and common admin workflows.",
    file: "user-guide.md",
    group: "core",
  },
  {
    slug: "architecture",
    title: "Architecture",
    description: "System layout: CMS, providers, mapping layer and data integration.",
    file: "architecture.md",
    group: "core",
  },
  {
    slug: "data-providers",
    title: "Data Providers",
    description: "Rugby Data API (P1), Planet Rugby, Sport365, Wikipedia, LiveSport and others.",
    file: "data-providers.md",
    group: "core",
  },
  {
    slug: "competition-rules",
    title: "Competition Rules",
    description: "Competition types, scoring and catalogue conventions.",
    file: "competition-rules.md",
    group: "rules",
  },
  {
    slug: "season-rules",
    title: "Season Rules",
    description: "Club cross-year, international calendar-year and tournament seasons.",
    file: "season-rules.md",
    group: "rules",
  },
  {
    slug: "fixture-rules",
    title: "Fixture Rules",
    description: "Required fields, SEASON_UNMAPPED and approval gates.",
    file: "fixture-rules.md",
    group: "rules",
  },
  {
    slug: "import-rules",
    title: "Import Rules",
    description: "Import gates, overwrite policy and provider fill rules.",
    file: "import-rules.md",
    group: "rules",
  },
  {
    slug: "mapping-rules",
    title: "Mapping Rules",
    description: "Provider entity mappings, confidence and review workflow.",
    file: "mapping-rules.md",
    group: "rules",
  },
  {
    slug: "ui-design-system",
    title: "UI Design System",
    description: "Planet Rugby / Rugby365 CMS tokens, components and density rules.",
    file: "ui-design-system.md",
    group: "ops",
  },
  {
    slug: "image-system",
    title: "Image System",
    description: "Media components, CMS metadata, rights, performance and SEO for all image types.",
    file: "image-system.md",
    group: "ops",
  },
  {
    slug: "ai-development-rules",
    title: "AI Development Rules",
    description: "Rules for agents and AI features working on Rugby365.",
    file: "ai-development-rules.md",
    group: "ops",
  },
  {
    slug: "public-match-centre",
    title: "Public Match Centre",
    description: "Approved plan: Rugby365 as SoT, Planet Rugby presentation, modules and phases.",
    file: "public-match-centre.md",
    group: "ops",
  },
  {
    slug: "public-player-profile",
    title: "Public Player Profile",
    description: "Public /players/[slug] foundation, SEO, CMS publish controls and data rules.",
    file: "public-player-profile.md",
    group: "ops",
  },
  {
    slug: "player-value",
    title: "Ratings & Market Value",
    description:
      "How Match Ratings, Player (Career) Ratings and Market Values are calculated.",
    file: "player-value.md",
    group: "ops",
  },
  {
    slug: "player-image-enrichment",
    title: "Planet Rugby Player Image Enrichment",
    description: "Search, confidence scoring and CMS workflow for Planet Rugby–owned player images.",
    file: "player-image-enrichment.md",
    group: "ops",
  },
  {
    slug: "release-notes",
    title: "Release Notes",
    description: "Notable product releases and capability drops.",
    file: "release-notes.md",
    group: "changelog",
  },
  {
    slug: "change-log",
    title: "Change Log",
    description: "Chronological record of CMS and data-platform changes.",
    file: "change-log.md",
    group: "changelog",
  },
];

export function getKnowledgePage(slug: string): KnowledgePageMeta | undefined {
  return KNOWLEDGE_PAGES.find((p) => p.slug === slug);
}

export const KNOWLEDGE_NAV_ITEMS = KNOWLEDGE_PAGES.map((p) => ({
  href: `/admin/knowledge/${p.slug}`,
  label: p.title,
  short: p.title.split(/\s+/)[0]!.slice(0, 6),
}));
