"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/crest-library.css";

type Colour = { name: string; hex: string };

type FormState = {
  title: string;
  description: string;
  aboutCrest: string;
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
  coloursText: string;
  officialImageUrl: string;
  replicaImageUrl: string;
  sourceUrl: string;
  sourceName: string;
  notes: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  aboutCrest: "",
  primaryColour: "#111111",
  secondaryColour: "#FFFFFF",
  accentColour: "",
  coloursText: "",
  officialImageUrl: "",
  replicaImageUrl: "",
  sourceUrl: "",
  sourceName: "",
  notes: "",
};

function parseColours(text: string): Colour[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, hex] = line.split("|").map((p) => p.trim());
      if (!name || !hex) return null;
      return { name, hex };
    })
    .filter((c): c is Colour => Boolean(c));
}

function coloursToText(colours: Colour[]): string {
  return colours.map((c) => `${c.name}|${c.hex}`).join("\n");
}

export function CrestLibraryTeamClient({
  competitionId,
  seasonId,
  teamId,
  teamName,
  initialCrestId,
}: {
  competitionId: string;
  seasonId: string;
  teamId: string;
  teamName: string;
  initialCrestId?: string;
}) {
  const router = useRouter();
  const [crestId, setCrestId] = useState(initialCrestId ?? "");
  const [status, setStatus] = useState("NOT_STARTED");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [shirtsLinked, setShirtsLinked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadCrest(id: string) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/crest-library/crests/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load crest");
        return;
      }
      setCrestId(id);
      setStatus(json.crest?.status ?? "DRAFT");
      const v = json.displayVersion ?? json.latestVersion;
      setVersionId(v?.id ?? null);
      setForm({
        title: v?.title ?? "",
        description: v?.description ?? "",
        aboutCrest: v?.aboutCrest ?? "",
        primaryColour: v?.primaryColour ?? "#111111",
        secondaryColour: v?.secondaryColour ?? "#FFFFFF",
        accentColour: v?.accentColour ?? "",
        coloursText: coloursToText(
          Array.isArray(v?.colours)
            ? v.colours.filter(
                (c: Colour) => c && typeof c.name === "string" && typeof c.hex === "string",
              )
            : [],
        ),
        officialImageUrl: v?.officialImageUrl ?? "",
        replicaImageUrl: v?.replicaImageUrl ?? "",
        sourceUrl: v?.sourceUrl ?? "",
        sourceName: v?.sourceName ?? "",
        notes: v?.notes ?? "",
      });

      const statusRes = await fetch(
        `/api/admin/crest-library/competition-status?competitionId=${competitionId}&seasonId=${seasonId}`,
      );
      const statusJson = await statusRes.json();
      if (statusRes.ok) {
        const row = (statusJson.teams ?? []).find(
          (r: { team: { id: string } }) => r.team.id === teamId,
        );
        setShirtsLinked(row?.shirtsLinked ?? 0);
      }
    });
  }

  useEffect(() => {
    if (initialCrestId) {
      loadCrest(initialCrestId);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/crest-library/teams/${teamId}/crests`);
      const json = await res.json();
      if (res.ok && json.crests?.[0]?.crest?.id) {
        loadCrest(json.crests[0].crest.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCrestId, teamId]);

  function versionPayload() {
    return {
      title: form.title || null,
      description: form.description || null,
      aboutCrest: form.aboutCrest || null,
      primaryColour: form.primaryColour || null,
      secondaryColour: form.secondaryColour || null,
      accentColour: form.accentColour || null,
      colours: parseColours(form.coloursText),
      officialImageUrl: form.officialImageUrl || null,
      replicaImageUrl: form.replicaImageUrl || null,
      sourceUrl: form.sourceUrl || null,
      sourceName: form.sourceName || null,
      notes: form.notes || null,
    };
  }

  function createDraft() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch("/api/admin/crest-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          competitionId,
          seasonId,
          name: `${teamName} Crest`,
          version: versionPayload(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create crest");
        return;
      }
      setMessage("Crest draft created and shirts can be linked on approve.");
      loadCrest(json.crest.id);
      router.refresh();
    });
  }

  function saveDraft() {
    if (!crestId || !versionId) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch(`/api/admin/crest-library/crests/${crestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: status === "APPROVED" ? "new-version" : "update-draft",
          versionId,
          version: versionPayload(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save");
        return;
      }
      setMessage(status === "APPROVED" ? "New draft version created" : "Draft saved");
      loadCrest(crestId);
    });
  }

  function runAction(path: string, body?: Record<string, string>) {
    if (!crestId) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch(`/api/admin/crest-library/crests/${crestId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed to ${path}`);
        return;
      }
      if (path === "approve") {
        setMessage(
          `Approved. Team image synced. ${json.shirtsLinked ?? 0} shirts linked to this crest.`,
        );
      } else {
        setMessage(`Crest ${path.replace("-", " ")} ok`);
      }
      loadCrest(crestId);
      router.refresh();
    });
  }

  return (
    <div className="crest-lib">
      <p className="crest-lib__meta">
        <Link href={`/admin/crest-library`}>← Crest Library</Link>
        {" · "}
        <Link href={`/admin/shirt-library/${competitionId}/${seasonId}/${teamId}`}>
          Open Shirt Library for {teamName}
        </Link>
        {shirtsLinked > 0 ? ` · ${shirtsLinked} shirts linked` : null}
      </p>

      <h2 style={{ margin: "0.75rem 0" }}>{teamName}</h2>
      <p className="crest-lib__meta">
        Status: <strong>{status}</strong>
      </p>

      {error ? <p className="cms-error">{error}</p> : null}
      {message ? <p className="cms-success">{message}</p> : null}

      <div className="crest-lib__preview-row" style={{ margin: "1rem 0" }}>
        <div className="crest-lib__preview">
          <span className="crest-lib__preview-label">Official crest</span>
          {form.officialImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.officialImageUrl} alt="Official crest" />
          ) : (
            <span className="crest-lib__meta">No official image</span>
          )}
        </div>
        <div className="crest-lib__preview">
          <span className="crest-lib__preview-label">Replica crest</span>
          {form.replicaImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.replicaImageUrl} alt="Replica crest" />
          ) : (
            <span className="crest-lib__meta">No replica image</span>
          )}
        </div>
      </div>

      <div className="crest-lib__form">
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label>
          About the crest
          <textarea
            value={form.aboutCrest}
            onChange={(e) => setForm((f) => ({ ...f, aboutCrest: e.target.value }))}
          />
        </label>
        <label>
          Official crest image URL
          <input
            value={form.officialImageUrl}
            onChange={(e) => setForm((f) => ({ ...f, officialImageUrl: e.target.value }))}
            placeholder="https://… or /crest-references/…"
          />
        </label>
        <label>
          Replica crest image URL
          <input
            value={form.replicaImageUrl}
            onChange={(e) => setForm((f) => ({ ...f, replicaImageUrl: e.target.value }))}
            placeholder="Optional replica / simplified mark"
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <label>
            Primary
            <input
              type="color"
              value={form.primaryColour || "#111111"}
              onChange={(e) => setForm((f) => ({ ...f, primaryColour: e.target.value }))}
            />
          </label>
          <label>
            Secondary
            <input
              type="color"
              value={form.secondaryColour || "#ffffff"}
              onChange={(e) => setForm((f) => ({ ...f, secondaryColour: e.target.value }))}
            />
          </label>
          <label>
            Accent
            <input
              type="color"
              value={form.accentColour || "#888888"}
              onChange={(e) => setForm((f) => ({ ...f, accentColour: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Colour swatches (one per line: Name|#HEX)
          <textarea
            value={form.coloursText}
            onChange={(e) => setForm((f) => ({ ...f, coloursText: e.target.value }))}
            placeholder={"Red|#C8102E\nBlack|#111111"}
          />
        </label>
        <label>
          Source name
          <input
            value={form.sourceName}
            onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))}
          />
        </label>
        <label>
          Source URL
          <input
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          />
        </label>
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
      </div>

      <div className="crest-lib__actions" style={{ marginTop: "1rem" }}>
        {!crestId ? (
          <button type="button" className="cms-btn cms-btn--primary" disabled={pending} onClick={createDraft}>
            Create crest draft
          </button>
        ) : (
          <>
            <button type="button" className="cms-btn" disabled={pending} onClick={saveDraft}>
              Save draft
            </button>
            <button
              type="button"
              className="cms-btn"
              disabled={pending}
              onClick={() => runAction("submit")}
            >
              Submit for review
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={pending}
              onClick={() => runAction("approve")}
            >
              Approve & link shirts
            </button>
            <button
              type="button"
              className="cms-btn"
              disabled={pending}
              onClick={() => {
                const notes = window.prompt("Changes required — note:") ?? "";
                if (notes.trim()) runAction("request-changes", { notes });
              }}
            >
              Request changes
            </button>
            <button
              type="button"
              className="cms-btn"
              disabled={pending}
              onClick={() => {
                const notes = window.prompt("Reject reason:") ?? "";
                if (notes.trim()) runAction("reject", { notes });
              }}
            >
              Reject
            </button>
            <button
              type="button"
              className="cms-btn"
              disabled={pending}
              onClick={() => runAction("archive")}
            >
              Archive
            </button>
          </>
        )}
      </div>
    </div>
  );
}
