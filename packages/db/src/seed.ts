import { loadCommentaryKnowledgeBase } from "@rugby365/commentary-research";
import { createDb } from "./client";
import { IDS } from "./ids";
import { seedCommentaryResearch } from "./seed-research";
import {
  sports,
  teams,
  fixtures,
  rugbyLaws,
  rugbyLawMappings,
  commentaryTemplates,
  commentaryRules,
} from "./schema/index";

const db = createDb();
const kb = loadCommentaryKnowledgeBase();

const laws = [
  { lawNumber: "8", category: "scoring", title: "Scoring", summary: "Try, conversion, penalty goal, drop goal" },
  { lawNumber: "9", category: "advantage", title: "Advantage", summary: "Advantage played and over" },
  { lawNumber: "10", category: "foul_play", title: "Foul play", summary: "Dangerous play and misconduct" },
  { lawNumber: "10.4", category: "offside", title: "Offside", summary: "Offside at ruck, lineout and kick" },
  { lawNumber: "11", category: "knock_on", title: "Knock-on", summary: "Knock-on and forward pass" },
  { lawNumber: "14", category: "tackle", title: "Tackle", summary: "Tackle, release, jackal" },
  { lawNumber: "15", category: "ruck", title: "Ruck", summary: "Ruck formation and use of hands" },
  { lawNumber: "16", category: "maul", title: "Maul", summary: "Maul law and collapse" },
  { lawNumber: "19", category: "scrum", title: "Scrum", summary: "Scrum feed, strike and reset" },
  { lawNumber: "18", category: "lineout", title: "Lineout", summary: "Lineout formation and throw" },
  { lawNumber: "17", category: "mark", title: "Mark", summary: "Fair catch mark" },
  { lawNumber: "12", category: "kick_off", title: "Kick-off", summary: "Kick-off and restart kicks" },
  { lawNumber: "9.7", category: "penalties", title: "Penalties", summary: "Penalty and free kick infringements" },
  { lawNumber: "9.28", category: "cards", title: "Cards", summary: "Yellow, red card and sin bin" },
  { lawNumber: "6", category: "tmo", title: "TMO", summary: "Television match official reviews" },
  { lawNumber: "3", category: "substitutions", title: "Substitutions", summary: "Player replacement and HIA" },
];

const templates = kb.rugby365Templates.map((t) => ({
  templateKey: t.templateKey,
  outputType: t.outputType,
  tone: t.tone,
  body: t.body,
}));

const rules = [
  {
    name: "Phase milestone in opposition 22",
    conditions: { event_type: "phase_milestone", zone: "opposition_22", phase_gte: 5 },
    templateKeys: [
      "phase_pressure_opp22_a",
      "phase_pressure_opp22_b",
      "phase_pressure_opp22_c",
      "phase_pressure_opp22_d",
    ],
    outputType: "phase_play_update",
    maxSuggestions: 4,
  },
  {
    name: "Try scored",
    conditions: { event_type: "try" },
    templateKeys: ["try_scored", "try_scored_alt", "score_update"],
    outputType: "major_event",
    maxSuggestions: 3,
  },
  {
    name: "Conversion",
    conditions: { event_type: "conversion" },
    templateKeys: ["conversion_good", "score_update"],
    outputType: "major_event",
    maxSuggestions: 2,
  },
  {
    name: "Conversion missed",
    conditions: { event_type: "conversion_missed" },
    templateKeys: ["conversion_missed"],
    outputType: "major_event",
    maxSuggestions: 1,
  },
  {
    name: "Penalty awarded",
    conditions: { event_type: "penalty" },
    templateKeys: ["penalty_awarded", "penalty_awarded_territory", "penalty_awarded_neutral"],
    outputType: "referee_decision",
    maxSuggestions: 3,
  },
  {
    name: "Yellow card",
    conditions: { event_type: "card_yellow" },
    templateKeys: ["card_yellow"],
    outputType: "referee_decision",
    maxSuggestions: 1,
  },
  {
    name: "Red card",
    conditions: { event_type: "card_red" },
    templateKeys: ["card_red"],
    outputType: "referee_decision",
    maxSuggestions: 1,
  },
  {
    name: "Substitution",
    conditions: { event_type: "substitution" },
    templateKeys: ["substitution_on"],
    outputType: "personnel",
    maxSuggestions: 1,
  },
  {
    name: "Half-time",
    conditions: { event_type: "half_time" },
    templateKeys: ["half_time"],
    outputType: "period",
    maxSuggestions: 1,
    autoApprove: true,
  },
  {
    name: "Full-time",
    conditions: { event_type: "full_time" },
    templateKeys: ["full_time", "full_time_summary"],
    outputType: "period",
    maxSuggestions: 2,
    autoApprove: true,
  },
  {
    name: "Score update",
    conditions: { event_type: "score_update" },
    templateKeys: ["score_update"],
    outputType: "score_update",
    maxSuggestions: 1,
    autoApprove: true,
  },
  {
    name: "Scrum",
    conditions: { event_type: "scrum" },
    templateKeys: ["scrum_in_progress", "scrum_feed"],
    outputType: "phase_play_update",
    maxSuggestions: 1,
  },
  {
    name: "Lineout",
    conditions: { event_type: "lineout" },
    templateKeys: ["lineout_in_progress", "lineout_won"],
    outputType: "phase_play_update",
    maxSuggestions: 1,
  },
  {
    name: "Turnover",
    conditions: { event_type: "turnover" },
    templateKeys: ["turnover_won"],
    outputType: "phase_play_update",
    maxSuggestions: 1,
  },
  {
    name: "TMO",
    conditions: { event_type: "tmo_decision" },
    templateKeys: ["tmo_review", "tmo_decision"],
    outputType: "referee_decision",
    maxSuggestions: 2,
  },
];

async function seed() {
  await db.insert(sports).values({
    id: IDS.sport,
    slug: "rugby-union",
    name: "Rugby Union",
    rulesConfig: { periods: 2, periodMinutes: 40 },
  }).onConflictDoNothing();

  await db.insert(teams).values([
    {
      id: IDS.teamSa,
      slug: "south-africa",
      name: "South Africa",
      shortName: "SA",
      imageUrl: "/crest-references/south-africa-official.png",
    },
    { id: IDS.teamBarb, slug: "barbarians", name: "Barbarians", shortName: "BAR" },
  ]).onConflictDoNothing();

  await db.insert(fixtures).values({
    id: IDS.fixture,
    slug: "demo-sa-barb",
    sportId: IDS.sport,
    homeTeamId: IDS.teamSa,
    awayTeamId: IDS.teamBarb,
    competitionName: "International Friendly",
    status: "live",
    homeScore: 12,
    awayScore: 7,
    matchMinute: 0,
    period: "first_half",
    kickoffAt: new Date(),
  }).onConflictDoNothing();

  const lawRows = await db.insert(rugbyLaws).values(laws).returning({ id: rugbyLaws.id, category: rugbyLaws.category });
  const lawByCat = Object.fromEntries(lawRows.map((r) => [r.category, r.id]));

  await db.insert(rugbyLawMappings).values([
    { eventType: "try", lawId: lawByCat.scoring, notes: "Try scored" },
    { eventType: "conversion", lawId: lawByCat.scoring },
    { eventType: "penalty", lawId: lawByCat.penalties, notes: "Penalty awarded" },
    { eventType: "card_yellow", lawId: lawByCat.cards },
    { eventType: "card_red", lawId: lawByCat.cards },
    { eventType: "substitution", lawId: lawByCat.substitutions },
    { eventType: "tmo_decision", lawId: lawByCat.tmo },
    { eventType: "scrum", lawId: lawByCat.scrum },
    { eventType: "lineout", lawId: lawByCat.lineout },
    { eventType: "maul", lawId: lawByCat.maul },
    { eventType: "turnover", lawId: lawByCat.tackle },
    { eventType: "phase_milestone", lawId: lawByCat.ruck },
  ]).onConflictDoNothing();

  await db.insert(commentaryTemplates).values(
    templates.map((t, i) => ({
      templateKey: t.templateKey,
      outputType: t.outputType,
      tone: t.tone ?? "neutral",
      body: t.body,
      priority: 100 - i,
      sportId: IDS.sport,
    })),
  ).onConflictDoNothing();

  await db.insert(commentaryRules).values(
    rules.map((r) => ({
      name: r.name,
      conditions: r.conditions,
      templateKeys: r.templateKeys,
      maxSuggestions: r.maxSuggestions,
      outputType: r.outputType,
      autoApprove: "autoApprove" in r ? r.autoApprove : false,
    })),
  ).onConflictDoNothing();

  await seedCommentaryResearch(db);

  console.log("Seed complete. Demo fixture slug: demo-sa-barb");
  console.log("Fixture ID:", IDS.fixture);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
