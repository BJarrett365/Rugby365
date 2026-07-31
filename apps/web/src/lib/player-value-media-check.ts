/**
 * Optional AI media check for Player Value.
 * OpenAI must ONLY discuss figures cited in provided reputable-source snippets.
 * Never invent salaries or fees.
 */
import { chatCompletion } from "./openai-client";
import { isReputablePlayerValueUrl } from "./player-value-salary-caps";

export type PlayerValueMediaSnippet = {
  url: string;
  title?: string;
  excerpt: string;
  publishedAt?: string | null;
};

export type PlayerValueMediaCheckResult = {
  status: "skipped" | "reviewed" | "rejected_sources";
  /** -8..+8 percentage nudge for the valuation model. */
  nudgePct: number;
  summary: string;
  citedUrls: string[];
  confidence: number;
  warnings: string[];
};

export async function reviewPlayerValueMediaSnippets(input: {
  playerName: string;
  clubName: string | null;
  modelMarketValueGbp: number;
  snippets: PlayerValueMediaSnippet[];
}): Promise<PlayerValueMediaCheckResult> {
  const accepted = input.snippets.filter((s) => isReputablePlayerValueUrl(s.url));
  const rejected = input.snippets.filter((s) => !isReputablePlayerValueUrl(s.url));

  if (accepted.length === 0) {
    return {
      status: rejected.length ? "rejected_sources" : "skipped",
      nudgePct: 0,
      summary: rejected.length
        ? "No reputable sources supplied — media check skipped."
        : "No media snippets supplied.",
      citedUrls: [],
      confidence: 0,
      warnings: rejected.map((s) => `Rejected non-allowlisted source: ${s.url}`),
    };
  }

  const packet = accepted.map((s) => ({
    url: s.url,
    title: s.title ?? null,
    excerpt: s.excerpt.slice(0, 1200),
    publishedAt: s.publishedAt ?? null,
  }));

  try {
    const raw = await chatCompletion({
      json: true,
      maxTokens: 800,
      system: `You review rugby player market/salary mentions for Rugby365.
Rules:
- Use ONLY the provided snippets. Do not invent figures.
- If snippets do not state a salary or valuation, nudgePct must be 0.
- nudgePct is an integer from -8 to +8 suggesting whether the Rugby365 model looks high/low vs cited figures.
- Prefer GBP; if EUR/other, convert roughly and say so in summary.
- Never treat Ultimate Rugby / ItsRugby / Transfermarkt football pages as proof.
Return JSON: { "nudgePct": number, "summary": string, "citedUrls": string[], "confidence": number, "warnings": string[] }`,
      user: JSON.stringify({
        playerName: input.playerName,
        clubName: input.clubName,
        modelMarketValueGbp: input.modelMarketValueGbp,
        snippets: packet,
      }),
    });

    const parsed = JSON.parse(raw) as {
      nudgePct?: number;
      summary?: string;
      citedUrls?: string[];
      confidence?: number;
      warnings?: string[];
    };

    const nudge = Math.max(-8, Math.min(8, Math.round(Number(parsed.nudgePct) || 0)));
    return {
      status: "reviewed",
      nudgePct: nudge,
      summary: String(parsed.summary ?? "Media review complete."),
      citedUrls: Array.isArray(parsed.citedUrls)
        ? parsed.citedUrls.filter((u) => typeof u === "string" && isReputablePlayerValueUrl(u))
        : accepted.map((s) => s.url),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.4)),
      warnings: [
        ...rejected.map((s) => `Rejected non-allowlisted source: ${s.url}`),
        ...(Array.isArray(parsed.warnings)
          ? parsed.warnings.filter((w): w is string => typeof w === "string")
          : []),
      ],
    };
  } catch (error) {
    return {
      status: "skipped",
      nudgePct: 0,
      summary: error instanceof Error ? error.message : "Media review failed",
      citedUrls: [],
      confidence: 0,
      warnings: ["AI media review unavailable"],
    };
  }
}
