/**
 * Re-enrich a short list of players from Wikipedia (rugby union titles).
 *
 * Usage:
 *   npx tsx scripts/enrich-players-wikipedia-sample.ts
 */
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";

const PLAYERS: Array<{ id: string; name: string }> = [
  { id: "34b53de2-9dca-4542-a962-e87075b963c6", name: "Adrien Seguret" },
  { id: "a6f89d08-9adc-42da-9f08-ef914d40eac6", name: "Alan O'Connor" },
  { id: "8c88c698-4205-455d-afc7-32afb87bce47", name: "Alex Mitchell" },
  { id: "ef144643-c6f8-4fa7-b1c9-9051b60ee1a3", name: "Alexandru Bucur" },
  { id: "6cf41ae1-5ee5-439e-8bbf-1d9ed16d09cd", name: "Amanaki Mafi" },
  { id: "ebb962ad-0bae-4f5b-b46b-a433d2a5bb80", name: "Andy Uren" },
  { id: "5dc60efc-95e0-4124-84bf-a2ea6f8ac14d", name: "Antoine Frisch" },
  { id: "3e52980e-55d9-4938-a649-4c486d135005", name: "Archie White" },
  { id: "1bd16b9c-ca54-4f03-8cae-8555634cedd9", name: "Asier Usarraga" },
  { id: "21c246f2-4e79-45e7-a27d-241bc0f8a3e5", name: "Baptiste Delaporte" },
];

async function main() {
  let enriched = 0;
  for (let index = 0; index < PLAYERS.length; index++) {
    const player = PLAYERS[index]!;
    const result = await enrichPlayerFromWikipedia(player.id, player.name);
    const status = result.enriched
      ? `enriched → ${result.wikipediaUrl}`
      : (result.reason ?? "skipped");
    console.log(`${player.name}: ${status}`);
    if (result.enriched) enriched += 1;
    if (index < PLAYERS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  console.log(`\n${enriched}/${PLAYERS.length} enriched.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
