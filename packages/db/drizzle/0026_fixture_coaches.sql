ALTER TABLE "fixtures" ADD COLUMN "home_coach_id" uuid;
ALTER TABLE "fixtures" ADD COLUMN "away_coach_id" uuid;
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_coach_id_coaches_id_fk" FOREIGN KEY ("home_coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_coach_id_coaches_id_fk" FOREIGN KEY ("away_coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;
