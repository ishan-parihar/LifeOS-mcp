import { markdownToRichText } from "../transformers/notion-blocks.js";

export const DB_KEYS = [
  "tasks", "subjective_journal", "relational_journal", "systemic_journal",
  "diet_log", "financial_log", "projects", "campaigns", "content_pipeline", "people"
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

  // Relations
  projects: "Projects",
  people: "People",
  quarterly_goals: "Quarterly Goals",
  directives_risk_log: "Directives & Risk Log",
  opportunities_strengths: "Opportunities & Strengths Log",
  campaigns: "Campaigns",
  parent_content: "Parent Content",
  annual_goals: "Annual Goals",

  // URL
  live_url: "Live URL",
};

// Fields that are formulas (read-only, skip in create/update)
const FORMULA_FIELDS = new Set([
  "monitor", "id", "habit", "logged", "duration", "activity_type",
  "day_name", "day_number", "month_number", "month_name", "week_number", "week_name",
  "month_range", "quarter_range", "year_range", "week_start", "week_end",
  "month_start", "month_end", "quarter_start", "quarter_end",
  "sprint_status", "tasks_progress", "project_progress", "goal_progress",
  "reconnect_by", "actual_reach", "engagement_rate", "conversion_rate", "viral_score",
  "engagement", "clicks", "reach", "duration",
  "total_income", "total_expenses", "net_cashflow", "net_worth_change",
  "ending_net_worth", "category_summary", "accounts_snapshot",
  "capital_allocation_insight", "cashflow_narrative",
  "health", "kpi_status", "review_date", "projected_revenue",
  "required_budget", "cost_to_date", "revenue",
  "depends_on", "dependents", "justify_this_project",
  "significant_events", "key_learnings",
]);

// Fields that should be formatted as select
const SELECT_KEYS = new Set([
  "priority", "impact", "category", "capital_engine", "tone", "pillar",
  "funnel_stage", "content_frequency", "relationship_status", "networking_profile",
  "value_exchange_balance", "desired_trajectory", "city", "developmental_altitude",
  "primary_center_of_intelligence", "aspirational_drive", "core_shadow",
  "primary_conflict_style", "temporal_focus", "dominant_power_strategy",
  "stability_profile", "explanatory_style", "log_type", "likelihood",
  "leverage_score", "goal_archetype",
]);

// Fields that should be formatted as multi_select
const MULTI_SELECT_KEYS = new Set([
  "platforms", "content_types", "format", "influence_toolkit", "automation_workflows",
]);

// Fields that should be formatted as date
const DATE_KEYS = new Set([
  "date", "action_date", "publish_date", "start_date", "end_date",
  "deadline", "project_start", "last_connected_date", "reconnect_by",
]);

// Fields that should be formatted as number
const NUMBER_KEYS = new Set([
  "amount", "target_reach", "connection_frequency", "progress",
]);

// Fields that should be formatted as URL
const URL_KEYS = new Set(["live_url"]);

const RELATION_KEYS: Record<string, string> = {
  projects: "Projects",
  people: "People",
  quarterly_goals: "Quarterly Goals",
  directives_risk_log: "Directives & Risk Log",
  opportunities_strengths: "Opportunities & Strengths Log",
  campaigns: "Campaigns",
  parent_content: "Parent Content",
  annual_goals: "Annual Goals",
};

export const TITLE_FIELD_MAP: Record<DbKey, string> = {
  tasks: "Tasks",
  content_pipeline: "Content Name",
  campaigns: "Campaign",
  projects: "Project",
  people: "People",
  subjective_journal: "Name",
  relational_journal: "Name",
  systemic_journal: "Name",
  diet_log: "Name",
  financial_log: "Name",
};

export const DB_DESCRIPTIONS: Record<DbKey, string> = {
  tasks: `Tasks — status (Active|Focus|Up Next|Waiting|Paused|Done|Delegated|Cancelled|Archived), priority (⭐⭐⭐⭐⭐|⭐⭐⭐⭐|⭐⭐⭐|⭐⭐|⭐|P1 - Critical|P2 - High), action_date (YYYY-MM-DD), description (text), projects (relation: array of page IDs)`,

  subjective_journal: `Subjective Journal — date (YYYY-MM-DD), psychograph (text)`,

  relational_journal: `Relational Journal — date (YYYY-MM-DD), people (relation: array of people page IDs)`,

  systemic_journal: `Systemic Journal — date (YYYY-MM-DD), impact (P5: Note|P4: Low|P3: Medium|P2: High|P1: Critical), ai_generated_report (text), projects (relation), directives_risk_log (relation), opportunities_strengths (relation)`,

  diet_log: `Diet Log — date (YYYY-MM-DD), nutrition (text)`,

  financial_log: `Financial Log — date (YYYY-MM-DD), amount (number), category (Business Revenue|Pocket Money|Client Payment|Investment Income|Income|Investments/Trading|House Expenses|Food & Dining|Utilities|Family Times|Transportation|Business Expenses|Rent/Mortgage|Account Transfer|Miscellaneous), capital_engine (E (Employment)|S (Self-employment)|B (Business)|I (Investment)|Personal), notes (text), projects (relation)`,

  projects: `Projects — status (Active|Done|On Hold|Cancelled|Someday/Maybe|Delegated), priority (⭐⭐⭐⭐⭐|⭐⭐⭐⭐|⭐⭐⭐|⭐⭐|⭐), deadline (YYYY-MM-DD), project_start (YYYY-MM-DD), strategy (text), kpi (text), project_summary (text), progress (number 0-100), quarterly_goals (relation), people (relation), campaigns (relation)`,

  campaigns: `Campaign Management — theme (text), summary (text), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), platforms (LinkedIn|Instagram|Twitter/X|Substack|YouTube|TikTok), content_types (Carousels|Essays|Threads|Case Studies|Videos|Reels), content_frequency (Daily|3x/week|Weekly), target_reach (number), demographics (text), psychographics (text), seo_keywords (text), content_waterfall (text), projects (relation)`,

  content_pipeline: `Content Pipeline — status (Potential Idea|Scheduled|Next Up 🚩|Writing 📝|Recording ⏺|Editing 🎞|Ready to Post 📤|Published 💥), platforms (YouTube|Facebook|Instagram|X (Twitter)|Threads|LinkedIn|Blog|Medium|Substack), format (45-90 Sec Reel|5-10 Min Video|30-60 Min Podcast|Blog|Newsletter|FB/Linkedin/X Post), tone (Intellectual|Authentic/Vulnerable|Practical/How-to|Analytic|Urgent), pillar (P1: Meta-Theory|P2: AI Consulting|P3: LifeOS|P5: Counselling|P5: Activism), funnel_stage (TOFU (Awareness)|MOFU (Nurture)|BOFU (Conversion)), content_body (text), publish_date (YYYY-MM-DD), action_date (YYYY-MM-DD), live_url (URL), campaigns (relation), parent_content (relation)`,

  people: `People — custom_name (text), city (Noida|Janakpuri|Delhi|Greater Noida|Gurgaon|Ghaziabad|Faridabad|Meerut|Aligarh|Varanasi|Mumbai|Bihar|Dubai|Edison NJ|Chicago IL|Netherlands|US|Canada|Britain|Pune), relationship_status (Family Member|Mentor|Close Friend|Close Acquiantance|Coworker|Acquiantance), networking_profile (Key Ally|Active Collaborator|Mentor / Advisor|Protégé / Mentee|Peer / Sounding Board|Inactive|Archive), value_exchange_balance (I am in Credit|Balanced|I am in Debt), desired_trajectory (Deepen|Maintain|Activate|Graceful Exit|Inactive), last_connected_date (YYYY-MM-DD), connection_frequency (number: days), summary (text), strategic_context (text), developmental_altitude (LVL 3-7), primary_center_of_intelligence (Cognitive|Affective|Somatic), aspirational_drive (Security & Stability|Connection & Belonging|Status & Recognition|Mastery & Impact|Growth & Understanding), core_shadow (Fear of Insignificance|Fear of Rejection|Fear of Chaos/Uncertainty|Fear of Powerlessness/Domination), primary_conflict_style (Competing|Accommodating|Avoiding|Collaborating|Compromising), temporal_focus (Operational|Tactical|Strategic|Legacy), dominant_power_strategy (Directing|Collaborating|Inspiring|Mastering|Gatekeeping), influence_toolkit (multi_select), projects (relation)`,
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
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;

    // Skip formula fields (read-only)
    if (FORMULA_FIELDS.has(key)) continue;

    // Resolve the Notion property name
    const notionName = PROPERTY_NAME_MAP[key];
    if (!notionName) {
      // Unknown property — try using the key as-is with spaces
      notionProps[key] = { rich_text: markdownToRichText(String(value)) };
      continue;
    }

    // Date properties
    if (DATE_KEYS.has(key)) {
      notionProps[notionName] = { date: { start: value as string } };
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

    // Relation properties
    if (key in RELATION_KEYS) {
      notionProps[notionName] = { relation: (value as string[]).map(id => ({ id })) };
      continue;
    }

    // Status properties
    if (key === "status") {
      notionProps[notionName] = { status: { name: value as string } };
      continue;
    }

    // Multi-select properties
    if (MULTI_SELECT_KEYS.has(key)) {
      notionProps[notionName] = { multi_select: (value as string[]).map(v => ({ name: v })) };
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
