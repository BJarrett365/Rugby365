/**
 * Geocode venues missing lat/lng via Open-Meteo (city + country).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/geocode-venues-open-meteo.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/geocode-venues-open-meteo.ts --limit=50 --force
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const { geocodeVenuesMissingCoords } = await import(
    "../apps/web/src/lib/venue-geocode-service"
  );

  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;
  const force = process.argv.includes("--force");

  console.log(`Geocoding venues (limit=${limit}, force=${force})…`);
  const result = await geocodeVenuesMissingCoords({
    limit: Number.isFinite(limit) ? limit : 200,
    force,
    delayMs: 150,
  });

  console.log(
    `Done — scanned ${result.scanned}, geocoded ${result.geocoded}, skipped ${result.skipped}, failed ${result.failed}`,
  );
  for (const row of result.results.filter((r) => !r.ok).slice(0, 30)) {
    console.log(`  ! ${row.name}: ${row.reason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
