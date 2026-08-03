/**
 * Rugby TV / streaming territories for CMS where-to-watch.
 * Primary markets: UK, South Africa, Australia, New Zealand, France.
 */

export const BROADCASTER_REGIONS = [
  { code: "UK", label: "United Kingdom" },
  { code: "ZA", label: "South Africa" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "FR", label: "France" },
  { code: "IE", label: "Ireland" },
  { code: "US", label: "United States" },
  { code: "INT", label: "International" },
] as const;

export type BroadcasterRegionCode = (typeof BROADCASTER_REGIONS)[number]["code"];

/** Core territories editors should cover first for rugby. */
export const PRIMARY_BROADCASTER_REGIONS: BroadcasterRegionCode[] = [
  "UK",
  "ZA",
  "AU",
  "NZ",
  "FR",
];

export const RUGBY_BROADCASTER_PRESETS = [
  // United Kingdom
  { name: "TNT Sports", region: "UK", platform: "tv" },
  { name: "discovery+", region: "UK", platform: "streaming" },
  { name: "Sky Sports", region: "UK", platform: "tv" },
  { name: "NOW", region: "UK", platform: "streaming" },
  { name: "BBC", region: "UK", platform: "tv" },
  { name: "BBC iPlayer", region: "UK", platform: "streaming" },
  { name: "ITV", region: "UK", platform: "tv" },
  { name: "ITVX", region: "UK", platform: "streaming" },
  { name: "Channel 4", region: "UK", platform: "tv" },
  { name: "S4C", region: "UK", platform: "tv" },
  { name: "Premier Sports", region: "UK", platform: "tv" },
  { name: "Viaplay", region: "UK", platform: "streaming" },

  // South Africa
  { name: "SuperSport", region: "ZA", platform: "tv" },
  { name: "DStv", region: "ZA", platform: "tv" },
  { name: "Showmax", region: "ZA", platform: "streaming" },
  { name: "SABC", region: "ZA", platform: "tv" },

  // Australia
  { name: "Stan Sport", region: "AU", platform: "streaming" },
  { name: "Nine", region: "AU", platform: "tv" },
  { name: "9Now", region: "AU", platform: "streaming" },
  { name: "Foxtel", region: "AU", platform: "tv" },
  { name: "Kayo Sports", region: "AU", platform: "streaming" },
  { name: "ABC", region: "AU", platform: "tv" },

  // New Zealand
  { name: "Sky Sport", region: "NZ", platform: "tv" },
  { name: "Sky Go", region: "NZ", platform: "streaming" },
  { name: "Spark Sport", region: "NZ", platform: "streaming" },
  { name: "TVNZ", region: "NZ", platform: "tv" },
  { name: "TVNZ+", region: "NZ", platform: "streaming" },

  // France
  { name: "Canal+", region: "FR", platform: "tv" },
  { name: "Canal+ Sport", region: "FR", platform: "tv" },
  { name: "beIN Sports", region: "FR", platform: "tv" },
  { name: "France Télévisions", region: "FR", platform: "tv" },
  { name: "france.tv", region: "FR", platform: "streaming" },
  { name: "TF1", region: "FR", platform: "tv" },
  { name: "M6", region: "FR", platform: "tv" },

  // Ireland (common for Six Nations / URC)
  { name: "RTÉ", region: "IE", platform: "tv" },
  { name: "Virgin Media", region: "IE", platform: "tv" },

  // United States / international streaming
  { name: "FloRugby", region: "US", platform: "streaming" },
  { name: "Peacock", region: "US", platform: "streaming" },
  { name: "NBC", region: "US", platform: "tv" },
  { name: "World Rugby YouTube", region: "INT", platform: "streaming" },
] as const;

export type RugbyBroadcasterPreset = (typeof RUGBY_BROADCASTER_PRESETS)[number];

export const BROADCASTER_PLATFORMS = ["tv", "streaming", "radio", "other"] as const;
export type BroadcasterPlatform = (typeof BROADCASTER_PLATFORMS)[number];

export const BROADCASTER_SOURCE_PROVIDERS = [
  "manual",
  "gracenote",
  "pa_media",
] as const;
export type BroadcasterSourceProvider = (typeof BROADCASTER_SOURCE_PROVIDERS)[number];

export function isBroadcasterPlatform(value: string): value is BroadcasterPlatform {
  return (BROADCASTER_PLATFORMS as readonly string[]).includes(value);
}

export function broadcasterRegionLabel(code: string | null | undefined): string {
  const c = code?.trim().toUpperCase();
  if (!c) return "";
  const found = BROADCASTER_REGIONS.find((r) => r.code === c);
  return found?.label ?? c;
}

export function presetsForRegion(region: string): RugbyBroadcasterPreset[] {
  const code = region.trim().toUpperCase();
  return RUGBY_BROADCASTER_PRESETS.filter((p) => p.region === code) as RugbyBroadcasterPreset[];
}

/** Default starter pack — one flagship channel per primary rugby territory. */
export function defaultRegionPackRows(): Array<{
  broadcasterName: string;
  region: BroadcasterRegionCode;
  platform: BroadcasterPlatform;
}> {
  return [
    { broadcasterName: "TNT Sports", region: "UK", platform: "tv" },
    { broadcasterName: "SuperSport", region: "ZA", platform: "tv" },
    { broadcasterName: "Stan Sport", region: "AU", platform: "streaming" },
    { broadcasterName: "Sky Sport", region: "NZ", platform: "tv" },
    { broadcasterName: "Canal+", region: "FR", platform: "tv" },
  ];
}
