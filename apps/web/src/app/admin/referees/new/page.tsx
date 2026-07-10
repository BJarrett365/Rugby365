"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

export default function NewRefereePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({ name: "", countryName: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/referees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/referees/${data.referee.id}/edit`);
    else setError(data.error ?? "Failed to create referee");
    setLoading(false);
  }

  return (
    <>
      <PageHeader eyebrow="CMS" title="New referee" />
      <form onSubmit={submit} className="cms-card space-y-4 max-w-lg">
        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        <label className="block">
          <span className="text-sm text-zinc-400">Name</span>
          <input
            className="cms-input w-full mt-1"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Country</span>
          <input
            className="cms-input w-full mt-1"
            value={values.countryName}
            onChange={(e) => setValues((v) => ({ ...v, countryName: e.target.value }))}
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="cms-btn cms-btn--primary">
            {loading ? "Saving…" : "Create referee"}
          </button>
          <Link href="/admin/referees" className="cms-btn cms-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
