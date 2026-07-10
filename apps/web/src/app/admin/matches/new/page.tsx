import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { MatchForm } from "@/components/admin/MatchForm";

export default function NewMatchPage() {
  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="New match"
        description="Create a fixture with teams, kickoff date and optional Sport365 or Planet Rugby URLs."
      />
      <MatchForm submitLabel="Create match" />
      <p className="text-sm text-zinc-600 mt-4">
        <Link href="/admin/matches" className="text-zinc-400 hover:text-zinc-200">
          ← Back to matches
        </Link>
      </p>
    </>
  );
}
