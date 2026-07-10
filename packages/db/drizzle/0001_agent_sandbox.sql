CREATE TYPE "public"."agent_approval_status" AS ENUM('pending', 'approved', 'rejected', 'auto_accepted', 'logged_only');--> statement-breakpoint
CREATE TABLE "agent_sandbox_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_external_id" text NOT NULL,
	"source_url" text NOT NULL,
	"mode" text DEFAULT 'assisted' NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"poll_count" integer DEFAULT 0 NOT NULL,
	"last_snapshot" jsonb,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_sandbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence_no" integer NOT NULL,
	"event_output" jsonb NOT NULL,
	"approval_status" "agent_approval_status" DEFAULT 'pending' NOT NULL,
	"operator_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_sandbox_events" ADD CONSTRAINT "agent_sandbox_events_run_id_agent_sandbox_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_sandbox_runs"("id") ON DELETE cascade ON UPDATE no action;
