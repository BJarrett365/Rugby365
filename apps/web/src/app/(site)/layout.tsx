import { Suspense } from "react";
import { AdminShell } from "@/components/shell/AdminShell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="admin-shell__content">{children}</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
