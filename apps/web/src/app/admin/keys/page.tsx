"use client";

import Link from "next/link";
import { AdminProviderKeysHub } from "@/components/admin/AdminProviderKeysHub";
import { PageHeader } from "@/components/shell/PageHeader";

export default function AdminKeysHubPage() {
  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="API keys"
        description="Supabase, ElevenLabs, OpenAI, Wikipedia and Wikidata in one place — masked secrets with admin reveal, connection tests, and env overrides. Wikipedia/Wikidata need a User-Agent, not a paid API key."
        actions={
          <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
            Admin dashboard
          </Link>
        }
      />
      <AdminProviderKeysHub />
    </>
  );
}
