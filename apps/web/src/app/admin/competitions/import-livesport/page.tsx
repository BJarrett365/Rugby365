import { Suspense } from "react";
import { ImportLiveSportClient } from "./ImportLiveSportClient";

export default function ImportLiveSportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500 p-4">Loading LiveSport import…</p>}>
      <ImportLiveSportClient />
    </Suspense>
  );
}
