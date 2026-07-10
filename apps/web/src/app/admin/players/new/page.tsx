"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

export default function NewPlayerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    name: "",
    positionName: "",
    clubName: "",
    countryName: "",
    externalProviderId: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/players/${data.player.id}/edit`);
    else setError(data.error ?? "Failed to create player");
    setLoading(false);
  }

  return (
    <>
      <PageHeader eyebrow="CMS" title="New player" />
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
          <span className="text-sm text-zinc-400">Position (e.g. fly-half)</span>
          <input
            className="cms-input w-full mt-1"
            value={values.positionName}
            onChange={(e) => setValues((v) => ({ ...v, positionName: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Club (e.g. Ospreys)</span>
          <input
            className="cms-input w-full mt-1"
            value={values.clubName}
            onChange={(e) => setValues((v) => ({ ...v, clubName: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Country / international team</span>
          <input
            className="cms-input w-full mt-1"
            value={values.countryName}
            onChange={(e) => setValues((v) => ({ ...v, countryName: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Sport365 player ID</span>
          <input
            className="cms-input w-full mt-1"
            value={values.externalProviderId}
            onChange={(e) => setValues((v) => ({ ...v, externalProviderId: e.target.value }))}
          />
        </label>
        <p className="text-sm text-zinc-500 m-0">
          Wikipedia archive data (bio, career tables) is fetched automatically after create when a
          matching article is found.
        </p>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="cms-btn cms-btn--primary">
            {loading ? "Creating & checking Wikipedia…" : "Create player"}
          </button>
          <Link href="/admin/players" className="cms-btn cms-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
