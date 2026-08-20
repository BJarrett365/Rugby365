import { count, desc, isNotNull, sql } from "drizzle-orm";
import { competitions, fixtures, teams, venues } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const [total] = await db.select({ c: count() }).from(venues);
  const [withCoords] = await db
    .select({ c: count() })
    .from(venues)
    .where(sql`${venues.latitude} is not null and ${venues.longitude} is not null`);
  const [withCapacity] = await db.select({ c: count() }).from(venues).where(isNotNull(venues.capacity));
  const [largeCap] = await db.select({ c: count() }).from(venues).where(sql`${venues.capacity} >= 40000`);
  const [withCountry] = await db.select({ c: count() }).from(venues).where(isNotNull(venues.countryName));
  const [withCode] = await db.select({ c: count() }).from(venues).where(isNotNull(venues.countryCode));
  const [countries] = await db
    .select({ c: sql<number>`count(distinct ${venues.countryName})::int` })
    .from(venues)
    .where(isNotNull(venues.countryName));
  const countryRows = await db
    .select({ country: venues.countryName, code: venues.countryCode, c: count() })
    .from(venues)
    .where(isNotNull(venues.countryName))
    .groupBy(venues.countryName, venues.countryCode)
    .orderBy(desc(count()))
    .limit(15);
  const sample = await db
    .select({
      name: venues.name,
      slug: venues.slug,
      city: venues.city,
      countryName: venues.countryName,
      countryCode: venues.countryCode,
      capacity: venues.capacity,
      lat: venues.latitude,
      lng: venues.longitude,
      wiki: venues.wikipediaUrl,
    })
    .from(venues)
    .orderBy(desc(venues.capacity))
    .limit(8);
  const teamsWithHome = await db
    .select({ c: count() })
    .from(teams)
    .where(isNotNull(teams.homeVenueId));
  const fixtureVenueLinked = await db
    .select({ c: count() })
    .from(fixtures)
    .where(isNotNull(fixtures.venueId));
  const compVenues = await db.execute(sql`
    select c.slug, c.name, count(distinct f.venue_id)::int as venue_count
    from fixtures f
    join competitions c on c.id = f.competition_id
    where f.venue_id is not null
    group by c.slug, c.name
    order by venue_count desc
    limit 12
  `);
  const homeTeamVenues = await db.execute(sql`
    select c.slug, c.name, count(distinct t.home_venue_id)::int as home_venue_count
    from fixtures f
    join competitions c on c.id = f.competition_id
    join teams t on t.id = f.home_team_id
    where t.home_venue_id is not null
    group by c.slug, c.name
    order by home_venue_count desc
    limit 12
  `);

  const topCap = await db
    .select({
      name: venues.name,
      slug: venues.slug,
      city: venues.city,
      countryName: venues.countryName,
      capacity: venues.capacity,
      lat: venues.latitude,
      lng: venues.longitude,
    })
    .from(venues)
    .where(isNotNull(venues.capacity))
    .orderBy(desc(venues.capacity))
    .limit(10);

  const byCountry = await db.execute(sql`
    select coalesce(nullif(trim(country_name), ''), '(unknown)') as country,
           count(*)::int as venue_count,
           count(*) filter (where capacity is not null)::int as with_cap,
           max(capacity) as max_cap,
           avg(capacity)::int as avg_cap
    from venues
    group by 1
    order by venue_count desc
    limit 20
  `);

  const comps = await db.execute(sql`
    select c.slug, c.name, c.competition_type,
      count(distinct f.venue_id)::int as fixture_venues,
      count(distinct t.home_venue_id)::int as home_venues
    from competitions c
    left join fixtures f on f.competition_id = c.id and f.venue_id is not null
    left join teams t on t.id = f.home_team_id and t.home_venue_id is not null
    group by c.slug, c.name, c.competition_type
    having count(distinct f.venue_id) > 0 or count(distinct t.home_venue_id) > 0
    order by greatest(count(distinct f.venue_id), count(distinct t.home_venue_id)) desc
    limit 15
  `);

  const intl = await db.execute(sql`
    select count(distinct v.id)::int as intl_venues
    from venues v
    join fixtures f on f.venue_id = v.id
    join competitions c on c.id = f.competition_id
    where lower(coalesce(c.competition_type, '')) = 'international'
  `);

  console.log(
    JSON.stringify(
      {
        total: total.c,
        withCoords: withCoords.c,
        withCapacity: withCapacity.c,
        largeCap: largeCap.c,
        withCountry: withCountry.c,
        withCode: withCode.c,
        countries: countries.c,
        teamsWithHomeVenue: teamsWithHome[0]?.c,
        fixturesWithVenueId: fixtureVenueLinked[0]?.c,
        topCountries: countryRows,
        topByCapacityNullFirst: sample,
        topByCapacity: topCap,
        byCountry: byCountry.rows,
        comps: comps.rows,
        intl: intl.rows,
        topCompVenuesFromFixtures: compVenues.rows,
        topCompHomeVenues: homeTeamVenues.rows,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
