import { describe, expect, it } from "vitest";
import {
  filterRugbyKickoffInternational,
  isRugbyKickoffInternationalCompetition,
  parseRugbyKickoffGamePath,
  parseRugbyKickoffListingHtml,
  parseRugbyKickoffLocation,
  parseRugbyKickoffTitle,
} from "./parse-listing";

const SAMPLE = `
<section class="fixtures-day">
  <article class="fixture-card">
    <div class="fixture-card__time">
      <span class="fixture-card__time-value">20:00</span>
    </div>
    <div class="fixture-card__content">
      <div class="fixture-card__body">
        <a class="fixture-card__link unlink" href="/game/australia_england_2026-11-08/">
          <h3 class="fixture-card__title">England <span>v</span> Australia</h3>
        </a>
        <p class="fixture-card__location mb-0">Nations Championship - TBA</p>
      </div>
      <div class="fixture-card__providers">
        <div class="provider-pill">
          <a href="https://www.itv.com/hub/itv" target="_blank" rel="noopener noreferrer">
            <img src="/static/RugbyFixtures/images/itv.png" alt="ITV" class="provider-pill__image">
          </a>
        </div>
      </div>
    </div>
  </article>
  <article class="fixture-card">
    <div class="fixture-card__time">
      <span class="fixture-card__time-value">15:00</span>
    </div>
    <div class="fixture-card__content">
      <div class="fixture-card__body">
        <a class="fixture-card__link unlink" href="/game/bath_leicester_2026-11-09/">
          <h3 class="fixture-card__title">Bath <span>v</span> Leicester</h3>
        </a>
        <p class="fixture-card__location mb-0">Premiership - Recreation Ground</p>
      </div>
      <div class="fixture-card__providers">
        <div class="provider-pill">
          <a href="https://www.tntsports.co.uk/" target="_blank">
            <img alt="TNT Sports" class="provider-pill__image">
          </a>
        </div>
        <div class="provider-pill">
          <a href="https://www.youtube.com/" target="_blank">
            <img alt="YouTube" class="provider-pill__image">
          </a>
        </div>
      </div>
    </div>
  </article>
</section>
`;

describe("parseRugbyKickoff helpers", () => {
  it("parses game path date + id", () => {
    expect(parseRugbyKickoffGamePath("/game/australia_england_2026-11-08/")).toEqual({
      externalId: "australia_england_2026-11-08",
      kickoffDate: "2026-11-08",
    });
  });

  it("parses title home/away order", () => {
    expect(parseRugbyKickoffTitle("England <span>v</span> Australia")).toEqual({
      homeName: "England",
      awayName: "Australia",
    });
  });

  it("parses competition and venue", () => {
    expect(parseRugbyKickoffLocation("6 Nations - Murrayfield")).toEqual({
      competition: "6 Nations",
      venue: "Murrayfield",
    });
    expect(parseRugbyKickoffLocation("Nations Championship - TBA")).toEqual({
      competition: "Nations Championship",
      venue: null,
    });
  });

  it("detects international competitions", () => {
    expect(isRugbyKickoffInternationalCompetition("6 Nations")).toBe(true);
    expect(isRugbyKickoffInternationalCompetition("Premiership")).toBe(false);
  });
});

describe("parseRugbyKickoffListingHtml", () => {
  it("extracts UK fixture cards and providers", () => {
    const preview = parseRugbyKickoffListingHtml(SAMPLE);
    expect(preview.listings).toHaveLength(2);
    expect(preview.listings[0]).toMatchObject({
      externalId: "australia_england_2026-11-08",
      kickoffDate: "2026-11-08",
      kickoffLocalTime: "20:00",
      homeName: "England",
      awayName: "Australia",
      competition: "Nations Championship",
      venue: null,
    });
    expect(preview.listings[0]!.providers).toEqual([
      { name: "ITV", url: "https://www.itv.com/hub/itv", imageAlt: "ITV" },
    ]);
    expect(preview.listings[1]!.providers.map((p) => p.name)).toEqual([
      "TNT Sports",
      "YouTube",
    ]);
  });

  it("filters to internationals", () => {
    const preview = parseRugbyKickoffListingHtml(SAMPLE);
    const intl = filterRugbyKickoffInternational(preview.listings);
    expect(intl).toHaveLength(1);
    expect(intl[0]!.externalId).toBe("australia_england_2026-11-08");
  });
});
