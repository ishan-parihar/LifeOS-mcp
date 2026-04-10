import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbsByAgent } from "../config.js";

// Minimal, deterministic context cards that orient agents to LifeOS.
// Compact output (400-800 tokens target) with agent-scoped DB map,
// routing tips, property conventions, and top recipes.

type AgentKind =
  | "strategic" // CEO Strategic
  | "productivity" // COO Productivity
  | "financial" // CFO Financial
  | "content" // CMO Content Creator
  | "relational" // CRO Relational Counsellor
  | "medical" // Physician/Dietician/Nutritionist
  | "psycho"; // Psycho-Spiritual Coach

const AGENT_ENUM = z.enum([
  // Executive roles
  "strategic", // CEO Strategic
  "productivity", // COO Productivity
  "financial", // CFO Financial
  "content", // CMO Content Creator
  "relational", // CRO Relational Counsellor
  // Practice roles
  "medical", // Physician/Dietician/Nutritionist
  "psycho", // Psycho-Spiritual Coach
]);

const DETAIL_ENUM = z.enum(["compact", "schemas", "workflows", "all"]);

function listDbsForAgent(config: LifeOSConfig, agent: AgentKind): Array<[string, string]> {
  // Map agent roles to the subset of databases they typically use.
  // We reuse getDbsByAgent for core domains, and compose for non-core roles.
  const core: Record<string, string> = {};
  const push = (key: string) => {
    const db = config.databases[key];
    if (db) core[key] = db.name;
  };

  if (agent === "productivity") {
    Object.assign(core, Object.fromEntries(Object.entries(getDbsByAgent(config, "productivity")).map(([k, v]) => [k, v.name])));
  } else if (agent === "strategic") {
    Object.assign(core, Object.fromEntries(Object.entries(getDbsByAgent(config, "strategic")).map(([k, v]) => [k, v.name])));
    // CEO often needs risks/opps, people, and systemic journal
    push("directives_risk_log");
    push("opportunities_strengths");
    push("people");
    push("systemic_journal");
  } else if (agent === "content") {
    // Content-creator focuses on campaigns/content_pipeline (+ projects link)
    push("campaigns");
    push("content_pipeline");
    push("projects");
  } else if (agent === "financial") {
    push("financial_log");
    push("weeks");
    push("months");
    push("projects");
  } else if (agent === "relational") {
    push("people");
    push("relational_journal");
    push("projects");
  } else if (agent === "medical") {
    // Health domain: diet/activity + tasks/reports for follow-ups
    push("diet_log");
    push("activity_log");
    push("tasks");
    push("reports");
  } else if (agent === "psycho") {
    // Psycho-Spiritual: journals + directives/opportunities + projects
    push("subjective_journal");
    push("relational_journal");
    push("systemic_journal");
    push("directives_risk_log");
    push("opportunities_strengths");
    push("projects");
  }

  return Object.entries(core).sort(([a], [b]) => a.localeCompare(b));
}

function displayName(agent: AgentKind): string {
  const map: Record<AgentKind, string> = {
    strategic: "CEO — Strategic",
    productivity: "COO — Productivity",
    financial: "CFO — Financial",
    content: "CMO — Content Creator",
    relational: "CRO — Relational Counsellor",
    medical: "Medical — Physician/Dietician/Nutritionist",
    psycho: "Psycho-Spiritual Coach",
  };
  return map[agent];
}

function compactCard(config: LifeOSConfig, agent: AgentKind, version: string): string {
  const lines: string[] = [];
  // Staff ID style header (no persona text, only operations context)
  lines.push(`# LifeOS Staff ID — ${displayName(agent)} (v${version})`);
  lines.push("");

  // Databases map (agent-scoped)
  lines.push("## Databases (agent-scoped)");
  for (const [key, name] of listDbsForAgent(config, agent)) {
    lines.push(`- ${name} (\`${key}\`)`);
  }
  lines.push("");

  // Tool Routing (intent → tool)
  lines.push("## Tool Routing");
  if (agent === "content") {
    lines.push("- Find items → lifeos_find_entry(database='content_pipeline', search='…')");
    lines.push("- Create content → lifeos_create_entry(database='content_pipeline', name='…', properties={…})");
    lines.push("- Update status/URL → lifeos_update_entry(database='content_pipeline', page_id='…', properties={status:'…', live_url:'…'})");
    lines.push("- Campaign overview → lifeos_projects / lifeos_quarterly_goals for alignment; lifeos_query on campaigns/content_pipeline for custom filters");
  } else if (agent === "strategic") {
    lines.push("- Quick scan → lifeos_context_card(agent='strategic', detail='compact')");
    lines.push("- OKR progress → lifeos_okrs_progress()");
    lines.push("- Project health → lifeos_project_health()");
    lines.push("- Risk landscape → lifeos_directives_risks()");
    lines.push("- Opportunities → lifeos_opportunities_strengths()");
    lines.push("- Alignment check → lifeos_alignment()");
    lines.push("- Cross-domain synthesis → lifeos_journal_synthesis(period='past_week')");
    lines.push("- Weekly posture → lifeos_weekly_review()");
    lines.push("- Monthly synthesis → lifeos_monthly_synthesis()");
    lines.push("- Quarterly retro → lifeos_quarterly_retrospective()");
    lines.push("- Cross-domain correlations → lifeos_correlate(period='past_month')");
    lines.push("- Temporal patterns → lifeos_temporal_analysis(period='past_month')");
    lines.push("- CRUD writes → lifeos_create_entry / lifeos_update_entry / lifeos_journal_entry(type='systemic')");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='…') (zero context bloat)");
  } else if (agent === "productivity") {
    lines.push("- Today/Week → lifeos_daily_briefing(), lifeos_productivity_report(period='past_week')");
    lines.push("- Trajectory → lifeos_trajectory(period='past_week'), lifeos_weekday_patterns(period='past_month')");
    lines.push("- Tasks → lifeos_tasks(status='Active'|overdue_only=true)");
  } else if (agent === "financial") {
    lines.push("- Log transactions → lifeos_create_entry(database='financial_log', …)");
    lines.push("- Month synthesis → lifeos_temporal_analysis(period='past_month', include_financial=true)");
  } else if (agent === "relational") {
    lines.push("- Find person → lifeos_find_entry(database='people', search='…')");
    lines.push("- Update cadence → lifeos_update_entry(database='people', page_id='…', properties={last_connected_date:'YYYY-MM-DD'})");
  } else if (agent === "medical") {
    lines.push("- Review diet/activity → lifeos_diet_log(period), lifeos_activity_log(period)");
    lines.push("- Targets → lifeos_trajectory(period), lifeos_weekday_patterns(period)");
    lines.push("- Act → lifeos_create_entry(database='tasks', …) for adherence tasks; lifeos_create_report for recommendations");
  } else if (agent === "psycho") {
    lines.push("- Journals → lifeos_subjective_journal / lifeos_relational_journal / lifeos_systemic_journal");
    lines.push("- Translate to action → lifeos_directives_risks / lifeos_opportunities_strengths (create/update)");
    lines.push("- Project linkage → lifeos_find_entry + lifeos_update_entry to connect insights to execution");
  }
  lines.push("");

  // Property Conventions (global, compact)
  lines.push("## Property Conventions");
  lines.push("- Dates: 'YYYY-MM-DD' strings (use Action Date/Publish Date/Deadline appropriately)");
  lines.push("- Status: use exact status names defined in each DB; confirm via lifeos_discover(verbose=true)");
  lines.push("- Relations: pass page_ids arrays (resolve via lifeos_find_entry first)");
  lines.push("- Read-only: formula fields are ignored on update (safe to pass only updatable fields)");
  lines.push("");

  // Top Recipes (agent-scoped, 2–3 lines)
  lines.push("## Top Recipes");
  if (agent === "content") {
    lines.push("- Publish flow: find → update status='Published 💥' with live_url → later update metrics {reach, clicks, engagement}");
    lines.push("- Next-up queue: list Next Up 🚩 via lifeos_query on content_pipeline, then update status → Writing/Recording/Editing");
  } else if (agent === "strategic") {
    lines.push("- Morning scan: context_card → okrs_progress → project_health → directives_risks → HEARTBEAT_OK or flag");
    lines.push("- Weekly review: okrs_progress + project_health + alignment + journal_synthesis → weekly_review → systemic_journal entries for cross-domain patterns");
    lines.push("- Monthly session: monthly_synthesis + correlate + temporal_analysis → strategic recalibration");
    lines.push("- Quarterly retro: quarterly_retrospective → lessons learned → next quarter recommendations");
    lines.push("- Systemic journal: write when cross-domain patterns detected (P1-P5 impact assessment)");
  } else if (agent === "productivity") {
    lines.push("- Morning planning: lifeos_daily_briefing → pick 3 tasks via lifeos_tasks(status='Focus')");
    lines.push("- Weekly review: lifeos_productivity_report(period='past_week') → lifeos_create_report(save)");
  } else if (agent === "financial") {
    lines.push("- Month close: ensure financial_log entries complete → run temporal_analysis include_financial");
  } else if (agent === "relational") {
    lines.push("- Interaction log: update 'Last Connected Date' and create relational_journal entry");
  } else if (agent === "medical") {
    lines.push("- Adherence loop: compare diet/activity vs targets → create tasks for gaps → review weekly");
  } else if (agent === "psycho") {
    lines.push("- Insight to directive: synthesize journals → create DRL/opportunities entries → link to projects");
  }

  // Cross-Domain Utilities (what this agent can/must explore across domains)
  lines.push("");
  lines.push("## Cross-Domain Utilities");
  if (agent === "strategic") {
    lines.push("- Content/campaign alignment → lifeos_content, lifeos_campaigns (read-only, CMO executes)");
    lines.push("- Strategic relationships → lifeos_people_ops (key allies/mentors only, not day-to-day reconnects)");
    lines.push("- Cross-domain context → read subjective_journal (CPO), relational_journal (CRO), reports (COO) for synthesis");
    lines.push("- CEO writes ONLY to: annual_goals, quarterly_goals, projects (strategic fields), directives_risk_log, opportunities_strengths, systemic_journal");
    lines.push("- CEO NEVER writes to: tasks, activity_log, days, weeks, subjective_journal, relational_journal, financial_log, diet_log, reports");
  } else if (agent === "productivity") {
    lines.push("- Project health context → lifeos_projects, lifeos_quarterly_goals");
    lines.push("- Journal-driven tasks → lifeos_systemic_journal → lifeos_create_entry(tasks)");
  } else if (agent === "financial") {
    lines.push("- Project-linked spend → lifeos_projects, lifeos_query(financial_log, relation=Projects)");
    lines.push("- Campaign ROI context → lifeos_campaigns, lifeos_content");
  } else if (agent === "content") {
    lines.push("- OKR linkage → lifeos_quarterly_goals, lifeos_projects");
    lines.push("- Financial targets → lifeos_financial_log (metrics follow-up)");
  } else if (agent === "relational") {
    lines.push("- Project stakeholders → lifeos_projects (People relation)");
    lines.push("- Journal insight → lifeos_relational_journal → tasks");
  } else if (agent === "medical") {
    lines.push("- Productivity impact → lifeos_daily_briefing / lifeos_trajectory");
    lines.push("- Strategic risks → lifeos_directives_risks when health affects execution");
  } else if (agent === "psycho") {
    lines.push("- Strategic alignment → link directives/opportunities to projects/goals");
    lines.push("- Productivity nudges → create tasks for practices/habits");
  }

  return lines.join("\n");
}

function schemasCard(config: LifeOSConfig, agent: AgentKind): string {
  const lines: string[] = [];
  lines.push(`# Schemas — ${agent}`);
  lines.push("");
  for (const [key, name] of listDbsForAgent(config, agent)) {
    const db = config.databases[key];
    lines.push(`## ${name} (\`${key}\`)`);
    for (const [propKey, propName] of Object.entries(db.properties)) {
      lines.push(`- \`${propKey}\` → "${propName}"`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function workflowsCard(agent: AgentKind): string {
  const lines: string[] = [];
  lines.push(`# Workflows — ${agent}`);
  lines.push("");
  if (agent === "content") {
    lines.push("1) Publish: find content → update status='Published 💥', live_url");
    lines.push("2) Metrics: list published without metrics → update reach/clicks/engagement");
    lines.push("3) Calendar: filter upcoming by Publish Date → adjust dates as needed");
  } else if (agent === "strategic") {
    lines.push("1) context_card → scan for signals → okrs_progress + project_health for detail");
    lines.push("2) Cross-domain: journal_synthesis + alignment → systemic_journal entries");
    lines.push("3) Quarterly: quarterly_retrospective → lessons learned → next quarter OKRs");
  } else if (agent === "productivity") {
    lines.push("1) Briefing → tasks focus selection → log activities");
    lines.push("2) Trajectory gaps → create tasks to address deficits");
  } else if (agent === "psycho") {
    lines.push("1) Write journal → link to day/project → capture insights in systemic_journal");
  } else if (agent === "financial") {
    lines.push("1) Enter transactions → weekly/monthly synthesis → save report");
  } else if (agent === "relational") {
    lines.push("1) Refresh cadence → log interaction → update engagement blueprint if needed");
  }
  return lines.join("\n");
}

export function registerContextCardTool(
  server: McpServer,
  config: LifeOSConfig,
  _notion: unknown
) {
  server.tool(
    "lifeos_context_card",
    "Agent-scoped initial context to orient AI agents to LifeOS. Compact, deterministic, and cacheable. Use detail='compact' for startup, then request 'schemas' or 'workflows' on demand.",
    {
      agent: AGENT_ENUM.describe("Agent role (affects which DBs and recipes are shown)"),
      detail: DETAIL_ENUM.optional().describe("Detail level: 'compact'|'schemas'|'workflows'|'all' (default: 'compact')"),
    },
    async ({ agent, detail = "compact" }) => {
      const version = "0.5.0"; // Keep in sync with server version
      let blocks: string[] = [];
      if (detail === "compact" || detail === "all") {
        blocks.push(compactCard(config, agent as AgentKind, version));
      }
      if (detail === "schemas" || detail === "all") {
        blocks.push(schemasCard(config, agent as AgentKind));
      }
      if (detail === "workflows" || detail === "all") {
        blocks.push(workflowsCard(agent as AgentKind));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: blocks.join("\n\n"),
          },
        ],
      };
    }
  );
}
