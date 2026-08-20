/**
 * Upload primary profile images for nations coaches from local PNG assets.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/set-nations-coach-profile-images.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { uploadCoachPrimaryImage } from "../apps/web/src/lib/coach-image-service";

const ASSETS = join(
  process.env.HOME ?? "",
  ".cursor/projects/Users-barriejarrett-Projects-Rugby365/assets",
);

const JOBS = [
  {
    coachId: "04901619-de61-46d8-b6bc-1123c0461b1d",
    name: "Fabien Galthié",
    file: "France-coach-Fabien-Galthie-with-ball-PA-fbef663b-34fe-4cbf-8620-a7c1c3cf913e.png",
    credit: "PA",
  },
  {
    coachId: "40eb9a73-cdb2-47ff-bb2e-1d2208d5f93e",
    name: "Gregor Townsend",
    file: "Gregor_Townsend_Scotland_-fffae101-2727-4e32-8c83-6dc7cae618e6.png",
    credit: null,
  },
  {
    coachId: "1beeacf9-0b1e-4ae7-80b6-00c4b298f050",
    name: "Andy Farrell",
    file: "Ireland-head-coach-Andy-Farrell-during-the-2023-Rugby-World-Cup-PA-f6a0e060-8e66-46e2-9909-12a387840395.png",
    credit: "PA",
  },
] as const;

async function main() {
  for (const job of JOBS) {
    const path = join(ASSETS, job.file);
    const bytes = readFileSync(path);
    console.log(`Uploading ${job.name} (${bytes.length} bytes)…`);
    const row = await uploadCoachPrimaryImage({
      coachId: job.coachId,
      bytes,
      contentType: "image/png",
      fileName: job.file,
      credit: job.credit,
    });
    console.log(`  OK → ${row.imageUrl}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
