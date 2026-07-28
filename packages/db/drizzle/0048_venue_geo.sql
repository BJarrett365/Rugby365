-- Venue geography for Open-Meteo weather (lat/lng + country code).
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "country_code" text;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "latitude" real;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "longitude" real;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "geocoded_at" timestamp with time zone;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "geocode_source" text;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "geocode_query" text;
