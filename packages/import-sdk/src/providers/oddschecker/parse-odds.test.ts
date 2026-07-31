import { describe, expect, it } from "vitest";
import { parseOddscheckerUrl } from "./parse-url";
import { parseInitialOddsState, parseOddscheckerMarketHtml } from "./parse-odds";
import { parseOddscheckerListingHtml } from "./parse-listing";

const MARKET_FIXTURE = `
<html><head><title>Griquas v Cheetahs Betting Odds- Winner | Rugby Union | Oddschecker</title></head>
<body>
<h1>Griquas v Cheetahs Betting Odds - Winner</h1>
<table>
<tr class="diff-row evTabRow bc" data-bid="27250626602" data-bname="Griquas" data-best-bks="KN,VE" data-best-dig="1.92" data-initial-odds-state="27250626602_B3__0_1,27250626602_WH_7/10_1.7_0,27250626602_UN_3/4_1.75_0,27250626602_FR_4/5_1.8_0,27250626602_SX_5/6_1.83_0,27250626602_KN_10/11_1.92_0,27250626602_VE_10/11_1.92_0,27250626602_PP_10/11_1.91_0">
<td class="sel nm">Griquas</td>
<td class="np o" data-bk="B3" data-odig="0" data-o=""></td>
<td class="bc bs o" data-bk="WH" data-odig="1.7" data-o="7/10"><p>7/10</p></td>
</tr>
<tr class="diff-row evTabRow bc" data-bid="27250626531" data-bname="Cheetahs" data-best-bks="QN" data-best-dig="2.2" data-initial-odds-state="27250626531_WH_21/20_2.05_0,27250626531_QN_6/5_2.2_0,27250626531_UN_1_2_0">
<td class="sel nm">Cheetahs</td>
</tr>
<tr class="diff-row evTabRow bc" data-bid="27250626396" data-bname="Draw" data-best-bks="UN" data-best-dig="34" data-initial-odds-state="27250626396_WH_28_29_0,27250626396_UN_22_23_0">
<td class="sel nm">Draw</td>
</tr>
</table>
</body></html>
`;

const LISTING_FIXTURE = `
<html><body>
<h1>Rugby Union Betting Odds</h1>
<table>
<tr data-mid="1" class="match-on no-top-border " data-day="Friday">
<td class="time all-odds-click"><span class="time-digits">18:00</span></td>
<td class="all-odds-click"><p class="fixtures-bet-name beta-footnote">Griquas</p><p class="fixtures-bet-name beta-footnote">Cheetahs</p></td>
<td data-bid="1" data-best-dig="1.92" title="Add Griquas to betslip" class="basket-add"><span class="odds beta-footnote bold add-to-bet-basket">11/12</span></td>
<td data-bid="2" data-best-dig="34" title="Add Draw to betslip" class="basket-add"><span class="odds beta-footnote bold add-to-bet-basket">33/1</span></td>
<td data-bid="3" data-best-dig="2.2" title="Add Cheetahs to betslip" class="basket-add"><span class="odds beta-footnote bold add-to-bet-basket">6/5</span></td>
<td class="betting link-right"><a href="/rugby-union/south-africa/currie-cup/griquas-v-cheetahs/winner">All Odds</a></td>
</tr>
</table>
</body></html>
`;

describe("oddschecker parse-url", () => {
  it("parses market winner URL", () => {
    const p = parseOddscheckerUrl(
      "https://www.oddschecker.com/rugby-union/south-africa/currie-cup/griquas-v-cheetahs/winner",
    );
    expect(p.kind).toBe("market");
    expect(p.competitionSlug).toBe("currie-cup");
    expect(p.matchSlug).toBe("griquas-v-cheetahs");
    expect(p.marketSlug).toBe("winner");
    expect(p.homeNameHint).toBe("Griquas");
    expect(p.awayNameHint).toBe("Cheetahs");
  });

  it("parses listing URL", () => {
    const p = parseOddscheckerUrl("https://www.oddschecker.com/rugby-union");
    expect(p.kind).toBe("listing");
  });
});

describe("oddschecker parse-odds", () => {
  it("parses initial odds state tokens", () => {
    const prices = parseInitialOddsState(
      "27250626602_B3__0_1,27250626602_WH_7/10_1.7_0,27250626602_KN_10/11_1.92_0",
    );
    expect(prices).toHaveLength(2);
    expect(prices[0]!.bookmakerCode).toBe("WH");
    expect(prices[0]!.decimal).toBe(1.7);
    expect(prices[1]!.bookmakerName).toBe("BetMGM");
    expect(prices[1]!.impliedProbability).toBeCloseTo(1 / 1.92, 3);
  });

  it("parses winner market grid", () => {
    const preview = parseOddscheckerMarketHtml(
      MARKET_FIXTURE,
      "https://www.oddschecker.com/rugby-union/south-africa/currie-cup/griquas-v-cheetahs/winner",
    );
    expect(preview.kind).toBe("market");
    expect(preview.outcomes).toHaveLength(3);
    const home = preview.outcomes.find((o) => o.name === "Griquas")!;
    expect(home.bestDecimal).toBe(1.92);
    expect(home.prices.some((p) => p.bookmakerCode === "WH")).toBe(true);
    expect(preview.bookmakerCount).toBeGreaterThan(3);
  });
});

describe("oddschecker parse-listing", () => {
  it("parses coupon rows with best odds", () => {
    const preview = parseOddscheckerListingHtml(
      LISTING_FIXTURE,
      "https://www.oddschecker.com/rugby-union",
    );
    expect(preview.kind).toBe("listing");
    expect(preview.matches).toHaveLength(1);
    expect(preview.matches[0]!.homeName).toBe("Griquas");
    expect(preview.matches[0]!.bestAwayFractional).toBe("6/5");
    expect(preview.matches[0]!.sourceUrl).toContain("griquas-v-cheetahs/winner");
  });
});
