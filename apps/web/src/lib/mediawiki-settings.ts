import {
  getWikidataSettings,
  getWikipediaSettings,
  type ResolvedMediaWikiSettings,
} from "./integration-settings-service";

/** Map CMS/env MediaWiki settings into import-sdk request options. */
export function toMediaWikiRequestOptions(settings: ResolvedMediaWikiSettings) {
  return {
    userAgent: settings.userAgent,
    apiBaseUrl: settings.apiBaseUrl,
    accessToken: settings.accessToken,
  };
}

export async function resolveWikipediaRequestOptions() {
  return toMediaWikiRequestOptions(await getWikipediaSettings());
}

export async function resolveWikidataRequestOptions() {
  return toMediaWikiRequestOptions(await getWikidataSettings());
}
