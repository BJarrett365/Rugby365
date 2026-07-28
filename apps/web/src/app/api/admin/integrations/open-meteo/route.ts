import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  OPEN_METEO_DOCS_URL,
  OPEN_METEO_FORECAST_URL,
  OPEN_METEO_GEOCODING_URL,
  OPEN_METEO_TEST_COORDS,
  fetchOpenMeteoWeather,
  formatOpenMeteoSummary,
} from "@/lib/open-meteo-service";
import {
  countVenueGeoCoverage,
  geocodeVenuesMissingCoords,
} from "@/lib/venue-geocode-service";

export async function GET() {
  try {
    const coverage = await countVenueGeoCoverage();
    return NextResponse.json({
      configured: true,
      requiresApiKey: false,
      forecastUrl: OPEN_METEO_FORECAST_URL,
      geocodingUrl: OPEN_METEO_GEOCODING_URL,
      docsUrl: OPEN_METEO_DOCS_URL,
      testLocation: OPEN_METEO_TEST_COORDS,
      coverage,
      note:
        "Open-Meteo maps weather to each match via venue latitude/longitude (geocoded from city + country). Geocode venues first, then match pages fetch conditions automatically.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Open-Meteo settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "test") {
      const latitude =
        typeof body.latitude === "number" ? body.latitude : OPEN_METEO_TEST_COORDS.latitude;
      const longitude =
        typeof body.longitude === "number" ? body.longitude : OPEN_METEO_TEST_COORDS.longitude;
      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim()
          : OPEN_METEO_TEST_COORDS.label;

      const weather = await fetchOpenMeteoWeather({ latitude, longitude });
      return NextResponse.json({
        ok: true,
        message: `Connected — ${label}: ${formatOpenMeteoSummary(weather)}.`,
        weather,
        label,
      });
    }

    if (body.action === "geocode-venues") {
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.min(Math.max(1, Math.floor(body.limit)), 500)
          : 200;
      const result = await geocodeVenuesMissingCoords({
        limit,
        force: Boolean(body.force),
      });
      const coverage = await countVenueGeoCoverage();
      return NextResponse.json({
        ok: true,
        message: `Geocoded ${result.geocoded} venues (${result.failed} failed, ${result.skipped} skipped).`,
        result,
        coverage,
      });
    }

    return NextResponse.json(
      { ok: false, message: 'Unknown action. Use { action: "test" | "geocode-venues" }.' },
      { status: 400 },
    );
  } catch (e) {
    return apiErrorResponse(e, "Open-Meteo request failed");
  }
}
