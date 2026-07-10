import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  TABLE_LAB_COLUMN_GLOSSARY,
  TABLE_LAB_GUIDE_SECTIONS,
} from "@/lib/table-lab/table-lab-guide";

export const metadata = {
  title: "Table Lab guide · Rugby365 CMS",
};

export default function TableLabGuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Table Lab"
        title="Guide"
        description="How Table Lab works, what the columns mean, and how to prepare data."
        actions={
          <>
            <Link href="/admin/tables/index" className="cms-btn cms-btn--secondary">
              Table index
            </Link>
            <Link href="/admin/tables/view" className="cms-btn cms-btn--primary">
              View tables
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {TABLE_LAB_GUIDE_SECTIONS.map((section) => (
          <section key={section.id} className="cms-card">
            <h2 className="text-base font-semibold m-0 mb-3">{section.title}</h2>
            <div className="space-y-2 text-sm text-zinc-300">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="m-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="cms-card mt-4 overflow-x-auto">
        <h2 className="text-base font-semibold m-0 mb-3">Column glossary</h2>
        <p className="text-sm text-zinc-500 m-0 mb-4">
          TF, TA, TBP and LBP are shown in the table UI and exports only when try data or competition
          bonus rules are available for the selected scope.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
              <th className="py-2 pr-3 w-16">Code</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_LAB_COLUMN_GLOSSARY.map((row) => (
              <tr key={row.code} className="border-b border-zinc-800/60">
                <td className="py-2 pr-3 font-mono text-zinc-300">{row.code}</td>
                <td className="py-2 pr-3 text-zinc-100">{row.name}</td>
                <td className="py-2 pr-3 text-zinc-400">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
