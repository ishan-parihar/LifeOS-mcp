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
  | "psycho" // Psycho-Spiritual Coach
  | "intelligence" // CIO Intelligence
  | "technical"; // CTO Technical

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
  "intelligence", // CIO Intelligence
  "technical", // CTO Technical
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
    // CMO Content Creator: WRITE to content_pipeline/campaigns/projects(content)/reports, READ temporal+context
    push("content_pipeline");
    push("campaigns");
    push("projects");
    push("quarterly_goals");
    push("annual_goals");
    push("activity_log");
    push("weeks");
    push("months");
    push("financial_log");
    push("people");
    push("reports");
  } else if (agent === "financial") {
    push("financial_log");
    push("projects");
    push("weeks");
    push("months");
    push("quarterly_goals");
    push("annual_goals");
    push("activity_log");
    push("tasks");
    push("reports");
    push("days");
    push("directives_risk_log");
  } else if (agent === "relational") {
    // CRO Relational: WRITE to people/relational_journal/campaigns, READ temporal+context
    push("people");
    push("relational_journal");
    push("campaigns");
    push("days");
    push("weeks");
    push("months");
    push("activity_log");
    push("subjective_journal");
    push("projects");
    push("reports");
  } else if (agent === "medical") {
    // Medical — Physician/Dietician/Nutritionist: WRITE diet_log/tasks/reports/directives_risk_log, READ health+activity+finance
    push("diet_log"); // WRITE — primary
    push("activity_log"); // READ — physical activity, workouts
    push("days"); // READ — health_score, vitality
    push("weeks"); // READ — health trends
    push("months"); // READ — monthly synthesis
    push("tasks"); // WRITE — health-related tasks
    push("reports"); // WRITE — health analysis reports
    push("subjective_journal"); // READ — emotional eating patterns
    push("activity_types"); // READ — workout targets
    push("projects"); // READ — health projects
    push("financial_log"); // READ — health spending
    push("directives_risk_log"); // WRITE — health risks
  } else if (agent === "psycho") {
    // Psycho-Spiritual: journals + directives/opportunities + projects + temporal + health
    push("subjective_journal");
    push("relational_journal");
    push("systemic_journal");
    push("directives_risk_log");
    push("opportunities_strengths");
    push("projects");
    push("days");
    push("weeks");
    push("months");
    push("activity_log");
    push("diet_log");
    push("reports");
  } else if (agent === "intelligence") {
    push("projects");
    push("quarterly_goals");
    push("annual_goals");
    push("content_pipeline");
    push("campaigns");
    push("financial_log");
    push("people");
    push("relational_journal");
    push("activity_log");
    push("weeks");
    push("months");
    push("reports");
    push("directives_risk_log");
  } else if (agent === "technical") {
    push("tech_debt"); // WRITE — primary
    push("system_health"); // WRITE — primary
    push("upgrade_log"); // WRITE — primary
    push("projects"); // READ — technical project context
    push("reports"); // READ — cross-reference technical reports
    push("days"); // READ — daily health correlation
    push("weeks"); // READ — weekly technical trends
    push("months"); // READ — monthly synthesis context
    push("activity_log"); // READ — operational activity correlation
    push("directives_risk_log"); // READ — technical risk context
    push("directives_risk_log"); // WRITE — technical risks
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
    intelligence: "CIO — Intelligence",
    technical: "CTO — Technical",
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
    lines.push("- Find content → lifeos_find_entry(database='content_pipeline', search='…')");
    lines.push("- Update content → lifeos_update_entry(database='content_pipeline', page_id='…', properties={status:'Published 💥', live_url:'…', metrics:{…}})");
    lines.push("- Campaign management → lifeos_query(database='campaigns') / lifeos_update_entry(database='campaigns', …)");
    lines.push("- Content performance → lifeos_temporal_analysis(period='past_month') for content trends");
    lines.push("- Publishing schedule → lifeos_weekday_patterns(period='past_month') for optimal timing");
    lines.push("- Cross-domain correlations → lifeos_correlate(period='past_month')");
    lines.push("- Content reports → lifeos_create_report(name='…', content='…', period='…')");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='…') (zero context bloat)");
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
    lines.push("- Morning briefing → lifeos_daily_briefing(date='YYYY-MM-DD')");
    lines.push("- Weekly productivity → lifeos_productivity_report(period='past_week')");
    lines.push("- Monthly productivity → lifeos_productivity_report(period='past_month')");
    lines.push("- Target trajectory → lifeos_trajectory(period='past_week'|'past_month')");
    lines.push("- Weekday patterns → lifeos_weekday_patterns(period='past_month', include_today=true)");
    lines.push("- Temporal trends → lifeos_temporal_analysis(period='past_week'|'past_month')");
    lines.push("- Cross-domain correlations → lifeos_correlate(period='past_week')");
    lines.push("- Active tasks → lifeos_tasks(status='Active'|'Focus')");
    lines.push("- Overdue tasks → lifeos_tasks(overdue_only=true)");
    lines.push("- Recent activities → lifeos_activity_log(period='past_week')");
    lines.push("- Energy/mood trends → lifeos_activity_log includes energy (High/Med/Low) and mood_delta (↑/→/↓) per entry");
    lines.push("- Log activity → lifeos_log_activity(activity_type='…', duration=…, date='…')");
    lines.push("- Complete task → lifeos_complete_task(task_id='…')");
    lines.push("- CRUD writes → lifeos_create_entry / lifeos_update_entry / lifeos_create_report");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='…') (zero context bloat)");
  } else if (agent === "financial") {
    lines.push("- Log transaction → lifeos_create_entry(database='financial_log', properties={amount, category, type, ...})");
    lines.push("- Query finances → lifeos_query(database='financial_log', filter_property='category', filter_value='...')");
    lines.push("- Project budget → lifeos_project_health() for budget vs actual tracking");
    lines.push("- Monthly trends → lifeos_temporal_analysis(period='past_month', include_financial=true)");
    lines.push("- Cashflow trajectory → lifeos_trajectory(period='past_week'|'past_month')");
    lines.push("- Cross-domain correlations → lifeos_correlate(period='past_month')");
    lines.push("- Financial reports → lifeos_create_report(name='...', content='...', period='...')");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='...') (zero context bloat)");
  } else if (agent === "relational") {
    lines.push("- Find person → lifeos_find_entry(database='people', search='…')");
    lines.push("- Update people → lifeos_update_entry(database='people', page_id='…', properties={…})");
    lines.push("- Log interaction → lifeos_create_entry(database='relational_journal', properties={…})");
    lines.push("- Campaign management → lifeos_query(database='campaigns') / lifeos_update_entry(database='campaigns', …)");
    lines.push("- Temporal context → lifeos_daily_briefing / lifeos_weekday_patterns / lifeos_temporal_analysis");
    lines.push("- Network health → lifeos_correlate(period='past_week'|'past_month')");
    lines.push("- Cross-domain → lifeos_relational_journal(period='past_week')");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='…') (zero context bloat)");
  } else if (agent === "medical") {
    lines.push("- Review diet → lifeos_query(database='diet_log', filter_property='date', filter_value='…')");
    lines.push("- Activity patterns → lifeos_activity_log(period='past_week'|'past_month')");
    lines.push("- Daily health → lifeos_daily_briefing(date='YYYY-MM-DD') — includes health_score");
    lines.push("- Health trends → lifeos_temporal_analysis(period='past_month', scope='health')");
    lines.push("- Adherence → lifeos_trajectory(period='past_week'|'past_month') for compliance tracking");
    lines.push("- Cross-domain → lifeos_correlate(period='past_month') for health correlations");
    lines.push("- Health reports → lifeos_create_report(name='…', content='…', period='…')");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='…') (zero context bloat)");
  } else if (agent === "psycho") {
    lines.push("- Journals → lifeos_subjective_journal / lifeos_relational_journal / lifeos_systemic_journal");
    lines.push("- Translate to action → lifeos_directives_risks / lifeos_opportunities_strengths (create/update)");
    lines.push("- Project linkage → lifeos_find_entry + lifeos_update_entry to connect insights to execution");
    lines.push("- Temporal context → lifeos_daily_briefing / lifeos_weekday_patterns / lifeos_temporal_analysis");
    lines.push("- Emotional correlation → lifeos_activity_log (energy/mood), lifeos_health_vitality");
    lines.push("- Cross-journal themes → lifeos_journal_synthesis(period='past_week'|'past_month')");
    lines.push("- Write emotional entry → lifeos_create_entry(database='subjective_journal', properties={…})");
    lines.push("- Write risk/opportunity → lifeos_create_entry(database='directives_risk_log'|'opportunities_strengths', properties={…})");
  } else if (agent === "intelligence") {
    lines.push("- Project intelligence → lifeos_projects, lifeos_project_health() for research alignment");
    lines.push("- Strategic context → lifeos_quarterly_goals / lifeos_annual_goals (OKR themes to monitor externally)");
    lines.push("- Content/campaign landscape → lifeos_query(database='content_pipeline'|'campaigns') for external angles");
    lines.push("- Financial market context → lifeos_financial_log (market trends correlation)");
    lines.push("- Network intelligence → lifeos_people / lifeos_relational_journal (external contacts, relationship signals)");
    lines.push("- Temporal patterns → lifeos_temporal_analysis(period='past_week'|'past_month') for trend trajectories");
    lines.push("- Intelligence reports → lifeos_create_entry(database='reports', properties={name, content, period})");
    lines.push("- External risk flagging → lifeos_create_entry(database='directives_risk_log', properties={...}) for market/competitive threats");
  } else if (agent === "technical") {
    lines.push("- System health scan → lifeos_query(database='system_health') for component status");
    lines.push("- Technical debt → lifeos_query(database='tech_debt', filter_property='severity', filter_value='P1'|'P2')");
    lines.push("- Upgrade pipeline → lifeos_query(database='upgrade_log', filter_property='status', filter_value='...')");
    lines.push("- Daily context → lifeos_daily_briefing(date='YYYY-MM-DD') — includes health_score");
    lines.push("- Temporal trends → lifeos_temporal_analysis(period='past_week'|'past_month') for system trends");
    lines.push("- Technical reports → lifeos_create_entry(database='reports', properties={name, content, period})");
    lines.push("- Risk flagging → lifeos_create_entry(database='directives_risk_log', properties={...}) for technical risks");
    lines.push("- Schema on-demand → lifeos_query_db_schema(database='…') (zero context bloat)");
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
    lines.push("- Content cadence: weekly review → pipeline health → identify gaps → schedule next week");
    lines.push("- Campaign tracking: lifeos_query(campaigns) → update metrics → correlate with reach/engagement/conversion");
    lines.push("- Monthly synthesis: temporal_analysis → content-waterfall effectiveness → ROI calculation");
    lines.push("- Platform optimization: weekday_patterns → identify best posting times → adjust schedule");
  } else if (agent === "strategic") {
    lines.push("- Morning scan: context_card → okrs_progress → project_health → directives_risks → HEARTBEAT_OK or flag");
    lines.push("- Weekly review: okrs_progress + project_health + alignment + journal_synthesis → weekly_review → systemic_journal entries for cross-domain patterns");
    lines.push("- Monthly session: monthly_synthesis + correlate + temporal_analysis → strategic recalibration");
    lines.push("- Quarterly retro: quarterly_retrospective → lessons learned → next quarter recommendations");
    lines.push("- Systemic journal: write when cross-domain patterns detected (P1-P5 impact assessment)");
  } else if (agent === "productivity") {
    lines.push("- Morning planning: lifeos_daily_briefing → pick 3 tasks via lifeos_tasks(status='Focus') → flag anomalies");
    lines.push("- Weekly review: lifeos_productivity_report(past_week) → lifeos_trajectory → save to reports DB");
    lines.push("- Monthly synthesis: lifeos_productivity_report(past_month) → lifeos_temporal_analysis → habit compliance");
    lines.push("- Systemic flagging: detect sustained productivity decline → message.send to CEO (do NOT write to systemic_journal)");
    lines.push("- Evening review: compare day vs targets → suggest tomorrow's focus tasks");
    lines.push("- Energy optimization: track energy patterns in activity_log → correlate with task completion → schedule Focus tasks during High energy windows");
    lines.push("- Health check: review days DB health_score for daily vitality trends");
  } else if (agent === "financial") {
    lines.push("- Transaction logging: categorize → log to financial_log → update project budget if linked");
    lines.push("- Weekly cashflow: financial_log(past_week) → income vs expenses → budget compliance check");
    lines.push("- Monthly close: temporal_analysis(past_month) → P&L → variance analysis → save report");
    lines.push("- Budget tracking: project_health → compare budget vs actual → flag overruns");
    lines.push("- Quarterly review: correlate financial OKRs with actuals → capital reallocation recommendations");
  } else if (agent === "relational") {
    lines.push("- Interaction log: detect story → draft → user approval → create relational_journal + update people");
    lines.push("- Network scan: lifeos_find_entry(people) → identify dormant/reconnect → propose actions");
    lines.push("- Campaign tracking: lifeos_query(campaigns) → update metrics → correlate with reach/engagement");
    lines.push("- Weekly health review: relational_journal(past_week) → value exchange analysis → reconnect priorities");
    lines.push("- Monthly synthesis: lifeos_temporal_analysis → network growth metrics → dormant relationship alerts");
  } else if (agent === "medical") {
    lines.push("- Adherence loop: compare diet/activity vs targets → create tasks for gaps → review weekly");
    lines.push("- Nutritional analysis: diet_log(past_week) → macro/micro balance → deficiency detection → recommendations");
    lines.push("- Health score tracking: days DB health_score trends → correlate with activity/diet → intervention if declining");
    lines.push("- Monthly synthesis: temporal_analysis → comprehensive health assessment → trajectory report");
    lines.push("- Preventive reminders: schedule checkups, screenings, vaccination reminders → create tasks");
  } else if (agent === "psycho") {
    lines.push("- Insight to directive: synthesize journals → create DRL/opportunities entries → link to projects");
    lines.push("- Daily scan: lifeos_subjective_journal(past_day) → 5D score → correlate with activity energy/mood");
    lines.push("- Weekly review: lifeos_journal_synthesis(past_week) → activity_log correlation → flag burnout signals");
    lines.push("- Monthly synthesis: lifeos_temporal_analysis(past_month) → recurring theme analysis → growth opportunities");
    lines.push("- Cross-domain: correlate emotional patterns with project health, financial stress, task completion");
  } else if (agent === "intelligence") {
    lines.push("- Signal detection: external scan → filter noise vs signal → save intelligence brief to reports");
    lines.push("- Trend analysis: temporal_analysis → trajectory assessment → cross-domain correlation → flag to relevant agents");
    lines.push("- Strategic intelligence: quarterly_goals alignment → paradigm shift detection → CEO briefing");
    lines.push("- Competitive intelligence: campaigns/content_pipeline → external competitive landscape → strategic implications");
    lines.push("- Research synthesis: academic/technical sources → relevance assessment → actionable insights for team");
  } else if (agent === "technical") {
    lines.push("- Health check: system_health → identify degraded components → investigate root cause → propose fix");
    lines.push("- Debt management: tech_debt → prioritize by severity → resolution planning → track to completion");
    lines.push("- Upgrade flow: propose upgrade → risk assessment → rollback plan → CEO approval → execute");
    lines.push("- Weekly review: aggregate week's technical data → trend analysis → save to reports DB");
    lines.push("- Monthly synthesis: temporal_analysis → system health trends → capacity planning recommendations");
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
    lines.push("- Project health context → lifeos_projects, lifeos_quarterly_goals (read-only for task alignment)");
    lines.push("- Journal-driven tasks → lifeos_systemic_journal (read CEO's insights) → lifeos_create_entry(tasks)");
    lines.push("- COO writes ONLY to: activity_log (with energy/mood_delta), tasks (with tags/estimated_hours), days (with health_score), weeks, months, reports");
    lines.push("- COO NEVER writes to: annual_goals, quarterly_goals, directives_risk_log, opportunities_strengths, systemic_journal, subjective_journal, relational_journal, financial_log, diet_log");
    lines.push("- Flag systemic patterns to CEO via message.send — do NOT write to systemic_journal");
  } else if (agent === "financial") {
    lines.push("- Project financials → lifeos_projects (budget, ROI fields — read/write financial only)");
    lines.push("- Operational cost correlation → lifeos_activity_log (billable vs non-billable time)");
    lines.push("- Emotional spending → lifeos_subjective_journal (stress spending patterns — read only)");
    lines.push("- Relationship ROI → lifeos_relational_journal (networking expenses vs yield — read only)");
    lines.push("- CFO writes ONLY to: financial_log, projects(financial), weeks(financial), months(financial), directives_risk_log(financial risks)");
    lines.push("- CFO NEVER writes to: annual_goals, quarterly_goals, systemic_journal, subjective_journal, relational_journal, diet_log, tasks");
  } else if (agent === "content") {
    lines.push("- OKR alignment → lifeos_quarterly_goals (content targets — read only)");
    lines.push("- Content budget → lifeos_financial_log (campaign spend context — read only)");
    lines.push("- Audience insights → lifeos_relational_journal (relationship-driven content — read only)");
    lines.push("- Content production time → lifeos_activity_log (creation time tracking — read only)");
    lines.push("- CMO writes ONLY to: content_pipeline, campaigns, projects(content fields), reports(content analysis)");
    lines.push("- CMO NEVER writes to: tasks, systemic_journal, subjective_journal, directives_risk_log, opportunities_strengths, diet_log, people");
  } else if (agent === "relational") {
    lines.push("- Project stakeholders → lifeos_projects (People relation)");
    lines.push("- Emotional correlation → lifeos_activity_log (energy/mood) vs relational capacity");
    lines.push("- Temporal awareness → lifeos_daily_briefing for operational context correlation");
    lines.push("- CRO writes ONLY to: relational_journal (with approval), people (with approval), campaigns");
    lines.push("- CRO NEVER writes to: tasks, systemic_journal, reports, days, weeks, months, directives_risk_log, opportunities_strengths");
  } else if (agent === "medical") {
    lines.push("- Productivity impact → lifeos_daily_briefing / lifeos_trajectory (health affecting output)");
    lines.push("- Emotional eating → lifeos_subjective_journal (stress eating patterns — read only)");
    lines.push("- Health budget → lifeos_financial_log (supplement/medical spend — read only)");
    lines.push("- Physician writes ONLY to: diet_log, tasks(health), reports(health), directives_risk_log(health risks)");
    lines.push("- Physician NEVER writes to: systemic_journal, opportunities_strengths, relational_journal, content_pipeline, campaigns, annual_goals, quarterly_goals, tech_debt, system_health, upgrade_log");
  } else if (agent === "psycho") {
    lines.push("- Energy correlation → lifeos_activity_log (energy/mood_delta) vs 5D scores");
    lines.push("- Health patterns → lifeos_health_vitality + lifeos_diet_log for physical-emotional link");
    lines.push("- Temporal awareness → lifeos_daily_briefing for operational context correlation");
    lines.push("- Strategic alignment → link directives/opportunities to projects/goals");
    lines.push("- Productivity nudges → create tasks for practices/habits");
  } else if (agent === "intelligence") {
    lines.push("- Strategic alignment → lifeos_annual_goals / lifeos_quarterly_goals (read-only, CEO owns)");
    lines.push("- Operational context → lifeos_activity_log (research time vs value generated)");
    lines.push("- External risk routing → directives_risk_log (external threats only — not internal risks)");
    lines.push("- CIO writes ONLY to: reports (intelligence briefs), projects(intelligence fields), directives_risk_log(external risks)");
    lines.push("- CIO NEVER writes to: tasks, systemic_journal, subjective_journal, relational_journal, diet_log, content_pipeline, campaigns, financial_log, people, annual_goals, quarterly_goals");
  } else if (agent === "technical") {
    lines.push("- Operational impact → lifeos_activity_log (how technical issues affect productivity — read only)");
    lines.push("- Strategic context → lifeos_projects (technical alignment with goals — read only)");
    lines.push("- CTO writes ONLY to: tech_debt, system_health, upgrade_log, directives_risk_log(technical risks)");
    lines.push("- CTO NEVER writes to: systemic_journal, tasks, annual_goals, quarterly_goals, subjective_journal, relational_journal, financial_log, diet_log, content_pipeline, campaigns, people");
    lines.push("- Flag technical systemic patterns to CEO via message.send — do NOT write to systemic_journal");
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
    lines.push("1) Daily: content cadence check → publishing → engagement monitoring → metrics logging");
    lines.push("2) Weekly: content_pipeline(past_week) → performance by platform → pipeline health → campaign progress");
    lines.push("3) Monthly: temporal_analysis → content synthesis → waterfall effectiveness → ROI report");
  } else if (agent === "strategic") {
    lines.push("1) context_card → scan for signals → okrs_progress + project_health for detail");
    lines.push("2) Cross-domain: journal_synthesis + alignment → systemic_journal entries");
    lines.push("3) Quarterly: quarterly_retrospective → lessons learned → next quarter OKRs");
  } else if (agent === "productivity") {
    lines.push("1) Morning: daily_briefing → task focus selection → log activities → flag anomalies");
    lines.push("2) Weekly: productivity_report + trajectory → temporal_analysis → save report → flag CEO if systemic");
    lines.push("3) Monthly: productivity_report(past_month) + temporal_analysis → habit compliance review");
    lines.push("4) Gap detection: trajectory gaps → create tasks to address deficits");
  } else if (agent === "psycho") {
    lines.push("1) Journal to insight: write subjective_journal → link to day → analyze patterns → flag CEO for systemic patterns");
    lines.push("2) Risk detection: identify burnout signals → create DRL entry → notify CEO if crisis-level");
    lines.push("3) Growth mapping: spot resilience patterns → create opportunity entry → link to projects for activation");
  } else if (agent === "financial") {
    lines.push("1) Daily: transaction review → categorize → update cash position → flag anomalies");
    lines.push("2) Weekly: financial_log(past_week) → cashflow analysis → budget compliance → upcoming obligations");
    lines.push("3) Monthly: temporal_analysis → P&L close → variance report → runway calculation");
  } else if (agent === "relational") {
    lines.push("1) Morning: reconnect priorities → story detection → user approval → log interaction");
    lines.push("2) Weekly: relational_journal(past_week) → network health analysis → update people profiles");
    lines.push("3) Monthly: temporal_analysis → campaign effectiveness → network growth report");
  } else if (agent === "medical") {
    lines.push("1) Daily: diet review → activity check → health_score update → flag concerns");
    lines.push("2) Weekly: nutritional adequacy → workout compliance → adherence gaps → recommendations");
    lines.push("3) Monthly: comprehensive health assessment → deficiency detection → trajectory analysis → save report");
  } else if (agent === "intelligence") {
    lines.push("1) Daily: external scan → signal triage → noise filtering → intelligence brief");
    lines.push("2) Weekly: temporal_analysis → trend trajectories → cross-domain correlation → save digest");
    lines.push("3) Monthly: landscape synthesis → early warning detection → strategic implications → flag CEO");
  } else if (agent === "technical") {
    lines.push("1) Daily: system_health scan → tech_debt review → upgrade_log check → flag issues");
    lines.push("2) Weekly: tech_debt aging analysis → upgrade progress review → trend assessment → save report");
    lines.push("3) Monthly: temporal_analysis → system health trajectory → architectural recommendations → save synthesis");
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
