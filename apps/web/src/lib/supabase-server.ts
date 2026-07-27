import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  resolveSupabaseAnonKey,
  resolveSupabaseProjectUrl,
  resolveSupabaseServiceRoleKey,
} from "./integration-settings-service";

export type SupabaseClientMode = "anon" | "service";

/**
 * Server-only Supabase client using CMS / env credentials from /admin/keys/supabase.
 * - `anon`: publishable key (RLS applies)
 * - `service`: service_role key (bypasses RLS — admin jobs only)
 */
export async function getSupabaseServerClient(
  mode: SupabaseClientMode = "anon",
): Promise<SupabaseClient> {
  const url = await resolveSupabaseProjectUrl();
  if (!url) {
    throw new Error("Supabase project URL is not configured. Set it at /admin/keys/supabase.");
  }

  const key =
    mode === "service" ? await resolveSupabaseServiceRoleKey() : await resolveSupabaseAnonKey();

  if (!key) {
    throw new Error(
      mode === "service"
        ? "Supabase service role key is not configured. Set it at /admin/keys/supabase."
        : "Supabase anon/publishable key is not configured. Set it at /admin/keys/supabase.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
