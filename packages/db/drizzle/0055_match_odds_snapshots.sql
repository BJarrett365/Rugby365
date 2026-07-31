CREATE TABLE IF NOT EXISTS "match_odds_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "provider" text NOT NULL DEFAULT 'oddschecker',
  "source_url" text NOT NULL,
  "market_key" text NOT NULL DEFAULT 'winner',
  "market_label" text NOT NULL DEFAULT 'Winner',
  "competition_name" text,
  "home_name" text,
  "away_name" text,
  "kickoff_label" text,
  "bookmaker_count" integer NOT NULL DEFAULT 0,
  "outcomes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "best_home_decimal" real,
  "best_draw_decimal" real,
  "best_away_decimal" real,
  "implied_home" real,
  "implied_draw" real,
  "implied_away" real,
  "raw_response_id" uuid REFERENCES "provider_raw_responses"("id") ON DELETE SET NULL,
  "scraped_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_odds_snapshots_fixture_idx" ON "match_odds_snapshots" ("fixture_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_odds_snapshots_source_url_idx" ON "match_odds_snapshots" ("source_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_odds_snapshots_scraped_at_idx" ON "match_odds_snapshots" ("scraped_at");
