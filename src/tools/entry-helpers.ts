import { markdownToRichText } from "../transformers/notion-blocks.js";

export const DB_KEYS = [
  // Temporal / Ledger
  "activity_log", "days", "weeks", "months", "quarters", "years",
  // Tactical
  "tasks",
  // Journaling / Logs
  "subjective_journal", "relational_journal", "systemic_journal",
  "diet_log", "financial_log",
  // Strategic
  "projects", "campaigns", "content_pipeline", "people",
  "annual_goals", "quarterly_goals",
  "directives_risk_log", "opportunities_strengths",
  // Reference
  "activity_types", "reports", "notes_management"
] as const;

export type DbKey = typeof DB_KEYS[number];

// Maps snake_case property keys to their exact Notion property names
const PROPERTY_NAME_MAP: Record<string, string> = {
  // Dates
  date: "Date",
  action_date: "Action Date",
  publish_date: "Publish Date",
  start_date: "Start Date",
  end_date: "End Date",
  deadline: "Deadline",
  project_start: "Project Start",
  last_connected_date: "Last Connected Date",
  reconnect_by: "Reconnect By",

  // Status (all use "Status" in Notion)
  status: "Status",

  // Selects — tasks
  priority: "Priority",

  // Selects — systemic journal
  impact: "Impact",

  // Selects — financial log
  category: "Category",
  capital_engine: "Capital Engine",

  // Selects — content pipeline
  tone: "Tone",
  pillar: "Pillar",
  funnel_stage: "Funnel Stage",
  content_frequency: "Content Frequency",

  // Selects — campaigns
  platforms: "Platforms",
  content_types: "Content Types",
  format: "Format",
  automation_workflows: "Automation Workflows",

  // Selects — people
  relationship_status: "Relationship Status",
  networking_profile: "Networking Profile",
  value_exchange_balance: "Value Exchange Balance",
  desired_trajectory: "Desired Trajectory",
  city: "City",
  developmental_altitude: "Developmental Altitude",
  primary_center_of_intelligence: "Primary Center of Intelligence",
  aspirational_drive: "Aspirational Drive",
  core_shadow: "Core Shadow",
  primary_conflict_style: "Primary Conflict Style",
  temporal_focus: "Temporal Focus",
  dominant_power_strategy: "Dominant Power Strategy",
  influence_toolkit: "Influence Toolkit",
  stability_profile: "Stability Profile",
  explanatory_style: "Explanatory Style",

  // Selects — strategic
  log_type: "Log Type",
  likelihood: "Likelihood",
  leverage_score: "Leverage Score",
  goal_archetype: "Goal Archetype",

  // Selects — activity
  activity_type: "Activity Type",
  frequency: "Frequency",
  transaction_type: "Transaction Type",

  // Numbers
  amount: "Amount",
  target_reach: "Target Reach",
  connection_frequency: "In days Connection Frequency",
  progress: "Progress",

  // Rich text
  description: "Description",
  psychograph: "Psychograph",
  nutrition: "Nutrition",
  notes: "Notes",
  ai_generated_report: "AI Generated Report",
  strategy: "Strategy",
  kpi: "KPI",
  project_summary: "Project Summary",
  theme: "Theme",
  summary: "Summary",
  demographics: "Demographics",
  psychographics: "Psychographics",
  seo_keywords: "SEO Keywords",
  content_waterfall: "Content Waterfall",
  content_body: "Content Body",
  custom_name: "Custom Name",
  strategic_context: "Strategic Context",
  engagement_blueprint: "Engagement Blueprint",
  professional_domain: "Professional Domain & Influence",
  key_personal_intel: "Key Personal Intel",
  origin_context: "Origin Context",
  protocol_scenario: "Protocol / Scenario",
  description_activation: "Description & Activation",
  activity_notes: "Activity Notes",
  strategic_intent: "Strategic Intent",
  the_epic: "The Epic",
  target_value: "Target Value",
  success_condition: "Success Condition",
  key_risks: "Key Risks",
  strategic_approach: "Strategic Approach",
  key_result_1: "Key Result 1",
  key_result_2: "Key Result 2",
  key_result_3: "Key Result 3",
  key_learning: "Key Learning",
  threat_level: "Threat Level",
  last_assessed: "Last Assessed",
  report: "Report",
  agent: "Agent",
  key_learnings: "Key Learnings",
  significant_events: "Significant Events",

  // Relations
  projects: "Projects",
  people: "People",
  quarterly_goals: "Quarterly Goals",
  directives_risk_log: "Directives & Risk Log",
  opportunities_strengths: "Opportunities & Strengths Log",
  campaigns: "Campaigns",
  parent_content: "Parent Content",
  annual_goals: "Annual Goals",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
  quarters: "Quarters",
  years: "Years",
  systemic_journal: "Systemic Journal",
  subjective_journal: "Subjective Journal",
  relational_journal: "Relational Journal",
  diet_log: "Diet Log",
  content_pipeline: "Content Pipeline",
  financial_accounts: "Financial Accounts",
  activity_logs: "Activity Logs",
  financial_log: "Financial Log",
  tasks: "Tasks",
  parent_task: "Parent task",
  sub_task: "Sub-task",
  knowledge_categories: "Knowledge Categories",
};

// Fields that are formulas (read-only, skip in create/update)
const FORMULA_FIELDS = new Set([
  "monitor", "id", "habit", "logged", "duration",
  "day_name", "month_name", "week_name", "year_range",
  "month_range", "quarter_range",
  "sprint_status", "tasks_progress", "project_progress", "goal_progress",
  "actual_reach", "engagement_rate", "conversion_rate", "viral_score",
  "total_income", "total_expenses", "net_cashflow", "net_worth_change",
  "ending_net_worth", "category_summary", "accounts_snapshot",
  "capital_allocation_insight", "cashflow_narrative",
  "health", "kpi_status", "review_date", "projected_revenue",
  "required_budget", "cost_to_date", "revenue",
  "depends_on", "dependents", "justify_this_project",
  "activity_json", "subjective_json", "relational_json", "systemic_json",
  "diet_json", "financial_json", "drl_json", "quarterly_goal_json",
  "annual_goal_report", "quarter_report", "year_report", "day_json",
  "week_json", "month_json", "activity_breakdown",
  "project_status",
]);

// Fields that should be formatted as select
const SELECT_KEYS = new Set([
  "priority", "impact", "category", "capital_engine", "tone", "pillar",
  "funnel_stage", "content_frequency", "relationship_status", "networking_profile",
  "value_exchange_balance", "desired_trajectory", "city", "developmental_altitude",
  "primary_center_of_intelligence", "aspirational_drive", "core_shadow",
  "primary_conflict_style", "temporal_focus", "dominant_power_strategy",
  "stability_profile", "explanatory_style", "log_type", "likelihood",
  "leverage_score", "goal_archetype", "activity_type", "frequency",
  "transaction_type",
]);

// Fields that should be formatted as multi_select
const MULTI_SELECT_KEYS = new Set([
  "platforms", "content_types", "format", "influence_toolkit", "automation_workflows",
]);

// Fields that should be formatted as date
const DATE_KEYS = new Set([
  "date", "action_date", "publish_date", "start_date", "end_date",
  "deadline", "project_start", "last_connected_date", "reconnect_by",
  "last_assessed", "week_start", "week_end", "month_start", "month_end",
  "quarter_start", "quarter_end",
]);

// Fields that should be formatted as number
const NUMBER_KEYS = new Set([
  "amount", "target_reach", "connection_frequency", "progress",
  "reach", "clicks", "engagement",
  "week_number", "quarter_number", "month_number", "day_number",
]);

// Fields that should be formatted as URL
const URL_KEYS = new Set(["live_url"]);

// Fields that should be formatted as files (external URLs)
const FILE_KEYS = new Set(["media_assets"]);

const RELATION_KEYS: Record<string, string> = {
  projects: "Projects",
  people: "People",
  quarterly_goals: "Quarterly Goals",
  directives_risk_log: "Directives & Risk Log",
  opportunities_strengths: "Opportunities & Strengths Log",
  campaigns: "Campaigns",
  parent_content: "Parent Content",
  annual_goals: "Annual Goals",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
  quarters: "Quarters",
  years: "Years",
  systemic_journal: "Systemic Journal",
  subjective_journal: "Subjective Journal",
  relational_journal: "Relational Journal",
  diet_log: "Diet Log",
  content_pipeline: "Content Pipeline",
  financial_accounts: "Financial Accounts",
  activity_logs: "Activity Logs",
  financial_log: "Financial Log",
  tasks: "Tasks",
  parent_task: "Parent task",
  sub_task: "Sub-task",
  knowledge_categories: "Knowledge Categories",
};

export const TITLE_FIELD_MAP: Record<DbKey, string> = {
  tasks: "Tasks",
  activity_log: "Name",
  content_pipeline: "Content Name",
  campaigns: "Campaign",
  projects: "Project",
  people: "People",
  subjective_journal: "Name",
  relational_journal: "Name",
  systemic_journal: "Name",
  diet_log: "Name",
  financial_log: "Name",
  annual_goals: "Annual Theme",
  quarterly_goals: "Quarterly Objective",
  directives_risk_log: "Directive / Risk",
  opportunities_strengths: "Opportunity / Strength",
  reports: "Title",
  days: "Days",
  weeks: "Week",
  months: "Month",
  quarters: "Quarters",
  years: "Years",
  activity_types: "Activity Types",
  notes_management: "Title",
};

export const DB_DESCRIPTIONS: Record<DbKey, string> = {
  tasks: `Tasks — status (Active|Focus|Up Next|Waiting|Paused|Done|Delegated|Cancelled|Archived), priority (⭐⭐⭐⭐⭐|⭐⭐⭐⭐|⭐⭐⭐|⭐⭐|⭐|P1 - Critical|P2 - High), action_date (YYYY-MM-DD), description (text), projects (relation: array of page IDs)`,

  subjective_journal: `Subjective Journal — date (YYYY-MM-DD or ISO datetime YYYY-MM-DDTHH:MM), psychograph (text)`,

  relational_journal: `Relational Journal — date (YYYY-MM-DD or ISO datetime YYYY-MM-DDTHH:MM), people (relation: array of people page IDs)`,

  systemic_journal: `Systemic Journal — date (YYYY-MM-DD or ISO datetime YYYY-MM-DDTHH:MM), impact (P5: Note|P4: Low|P3: Medium|P2: High|P1: Critical), ai_generated_report (text), projects (relation), directives_risk_log (relation), opportunities_strengths (relation)`,

  diet_log: `Diet Log — date (YYYY-MM-DD or ISO datetime YYYY-MM-DDTHH:MM), nutrition (text)`,

  financial_log: `Financial Log — date (YYYY-MM-DD or ISO datetime YYYY-MM-DDTHH:MM), amount (number), category (Business Revenue|Pocket Money|Client Payment|Investment Income|Income|Investments/Trading|House Expenses|Food & Dining|Utilities|Family Times|Transportation|Business Expenses|Rent/Mortgage|Account Transfer|Miscellaneous), capital_engine (E (Employment)|S (Self-employment)|B (Business)|I (Investment)|Personal), notes (text), projects (relation)`,

  projects: `Projects — status (Active|Done|On Hold|Cancelled|Someday/Maybe|Delegated), priority (⭐⭐⭐⭐⭐|⭐⭐⭐⭐|⭐⭐⭐|⭐⭐|⭐), deadline (YYYY-MM-DD), project_start (YYYY-MM-DD), strategy (text), kpi (text), project_summary (text), progress (number 0-100), quarterly_goals (relation), people (relation), campaigns (relation)`,

  campaigns: `Campaign Management — theme (text), summary (text), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), platforms (LinkedIn|Instagram|Twitter/X|Substack|YouTube|TikTok), content_types (Carousels|Essays|Threads|Case Studies|Videos|Reels), content_frequency (Daily|3x/week|Weekly), target_reach (number), demographics (text), psychographics (text), seo_keywords (text), content_waterfall (text), projects (relation)`,

  content_pipeline: `Content Pipeline — status (Potential Idea|Scheduled|Next Up 🚩|Writing 📝|Recording ⏺|Editing 🎞|Ready to Post 📤|Published 💥), platforms (YouTube|Facebook|Instagram|X (Twitter)|Threads|LinkedIn|Blog|Medium|Substack), format (45-90 Sec Reel|5-10 Min Video|30-60 Min Podcast|Blog|Newsletter|FB/Linkedin/X Post), tone (Intellectual|Authentic/Vulnerable|Practical/How-to|Analytic|Urgent), pillar (P1: Meta-Theory|P2: AI Consulting|P3: LifeOS|P5: Counselling|P5: Activism), funnel_stage (TOFU (Awareness)|MOFU (Nurture)|BOFU (Conversion)), content_body (text), publish_date (YYYY-MM-DD), action_date (YYYY-MM-DD), live_url (URL), media_assets ([external URLs]), campaigns (relation), parent_content (relation)`,

  people: `People — custom_name (text), city (Noida|Janakpuri|Delhi|Greater Noida|Gurgaon|Ghaziabad|Faridabad|Meerut|Aligarh|Varanasi|Mumbai|Bihar|Dubai|Edison NJ|Chicago IL|Netherlands|US|Canada|Britain|Pune), relationship_status (Family Member|Mentor|Close Friend|Close Acquiantance|Coworker|Acquiantance), networking_profile (Key Ally|Active Collaborator|Mentor / Advisor|Protégé / Mentee|Peer / Sounding Board|Inactive|Archive), value_exchange_balance (I am in Credit|Balanced|I am in Debt), desired_trajectory (Deepen|Maintain|Activate|Graceful Exit|Inactive), last_connected_date (YYYY-MM-DD), connection_frequency (number: days), summary (text), strategic_context (text), developmental_altitude (LVL 3-7), primary_center_of_intelligence (Cognitive|Affective|Somatic), aspirational_drive (Security & Stability|Connection & Belonging|Status & Recognition|Mastery & Impact|Growth & Understanding), core_shadow (Fear of Insignificance|Fear of Rejection|Fear of Chaos/Uncertainty|Fear of Powerlessness/Domination), primary_conflict_style (Competing|Accommodating|Avoiding|Collaborating|Compromising), temporal_focus (Operational|Tactical|Strategic|Legacy), dominant_power_strategy (Directing|Collaborating|Inspiring|Mastering|Gatekeeping), influence_toolkit (multi_select), projects (relation)`,

  activity_log: `Activity Log — date (YYYY-MM-DD), start_time (HH:MM or ISO), end_time (HH:MM or ISO), activity_type (select), activity_notes (text), projects (relation), days (relation). Note: duration is auto-calculated (formula, read-only). Use start_time + end_time for time-ranged entries, or ISO datetime (YYYY-MM-DDTHH:MM) on date directly.`,

  annual_goals: `Annual Goals — status (Active|Done|On Hold|Cancelled|Someday/Maybe), strategic_intent (text), the_epic (text), target_value (text), success_condition (text), key_risks (text), strategic_approach (text), goal_archetype (Achieve|Build|Become|Maintain), quarterly_goals (relation), years (relation)`,

  quarterly_goals: `Quarterly Goals — status (On Track|At Risk|Blocked|Complete), key_result_1 (text), key_result_2 (text), key_result_3 (text), annual_goals (relation), projects (relation), key_learning (text)`,

  directives_risk_log: `Directives & Risk Log — status (Identified|Monitoring|Mitigated|Resolved), log_type (Directive|Risk), likelihood (Low|Medium|High), impact (Low|Medium|High), threat_level (text), protocol_scenario (text), last_assessed (YYYY-MM-DD), projects (relation), quarterly_goals (relation), systemic_journal (relation)`,

  opportunities_strengths: `Opportunities & Strengths Log — status (Identified|Activated|Leveraged|Archived), log_type (Opportunity|Strength), leverage_score (Seed|Medium-Impact|High-Leverage), description_activation (text), last_assessed (YYYY-MM-DD), projects (relation), quarterly_goals (relation), systemic_journal (relation)`,

  reports: `Reports — report (text), agent (text)`,

  days: `Days — date (YYYY-MM-DD), day_number (number), status (Active|Done|Archived), activity_logs (relation), subjective_journal (relation), systemic_journal (relation), relational_journal (relation), diet_log (relation), weeks (relation), months (relation)`,

  weeks: `Weeks — week_number (number), week_start (YYYY-MM-DD), week_end (YYYY-MM-DD), status (Active|Done|Archived), days (relation), tasks (relation), financial_log (relation), key_learnings (text)`,

  months: `Months — month_number (number), month_start (YYYY-MM-DD), month_end (YYYY-MM-DD), status (Active|Done|Archived), days (relation), quarters (relation), financial_log (relation), quarterly_goals (relation), significant_events (text), key_learnings (text)`,

  quarters: `Quarters — quarter_number (number), quarter_start (YYYY-MM-DD), quarter_end (YYYY-MM-DD), status (Active|Done|Archived), months (relation), years (relation), quarterly_goals (relation), key_learnings (text)`,

  years: `Years — status (Active|Done|Archived), quarters (relation), annual_goals (relation)`,

  activity_types: `Activity Types — frequency (Daily|Weekly|Monthly|Ad-hoc), duration (number: hours), habit (Yes|No)`,

  notes_management: `Notes Management — status (New Note|Live|Priority/Highlight|Archived Note), projects (relation: array of project page IDs), knowledge_categories (relation: array of category page IDs). Use this for large notes, meeting notes, research notes, and knowledge capture. Supports rich markdown content as page body.`,
};

export interface PropertyBuilderResult {
  properties: Record<string, unknown>;
  children: Record<string, unknown>[];
}

export function buildNotionProperties(
  dbKey: DbKey,
  name: string,
  props: Record<string, unknown>
): PropertyBuilderResult {
  const notionProps: Record<string, unknown> = {};
  const children: Record<string, unknown>[] = [];

  const titleField = TITLE_FIELD_MAP[dbKey] || "Name";
  notionProps[titleField] = { title: [{ text: { content: name } }] };

  processProperties(dbKey, props, notionProps, children);

  return { properties: notionProps, children };
}

export function buildUpdateProperties(
  dbKey: DbKey,
  props: Record<string, unknown>
): Record<string, unknown> {
  const notionProps: Record<string, unknown> = {};
  const children: Record<string, unknown>[] = [];

  // Get the title field name for this database
  const titleField = TITLE_FIELD_MAP[dbKey] || "Name";
  
  // Handle title/name updates - check for generic keys AND the actual Notion property name
  const titleValue = (
    "title" in props ? props.title :
    "name" in props ? props.name :
    titleField in props ? props[titleField] :
    undefined
  ) as string | undefined;
  
  if (titleValue !== undefined) {
    notionProps[titleField] = { title: [{ text: { content: titleValue } }] };
    // Remove title/name keys from props to avoid double-processing
    delete props.title;
    delete props.name;
    delete props[titleField as keyof typeof props];
  }

  processProperties(dbKey, props, notionProps, children);

  return notionProps;
}

function processProperties(
  _dbKey: DbKey,
  props: Record<string, unknown>,
  notionProps: Record<string, unknown>,
  _children: Record<string, unknown>[]
): void {
  // Handle date property — supports three formats:
  // 1. Time-ranged: date + start_time + end_time (e.g., "2026-04-03", "10:30", "11:45")
  // 2. ISO datetime: date string containing "T" (e.g., "2026-04-03T10:30:00+05:30")
  // 3. Date only: simple date string (e.g., "2026-04-03")
  const startTime = props.start_time as string | undefined;
  const endTime = props.end_time as string | undefined;
  const baseDate = props.date as string | undefined;

  if (baseDate) {
    const datePropName = PROPERTY_NAME_MAP["date"] || "Date";

    if (startTime || endTime) {
      // Format 1: Time range with base date
      const toDateTime = (base: string | undefined, time: string): string => {
        if (time.includes("T")) return time;
        const basePart = base ? base : "2026-01-01";
        return `${basePart}T${time}:00+05:30`;
      };
      const startVal = startTime ? toDateTime(baseDate, startTime) : baseDate;
      const endVal = endTime ? toDateTime(baseDate, endTime) : undefined;
      if (startVal) {
        const dateObj: Record<string, string> = { start: startVal };
        if (endVal) dateObj.end = endVal;
        notionProps[datePropName] = { date: dateObj };
      }
    } else if (baseDate.includes("T")) {
      // Format 2: Full ISO datetime string — use as start, no end
      notionProps[datePropName] = { date: { start: baseDate } };
    } else {
      // Format 3: Date only
      notionProps[datePropName] = { date: { start: baseDate } };
    }
  }

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;

    // Skip synthetic time fields and date (already handled above)
    if (key === "start_time" || key === "end_time" || key === "date") continue;

    // Skip formula fields (read-only)
    if (FORMULA_FIELDS.has(key)) continue;

    // Resolve the Notion property name
    const notionName = PROPERTY_NAME_MAP[key];
    if (!notionName) {
      // Unknown property — try using the key as-is with spaces
      notionProps[key] = { rich_text: markdownToRichText(String(value)) };
      continue;
    }

    // Date properties (date itself handled at top of function)
    if (DATE_KEYS.has(key)) {
      const val = value as string;
      notionProps[notionName] = { date: { start: val } };
      continue;
    }

    // Number properties
    if (NUMBER_KEYS.has(key)) {
      notionProps[notionName] = { number: value as number };
      continue;
    }

    // URL properties
    if (URL_KEYS.has(key)) {
      notionProps[notionName] = { url: value as string };
      continue;
    }

    // Files (external URLs)
    if (FILE_KEYS.has(key)) {
      const arr = Array.isArray(value) ? (value as unknown[]) : [value];
      const files = arr
        .map((v) => String(v))
        .filter((u) => u.length > 0)
        .map((u) => ({ name: u.split("/").pop() || "asset", external: { url: u } }));
      notionProps[notionName] = { files } as unknown as Record<string, unknown>;
      continue;
    }

    // Relation properties
    if (key in RELATION_KEYS) {
      const arr = Array.isArray(value) ? (value as string[]) : [String(value)];
      notionProps[notionName] = { relation: arr.map(id => ({ id })) };
      continue;
    }

    // Status properties
    if (key === "status") {
      notionProps[notionName] = { status: { name: value as string } };
      continue;
    }

    // Multi-select properties
    if (MULTI_SELECT_KEYS.has(key)) {
      const arr = Array.isArray(value) ? (value as string[]) : [String(value)];
      notionProps[notionName] = { multi_select: arr.map(v => ({ name: v })) };
      continue;
    }

    // Select properties
    if (SELECT_KEYS.has(key)) {
      notionProps[notionName] = { select: { name: value as string } };
      continue;
    }

    // Everything else — treat as rich text
    notionProps[notionName] = { rich_text: markdownToRichText(String(value)) };
  }
}
