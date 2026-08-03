"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Deep link kept for bookmarks / nav — combined hub is at /admin/keys#elevenlabs */
export default function ElevenLabsKeysPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/keys#elevenlabs");
  }, [router]);
  return <p className="text-sm text-zinc-500">Redirecting to API keys hub…</p>;
}
