"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Team = { id: string; name: string };

export default function NewVenuePage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    name: "",
    city: "",
    countryName: "",
    capacity: "",
    teamId: "",
  });

  useEffect(() => {
    fetch("/api/admin/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        teamId: values.teamId || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/venues/${data.venue.id}/edit`);
    else setError(data.error ?? "Failed to create venue");
    setLoading(false);
  }

  return (
    <>
      <PageHeader eyebrow="CMS" title="New venue" />
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
          <span className="text-sm text-zinc-400">City</span>
          <input
            className="cms-input w-full mt-1"
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
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
        <label className="block">
          <span className="text-sm text-zinc-400">Capacity</span>
          <input
            type="number"
            className="cms-input w-full mt-1"
            value={values.capacity}
            onChange={(e) => setValues((v) => ({ ...v, capacity: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Home team</span>
          <select
            className="cms-select w-full mt-1"
            value={values.teamId}
            onChange={(e) => setValues((v) => ({ ...v, teamId: e.target.value }))}
          >
            <option value="">None</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="cms-btn cms-btn--primary">
            {loading ? "Saving…" : "Create venue"}
          </button>
          <Link href="/admin/venues" className="cms-btn cms-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
