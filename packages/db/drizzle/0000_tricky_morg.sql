CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "commentary_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"template_keys" jsonb NOT NULL,
	"max_suggestions" integer DEFAULT 4 NOT NULL,
	"cooldown_seconds" integer DEFAULT 0 NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"output_type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commentary_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"trigger_event_id" uuid,
	"facts" jsonb NOT NULL,
	"rendered_options" jsonb NOT NULL,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"selected_index" integer,
	"operator_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commentary_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"output_type" text NOT NULL,
	"tone" text DEFAULT 'neutral' NOT NULL,
	"body" text NOT NULL,
	"placeholders_schema" jsonb,
	"priority" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sport_id" uuid
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"sport_id" uuid,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"competition_name" text,
	"kickoff_at" timestamp with time zone,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"match_minute" integer DEFAULT 0 NOT NULL,
	"match_second" integer DEFAULT 0 NOT NULL,
	"period" text DEFAULT 'not_started' NOT NULL,
	CONSTRAINT "fixtures_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "match_commentary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"minute" integer NOT NULL,
	"second" integer DEFAULT 0 NOT NULL,
	"output_type" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"body" text NOT NULL,
	"facts" jsonb,
	"template_id" uuid,
	"suggestion_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'template' NOT NULL,
	"widget_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"minute" integer DEFAULT 0 NOT NULL,
	"second" integer DEFAULT 0 NOT NULL,
	"team_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_provider" text DEFAULT 'demo',
	"sequence_no" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rugby_law_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"phase_type" text,
	"law_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "rugby_laws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_number" text NOT NULL,
	"law_version" text DEFAULT '2024' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"category" text NOT NULL,
	"world_rugby_url" text
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"rules_config" jsonb,
	CONSTRAINT "sports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "commentary_suggestions" ADD CONSTRAINT "commentary_suggestions_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentary_suggestions" ADD CONSTRAINT "commentary_suggestions_trigger_event_id_match_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."match_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentary_templates" ADD CONSTRAINT "commentary_templates_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_commentary" ADD CONSTRAINT "match_commentary_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_commentary" ADD CONSTRAINT "match_commentary_template_id_commentary_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."commentary_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_commentary" ADD CONSTRAINT "match_commentary_suggestion_id_commentary_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."commentary_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rugby_law_mappings" ADD CONSTRAINT "rugby_law_mappings_law_id_rugby_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."rugby_laws"("id") ON DELETE no action ON UPDATE no action;