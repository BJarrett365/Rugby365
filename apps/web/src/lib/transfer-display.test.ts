import { describe, expect, it } from "vitest";
import {
  inferClubFromImportKey,
  inferClubFromStructuredImportKey,
  isJunkTeamPickerName,
  sanitizeTransferClub,
  sanitizeTransferPlayerName,
  sanitizeTransferPlayerNameWithStatus,
} from "./transfer-display";

describe("transfer display sanitization", () => {
  it("cleans legacy player names with movement text", () => {
    expect(
      sanitizeTransferPlayerName(
        "Harvey Cuckson to Scarlets<ref>{{Cite news|url=https://example.com}}</ref>",
      ),
    ).toBe("Harvey Cuckson");
  });

  it("cleans retired/released suffixes and wiki refs from player names", () => {
    expect(
      sanitizeTransferPlayerNameWithStatus(
        'Joe Launchbury (retired)<ref>{{cite web |last1=Newcombe |title=Triple Six Nations winner Joe Launchbury set',
      ).name,
    ).toBe("Joe Launchbury");
    expect(
      sanitizeTransferPlayerNameWithStatus(
        'James O\'Connor (released)<ref name="O\'Connor & Perese">{{cite web |title=Australia\'s James O\'Connor',
      ).statusHint,
    ).toBe("released");
  });

  it("extracts club names from citation debris", () => {
    expect(sanitizeTransferClub("Bath |date=6 May 2026|accessdate=6 May 2026}}</ref>")).toBe("Bath");
  });

  it("strips html anchor debris from club names", () => {
    expect(
      sanitizeTransferClub('<span class="anchor" id="Bath"></span>Bath'),
    ).toBe("Bath");
    expect(
      sanitizeTransferClub('="anchor" id="Worcester Warriors"></span>Worcester Warriors'),
    ).toBe("Worcester Warriors");
    expect(
      sanitizeTransferClub('="anchor" id="Worcester span>Worcester Warriors'),
    ).toBe("Worcester Warriors");
    expect(sanitizeTransferClub("Exeter Chiefs (short-term deal)")).toBe("Exeter Chiefs");
  });

  it("infers clubs from structured import keys when stored values are dirty", () => {
    const key = "2017-18:worcester-warriors:in:anton-bresler:edinburgh:span-class-anchor-id-worcester-warriors:permanent";
    expect(inferClubFromStructuredImportKey(key, "from")).toBe("Edinburgh");
    expect(inferClubFromStructuredImportKey(key, "to")).toBe("Worcester Warriors");
  });

  it("flags junk picker names", () => {
    expect(isJunkTeamPickerName("→")).toBe(true);
    expect(isJunkTeamPickerName("(test)")).toBe(true);
    expect(isJunkTeamPickerName("Academy)")).toBe(true);
    expect(isJunkTeamPickerName("Bath")).toBe(false);
  });

  it("infers destination clubs from legacy import keys", () => {
    const harveyKey =
      "2026-27:bath:out:flagicon-eng-harvey-cuckson-to-flagicon-wal-scarlets-ref-cite-news-url-https-www-bbc-co-uk:bath:bath:permanent";
    expect(inferClubFromImportKey(harveyKey, "to")).toBe("Scarlets");

    const francoisKey =
      "2026-27:bath:out:flagicon-rsa-francois-van-wyk-to-flagicon-ire-rugby-union-connacht-ref-cite-web-title-connacht-sign:bath:bath:permanent";
    expect(inferClubFromImportKey(francoisKey, "to")).toBe("Connacht");
  });
});
