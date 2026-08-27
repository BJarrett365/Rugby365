import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
          Loading…
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
