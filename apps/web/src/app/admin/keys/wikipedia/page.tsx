"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Deep link kept for bookmarks / nav — combined hub is at /admin/keys#wikipedia */
export default function WikipediaKeysPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/keys#wikipedia");
  }, [router]);
  return <p className="text-sm text-zinc-500">Redirecting to API keys hub…</p>;
}
