import { Suspense } from "react";
import { TransfersPublicClient } from "@/components/transfers/TransfersPublicClient";

export default function TransfersPage() {
  return (
    <Suspense fallback={<p className="pr-mc-transfers-muted p-6">Loading transfers…</p>}>
      <TransfersPublicClient />
    </Suspense>
  );
}
