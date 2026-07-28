import { NextResponse } from "next/server";
import {
  clearSupabaseCredentials,
  getSupabasePublicConfig,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from "@/lib/integration-settings-service";
import {
  bootstrapSupabaseIntegration,
  getSupabaseIntegrationStatus,
  mirrorLiveFixturesToSupabase,
} from "@/lib/supabase-live-service";
import { syncAllDataToSupabase } from "@/lib/supabase-full-sync-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const config = await getSupabasePublicConfig();
    const status = config.configured
      ? await getSupabaseIntegrationStatus().catch(() => null)
      : null;
    return NextResponse.json({
      ...config,
      docsUrl: "https://supabase.com/dashboard/project/_/settings/api-keys",
      envProjectUrlOverride: Boolean(
        process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
      ),
      envAnonKeyOverride: Boolean(
        process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
      ),
      envServiceRoleOverride: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      integration: status,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Supabase settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      const config = await clearSupabaseCredentials({
        clearAnonKey: body.clearAnonKey !== false,
        clearServiceRoleKey: body.clearServiceRoleKey !== false,
      });
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "test") {
      const result = await testSupabaseConnection();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, message: result.message, projectUrl: result.projectUrl },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        message: `${result.message} (${result.responseTimeMs}ms)`,
        projectUrl: result.projectUrl,
      });
    }

    if (body.action === "bootstrap") {
      const result = await bootstrapSupabaseIntegration();
      const status = await getSupabaseIntegrationStatus();
      return NextResponse.json({ ok: result.ok, ...result, integration: status });
    }

    if (body.action === "mirror-day") {
      const dateKey =
        typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : new Date().toISOString().slice(0, 10);
      const result = await mirrorLiveFixturesToSupabase(dateKey);
      return NextResponse.json({
        ok: result.errors.length === 0,
        dateKey,
        ...result,
      });
    }

    if (body.action === "sync-all") {
      const tables =
        typeof body.tables === "string"
          ? body.tables
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : Array.isArray(body.tables)
            ? body.tables.map(String)
            : undefined;
      const result = await syncAllDataToSupabase({ tables });
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }

    const projectUrl = typeof body.projectUrl === "string" ? body.projectUrl : undefined;
    const anonKey = typeof body.anonKey === "string" ? body.anonKey : undefined;
    const serviceRoleKey = typeof body.serviceRoleKey === "string" ? body.serviceRoleKey : undefined;
    const config = await saveSupabaseCredentials({ projectUrl, anonKey, serviceRoleKey });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Supabase settings");
  }
}
