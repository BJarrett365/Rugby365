CREATE TABLE "reference_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"source_url" text,
	"learn_from" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"do_not_copy" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_centre_patterns" jsonb,
	"commentary_patterns" jsonb,
	"data_patterns" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "commentary_research_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"provider_slug" text NOT NULL,
	"event_type" text NOT NULL,
	"category" text NOT NULL,
	"style" jsonb NOT NULL,
	"presentation" jsonb NOT NULL,
	"research_notes" text NOT NULL,
	"template_guidance" text NOT NULL,
	"rugby365_template_keys" jsonb NOT NULL,
	"rugby_law_categories" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commentary_research_findings_external_id_unique" UNIQUE("external_id")
);
