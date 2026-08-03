"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type { KnowledgePageMeta } from "@/lib/knowledge-catalog";

const GROUP_LABEL: Record<string, string> = {
  core: "Core",
  rules: "Rules",
  ops: "Operations",
  rd: "Research & Development",
  changelog: "Changelog",
};

export default function KnowledgeIndexPage() {
  const [pages, setPages] = useState<KnowledgePageMeta[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/knowledge")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPages(data.pages ?? []);
      })
      .catch(() => setError("Failed to load knowledge base"));
  }, []);

  const groups = ["core", "rules", "ops", "rd", "changelog"] as const;

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="Knowledge Base"
        description="Permanent Rugby365 documentation — Rule Book, standards and change history."
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="space-y-6">
        {groups.map((group) => {
          const rows = pages.filter((p) => p.group === group);
          if (!rows.length) return null;
          return (
            <section key={group} className="cms-card">
              <h2 className="cms-section-title m-0 mb-3">{GROUP_LABEL[group]}</h2>
              <ul className="m-0 p-0 list-none space-y-2">
                {rows.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/admin/knowledge/${p.slug}`} className="text-[var(--pr-gold)] hover:underline">
                      {p.title}
                    </Link>
                    <p className="text-sm text-[var(--pr-grey)] m-0 mt-0.5">{p.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
