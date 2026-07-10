import { Suspense } from "react";
import OperatorConsole from "./OperatorConsole";

export default function OperatorPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500 text-sm">Loading operator console…</p>}>
      <OperatorConsole />
    </Suspense>
  );
}
