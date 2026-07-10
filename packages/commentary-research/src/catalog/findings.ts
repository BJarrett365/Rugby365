import type { CommentaryResearchFinding, ReferenceProvider, RugbyEventType } from "../schemas";

type FindingInput = Omit<CommentaryResearchFinding, "id">;

function fid(provider: ReferenceProvider, eventType: string): string {
  return `${provider}:${eventType}`;
}

type FindingOverrides = Pick<FindingInput, "researchNotes" | "templateGuidance" | "rugby365TemplateKeys"> & {
  rugbyLawCategories?: string[];
  style?: Partial<FindingInput["style"]>;
  presentation?: Partial<FindingInput["presentation"]>;
};

function baseFinding(
  provider: ReferenceProvider,
  eventType: RugbyEventType,
  category: string,
  overrides: FindingOverrides,
): CommentaryResearchFinding {
  const defaults: FindingInput = {
    provider,
    eventType,
    category,
    style: {
      ordering: "immediate",
      frequency: "on_every_event",
      importance: "medium",
    },
    presentation: {
      minuteFormat: "{minute}'",
      includesScore: false,
      includesTeam: true,
      includesPlayer: false,
      includesReason: false,
      includesLocation: false,
      sentenceLength: "short",
      tone: "neutral",
    },
    researchNotes: overrides.researchNotes,
    templateGuidance: overrides.templateGuidance,
    rugby365TemplateKeys: overrides.rugby365TemplateKeys,
    rugbyLawCategories: overrides.rugbyLawCategories,
  };
  return {
    id: fid(provider, eventType),
    ...defaults,
    ...overrides,
    style: { ...defaults.style, ...overrides.style },
    presentation: { ...defaults.presentation, ...overrides.presentation },
  };
}

/** Structural commentary research — no copyrighted text samples. */
export function buildResearchFindings(): CommentaryResearchFinding[] {
  const findings: CommentaryResearchFinding[] = [];

  const providers: ReferenceProvider[] = [
    "planet_rugby",
    "sport365",
    "espn_scrum",
    "statscore",
    "all_rugby",
  ];

  const eventMatrix: Record<
    RugbyEventType,
    {
      category: string;
      laws?: string[];
      templates: string[];
      guidance: string;
      notes: Record<ReferenceProvider, string>;
      style?: Partial<FindingInput["style"]>;
      presentation?: Partial<FindingInput["presentation"]>;
    }
  > = {
    try: {
      category: "scoring",
      laws: ["scoring"],
      templates: ["try_scored", "try_scored_alt", "score_update"],
      guidance:
        "Announce immediately on confirmation. Name scoring team and player when known. Follow with updated score. Tone can lift slightly but stay factual.",
      notes: {
        planet_rugby: "Match centre promotes try to top of incident feed; scoreboard updates synchronously.",
        sport365: "Type 34 incident; score array updates on same row; often paired with conversion within 1–2 minutes.",
        espn_scrum: "Timeline icon for try; often two entries (try then scoreline) in quick succession.",
        statscore: "Major event type; triggers auto-publish tier; may batch conversion separately.",
        all_rugby: "N/A for live commentary; entity graph links player to club for post-match stats only.",
      },
      style: { ordering: "immediate", frequency: "on_every_event", importance: "critical" },
      presentation: {
        includesScore: true,
        includesPlayer: true,
        sentenceLength: "medium",
        tone: "celebratory",
        grouping: "score_cluster",
      },
    },
    conversion: {
      category: "scoring",
      laws: ["scoring"],
      templates: ["conversion_good", "score_update"],
      guidance: "Follow try within short window. Name kicker if known. State new score.",
      notes: {
        planet_rugby: "Listed as separate incident after try; score tick +2.",
        sport365: "Type 35; follows type 34 at same or next minute.",
        espn_scrum: "Often grouped visually under try cluster; separate timestamp.",
        statscore: "Secondary scoring event; may share cooldown group with try.",
        all_rugby: "N/A live.",
      },
      style: { ordering: "immediate", frequency: "high", importance: "high" },
      presentation: { includesScore: true, includesPlayer: true, tone: "factual" },
    },
    conversion_missed: {
      category: "scoring",
      laws: ["scoring"],
      templates: ["conversion_missed"],
      guidance: "Note miss briefly; no score change beyond try points.",
      notes: {
        planet_rugby: "Shown as missed kick incident when SDMS provides type.",
        sport365: "Type 143 observed on rugby pages; score unchanged from prior try.",
        espn_scrum: "Short line; lower visual weight than successful conversion.",
        statscore: "Low-importance scoring attempt event.",
        all_rugby: "N/A live.",
      },
      style: { frequency: "medium", importance: "medium" },
      presentation: { includesTeam: true, includesPlayer: true, sentenceLength: "short" },
    },
    drop_goal: {
      category: "scoring",
      laws: ["scoring"],
      templates: ["drop_goal_scored", "score_update"],
      guidance: "Immediate; name team and kicker; three-point score update.",
      notes: {
        planet_rugby: "Less frequent; surfaced in incident list with score change.",
        sport365: "Distinct incident type when available.",
        espn_scrum: "Distinct timeline entry; often single line plus score.",
        statscore: "Mapped scoring event with auto template.",
        all_rugby: "N/A live.",
      },
      style: { importance: "high" },
      presentation: { includesScore: true, includesPlayer: true },
    },
    penalty_goal: {
      category: "scoring",
      laws: ["scoring", "penalties"],
      templates: ["penalty_goal_scored", "score_update"],
      guidance: "After penalty award or direct shot; team and kicker; +3 score.",
      notes: {
        planet_rugby: "Penalty goal shown in incidents with kicker name when known.",
        sport365: "May appear as scoring incident separate from penalty award.",
        espn_scrum: "Two-step pattern possible: penalty then goal.",
        statscore: "Separate event types for award vs goal common.",
        all_rugby: "N/A live.",
      },
      style: { importance: "high" },
      presentation: { includesScore: true, includesReason: false },
    },
    penalty: {
      category: "referee",
      laws: ["penalties"],
      templates: ["penalty_awarded", "penalty_awarded_territory", "penalty_awarded_neutral"],
      guidance:
        "Usually announced immediately. Team named. Reason included when known from facts; use unknown otherwise. Location optional from zone field.",
      notes: {
        planet_rugby: "Referee section in match centre; territory context in stats view.",
        sport365: "May appear in comms or as phase stoppage; team inference from context.",
        espn_scrum: "Frequent timeline entries; reason often abbreviated; team always stated.",
        statscore: "Referee_decision output type; operator approval tier on ambiguity.",
        all_rugby: "N/A live commentary.",
      },
      style: { ordering: "immediate", frequency: "high", importance: "high" },
      presentation: {
        includesTeam: true,
        includesReason: true,
        includesLocation: true,
        sentenceLength: "medium",
        tone: "factual",
      },
    },
    scrum: {
      category: "set_piece",
      laws: ["scrum"],
      templates: ["scrum_in_progress", "scrum_feed"],
      guidance: "Shorter lines during sustained phase play; name feeding team when known.",
      notes: {
        planet_rugby: "Set-piece context in live text feed; lower priority than scores.",
        sport365: "Phase milestone rather than every scrum reset in data feed.",
        espn_scrum: "Grouped under phase play unless penalty follows.",
        statscore: "phase_play_update; cooldown to avoid spam.",
        all_rugby: "N/A.",
      },
      style: { frequency: "medium", importance: "low", ordering: "end_of_phase" },
      presentation: { sentenceLength: "short", tone: "neutral", grouping: "phase_play" },
    },
    lineout: {
      category: "set_piece",
      laws: ["lineout"],
      templates: ["lineout_in_progress", "lineout_won"],
      guidance: "Brief; team throwing in or winning when fact available.",
      notes: {
        planet_rugby: "Lineout noted in phase updates.",
        sport365: "Sparse in incident feed unless turnover follows.",
        espn_scrum: "Low-frequency timeline entries.",
        statscore: "Template with cooldown.",
        all_rugby: "N/A.",
      },
      style: { frequency: "low", importance: "low" },
      presentation: { sentenceLength: "short", grouping: "phase_play" },
    },
    maul: {
      category: "phase_play",
      laws: ["maul"],
      templates: ["maul_in_progress"],
      guidance: "Use sparingly; note driving team when in opposition 22 or near try line.",
      notes: {
        planet_rugby: "Maul mentioned in live narrative during attacks.",
        sport365: "Rarely discrete incident; phase milestone proxy.",
        espn_scrum: "Grouped with phase pressure language.",
        statscore: "Low-frequency phase update.",
        all_rugby: "N/A.",
      },
      style: { frequency: "low", importance: "low", ordering: "end_of_phase" },
      presentation: { grouping: "phase_play" },
    },
    ruck: {
      category: "phase_play",
      laws: ["ruck"],
      templates: ["phase_pressure_opp22_a", "phase_pressure_opp22_b"],
      guidance: "Phase count milestones in attacking third; avoid per-ruck spam.",
      notes: {
        planet_rugby: "Sustained pressure described in multi-phase sequences.",
        sport365: "Not per-ruck; use phase_milestone synthetic events.",
        espn_scrum: "Commentary cadence drops between major events; phase bursts at milestones.",
        statscore: "phase_milestone rule with zone and phase_gte conditions.",
        all_rugby: "N/A.",
      },
      style: { frequency: "medium", importance: "medium", ordering: "batched", cadenceSeconds: { min: 15, max: 45 } },
      presentation: { grouping: "phase_play", includesLocation: true },
    },
    turnover: {
      category: "phase_play",
      laws: ["tackle", "ruck"],
      templates: ["turnover_won"],
      guidance: "Name team winning possession; immediate when confirmed.",
      notes: {
        planet_rugby: "Turnover highlighted when leads to attack.",
        sport365: "Inferred from possession change in some feeds.",
        espn_scrum: "Standalone timeline event with moderate prominence.",
        statscore: "Medium importance; may require approval if unclear.",
        all_rugby: "N/A.",
      },
      style: { importance: "medium" },
      presentation: { includesTeam: true, sentenceLength: "short" },
    },
    card_yellow: {
      category: "disciplinary",
      laws: ["cards"],
      templates: ["card_yellow"],
      guidance: "Immediate; player and team required; sin-bin duration not stated unless fact.",
      notes: {
        planet_rugby: "Card in incident feed with player name.",
        sport365: "Type 10 incidents observed; player on row.",
        espn_scrum: "High-prominence timeline; isolated from phase play.",
        statscore: "High-risk; operator approval default.",
        all_rugby: "N/A live.",
      },
      style: { importance: "critical", frequency: "on_every_event" },
      presentation: { includesPlayer: true, tone: "factual" },
    },
    card_red: {
      category: "disciplinary",
      laws: ["cards"],
      templates: ["card_red"],
      guidance: "Immediate; player and team; match state impact noted if fact.",
      notes: {
        planet_rugby: "Red card top of feed; score context retained.",
        sport365: "Rare type in incident data.",
        espn_scrum: "Maximum timeline prominence.",
        statscore: "Always operator approval.",
        all_rugby: "N/A.",
      },
      style: { importance: "critical" },
      presentation: { includesPlayer: true, tone: "factual" },
    },
    substitution: {
      category: "personnel",
      laws: ["substitutions"],
      templates: ["substitution_on"],
      guidance: "Player on (and off if known); team named; often paired entries.",
      notes: {
        planet_rugby: "Sub list in match centre; live text on change.",
        sport365: "Type 1 with pl_name and pl_name_o fields.",
        espn_scrum: "Grouped pair on/off in timeline.",
        statscore: "High-risk attribution; approval if player unclear.",
        all_rugby: "Squad graph useful for verifying club linkage post-match.",
      },
      style: { frequency: "high", importance: "medium" },
      presentation: { includesPlayer: true, grouping: "substitution_pair" },
    },
    injury: {
      category: "personnel",
      laws: ["substitutions"],
      templates: ["injury_stoppage"],
      guidance: "Only when confirmed stoppage; no speculation; player if official.",
      notes: {
        planet_rugby: "Injury stoppage in feed when HIA or stretcher.",
        sport365: "Not always discrete; avoid inventing.",
        espn_scrum: "Separate from substitution until confirmed.",
        statscore: "High-risk; facts-only.",
        all_rugby: "N/A live.",
      },
      style: { importance: "high" },
      presentation: { tone: "neutral", sentenceLength: "short" },
    },
    tmo_decision: {
      category: "referee",
      laws: ["tmo"],
      templates: ["tmo_review", "tmo_decision"],
      guidance: "Two-phase: review announced, then outcome; never prejudge.",
      notes: {
        planet_rugby: "TMO listed in officials block; live text on decision.",
        sport365: "Sparse; use only when feed confirms.",
        espn_scrum: "Distinct review and outcome lines.",
        statscore: "referee_decision; always approval.",
        all_rugby: "N/A.",
      },
      style: { ordering: "batched", importance: "critical" },
      presentation: { tone: "factual", grouping: "tmo_sequence" },
    },
    referee_decision: {
      category: "referee",
      laws: ["advantage", "penalties"],
      templates: ["referee_decision"],
      guidance: "Advantage over, penalty reversal, or formal decision; facts only.",
      notes: {
        planet_rugby: "Referee decisions in incident narrative.",
        sport365: "Context-dependent.",
        espn_scrum: "Isolated timeline entries.",
        statscore: "Operator tier.",
        all_rugby: "N/A.",
      },
      style: { importance: "high" },
      presentation: { includesTeam: true, includesReason: true },
    },
    score_update: {
      category: "scoring",
      laws: ["scoring"],
      templates: ["score_update"],
      guidance: "Compact scoreline; both team names; after any score change.",
      notes: {
        planet_rugby: "Scoreboard always visible; text reinforces after events.",
        sport365: "Score array on each scoring incident.",
        espn_scrum: "Repeated after major scoring sequences.",
        statscore: "Auto-publish safe tier when sources agree.",
        all_rugby: "N/A.",
      },
      style: { frequency: "high", importance: "high" },
      presentation: {
        includesScore: true,
        scoreAnnouncementStyle: "home_score_away_compact",
        sentenceLength: "short",
      },
    },
    half_time: {
      category: "period",
      laws: ["kick_off"],
      templates: ["half_time"],
      guidance: "Score at interval; no speculation on second half.",
      notes: {
        planet_rugby: "HT status on match header.",
        sport365: "Status code / status_txt half-time.",
        espn_scrum: "Summary block at HT.",
        statscore: "Period milestone auto event.",
        all_rugby: "N/A.",
      },
      style: { ordering: "period_break", importance: "critical", frequency: "on_every_event" },
      presentation: { includesScore: true, sentenceLength: "medium", tone: "factual" },
    },
    full_time: {
      category: "period",
      laws: ["scoring"],
      templates: ["full_time", "full_time_summary"],
      guidance: "Final score; optional brief factual summary from facts (tries count if available).",
      notes: {
        planet_rugby: "FT status; link to report.",
        sport365: "Status 6 / FT.",
        espn_scrum: "Match summary section follows.",
        statscore: "Auto-publish when status confirmed.",
        all_rugby: "N/A.",
      },
      style: { ordering: "post_match", importance: "critical" },
      presentation: { includesScore: true, sentenceLength: "medium" },
    },
    phase_milestone: {
      category: "phase_play",
      laws: ["ruck"],
      templates: [
        "phase_pressure_opp22_a",
        "phase_pressure_opp22_b",
        "phase_pressure_opp22_c",
        "phase_pressure_opp22_d",
      ],
      guidance: "Multi-phase pressure in opposition 22; rotate templates; phase count from facts.",
      notes: {
        planet_rugby: "Narrative multi-phase attacks in live text.",
        sport365: "Synthetic from phase count not raw feed.",
        espn_scrum: "Bursts between set pieces.",
        statscore: "Core automated phase template set.",
        all_rugby: "N/A.",
      },
      style: {
        frequency: "medium",
        importance: "medium",
        ordering: "batched",
        cadenceSeconds: { min: 20, max: 60 },
      },
      presentation: { includesLocation: true, grouping: "phase_play", tone: "analytical" },
    },
  };

  for (const eventType of Object.keys(eventMatrix) as RugbyEventType[]) {
    const spec = eventMatrix[eventType];
    for (const provider of providers) {
      if (provider === "all_rugby" && spec.notes.all_rugby === "N/A live.") continue;
      if (provider === "all_rugby" && spec.notes.all_rugby === "N/A.") continue;
      if (provider === "all_rugby" && spec.notes.all_rugby.startsWith("N/A")) continue;

      findings.push(
        baseFinding(provider, eventType, spec.category, {
          researchNotes: spec.notes[provider],
          templateGuidance: spec.guidance,
          rugby365TemplateKeys: spec.templates,
          rugbyLawCategories: spec.laws,
          ...(spec.style ? { style: spec.style } : {}),
          ...(spec.presentation ? { presentation: spec.presentation } : {}),
        }),
      );
    }
  }

  return findings;
}
