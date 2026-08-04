/**
 * Seed Nations Championship home/away shirt drafts (not approved).
 * Usage (from repo root):
 *   npx tsx --require ./scripts/stub-server-only.cjs apps/web/scripts/seed-nations-shirts.ts
 * Or use CMS: Shirt Library → Seed Nations drafts
 */
async function main() {
  const { seedNationsChampionshipShirtDrafts } = await import(
    "../src/lib/shirt-library-service"
  );
  const result = await seedNationsChampionshipShirtDrafts("seed-script");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
