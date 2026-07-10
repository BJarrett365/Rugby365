import { AdminHubPage } from "@/components/admin/AdminHubPage";
import type { AdminHubLink } from "@/lib/admin-nav";

export const metadata = {
  title: "Table Lab · Rugby365 CMS",
};

const TABLE_LAB_LINKS: AdminHubLink[] = [
  {
    title: "View tables",
    href: "/admin/tables/view",
    description: "Browse rugby-specific advanced tables with confidence and data coverage metadata.",
    status: "Live",
  },
  {
    title: "Table index",
    href: "/admin/tables/index",
    description: "Searchable index of all table types with links to open each one in View tables.",
    status: "Live",
  },
  {
    title: "Guide",
    href: "/admin/tables/guide",
    description: "Column glossary (TF, TA, TBP, LBP), confidence levels, filters and data preparation.",
    status: "Live",
  },
  {
    title: "Build table",
    href: "/admin/tables/build",
    description: "Generate a table for a season, date range or custom match period.",
    status: "Live",
  },
  {
    title: "Edit table config",
    href: "/admin/tables/edit",
    description: "Review table definitions, required data sources and rugby wording.",
    status: "Admin",
  },
  {
    title: "Seasons",
    href: "/admin/tables/seasons",
    description: "Choose competition seasons used as the scope for Table Lab calculations.",
    status: "Live",
  },
];

export default function TablesAdminPage() {
  return (
    <AdminHubPage
      eyebrow="Content"
      title="Table Lab"
      description="Rugby Union-specific advanced tables built from fixtures, match scores, events and SDMS team stats. No fake data — tables show coverage and confidence when inputs are missing."
      links={TABLE_LAB_LINKS}
    />
  );
}
