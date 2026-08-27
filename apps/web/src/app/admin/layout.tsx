import { Suspense } from "react";
import { AdminShell } from "@/components/shell/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="admin-shell__content min-h-screen bg-zinc-950 text-zinc-400 p-6">Loading…</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
