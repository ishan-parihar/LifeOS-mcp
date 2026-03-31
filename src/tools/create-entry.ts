import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { markdownToRichText, markdownToNotionChildren } from "../transformers/notion-blocks.js";

const DB_KEYS = [
  "tasks", "subjective_journal", "relational_journal", "systemic_journal",
  "diet_log", "financial_log", "projects", "campaigns", "content_pipeline", "people"
] as const;

type DbKey = typeof DB_KEYS[number];

const DB_DESCRIPTIONS: Record<DbKey, string> = {
  tasks: `Tasks — Properties: status (select: To-do|In progress|Complete), priority (select: '⭐⭐⭐⭐⭐'|'⭐⭐⭐⭐'|'⭐⭐⭐'|'⭐⭐'|'⭐'|'P1 - Critical'|'P2 - High'), action_date (YYYY-MM-DD), description (text), projects (relation: array of project page IDs), monitor (text)`,
  subjective_journal: `Subjective Journal — Properties: date (YYYY-MM-DD), psychograph (text)`,
  relational_journal: `Relational Journal — Properties: date (YYYY-MM-DD), people (relation: array of people page IDs)`,
  systemic_journal: `Systemic Journal — Properties: date (YYYY-MM-DD), impact (select: 'P5: Note'|'P4: Low'|'P3: Medium'|'P2: High'|'P1: Critical'), ai_generated_report (text), projects (relation: array), directives_risk_log (relation: array), opportunities_strengths (relation: array)`,
  diet_log: `Diet Log — Properties: date (YYYY-MM-DD), nutrition (text)`,
  financial_log: `Financial Log — Properties: date (YYYY-MM-DD), amount (number), category (select: 'Business Revenue'|'Pocket Money'|'Client Payment'|'Investment Income'|'Income'|'Investments/Trading'|'House Expenses'|'Food & Dining'|'Utilities'|'Family Times'|'Transportation'|'Business Expenses'|'Rent/Mortgage'|'Account Transfer'|'Miscellaneous'), capital_engine (select: 'E (Employment)'|'S (Self-employment)'|'B (Business)'|'I (Investment)'|'Personal'), notes (text), projects (relation: array)`,
  projects: `Projects — Properties: status (select or status), priority (select: '⭐⭐⭐⭐⭐'|'⭐⭐⭐⭐'|'⭐⭐⭐'|'⭐⭐'|'⭐'), deadline (YYYY-MM-DD), project_start (YYYY-MM-DD), strategy (text), kpi (text), project_summary (text), quarterly_goals (relation: array), people (relation: array), campaigns (relation: array)`,
  campaigns: `Campaign Management — Properties: theme (text), summary (text), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), platforms (multi_select: 'LinkedIn'|'Instagram'|'Twitter/X'|'Substack'|'YouTube'|'TikTok'), content_types (multi_select: 'Carousels'|'Essays'|'Threads'|'Case Studies'|'Videos'|'Reels'), content_frequency (select: 'Daily'|'3x/week'|'Weekly'), target_reach (number), demographics (text), psychographics (text), seo_keywords (text), content_waterfall (text), projects (relation: array)`,
  content_pipeline: `Content Pipeline — Properties: status (select or status: To-do|In progress|Complete), platforms (multi_select: 'YouTube'|'Facebook'|'Instagram'|'X (Twitter)'|'Threads'|'LinkedIn'|'Blog'|'Medium'|'Substack'), format (multi_select: '45-90 Sec Reel'|'5-10 Min Video'|'30-60 Min Podcast'|'Blog'|'Newsletter'|'FB/Linkedin/X Post'), tone (select: 'Intellectual'|'Authentic/Vulnerable'|'Practical/How-to'|'Analytic'|'Urgent'), pillar (select: 'P1: Meta-Theory'|'P2: AI Consulting'|'P3: LifeOS'|'P5: Counselling'|'P5: Activism'), funnel_stage (select: 'TOFU (Awareness)'|'MOFU (Nurture)'|'BOFU (Conversion)'), content_body (text), publish_date (YYYY-MM-DD), action_date (YYYY-MM-DD), campaigns (relation: array), live_url (URL), parent_content (relation: array)`,
  people: `People — Properties: custom_name (text), city (select: 'Noida'|'Janakpuri'|'Delhi'|'Greater Noida'|'Gurgaon'|'Ghaziabad'|'Faridabad'|'Meerut'|'Aligarh'|'Varanasi'|'Mumbai'|'Bihar'|'Dubai'|'Edison NJ'|'Chicago IL'|'Netherlands'|'US'|'Canada'|'Britain'|'Pune'), relationship_status (select: 'Family Member'|'Mentor'|'Close Friend'|'Close Acquiantance'|'Coworker'|'Acquiantance'), networking_profile (select: 'Key Ally'|'Active Collaborator'|'Mentor / Advisor'|'Protégé / Mentee'|'Peer / Sounding Board'|'Inactive'|'Archive'), value_exchange_balance (select: 'I am in Credit'|'Balanced'|'I am in Debt'), desired_trajectory (select: 'Deepen'|'Maintain'|'Activate'|'Graceful Exit'|'Inactive'), summary (text), strategic_context (text), engagement_blueprint (text), professional_domain (text), key_personal_intel (text), origin_context (text), developmental_altitude (select), primary_center_of_intelligence (select), aspirational_drive (select), core_shadow (select), primary_conflict_style (select), temporal_focus (select), dominant_power_strategy (select), influence_toolkit (multi_select), connection_frequency (number: days between contacts), projects (relation: array)`,
};

interface PropertyBuilderResult {
  properties: Record<string, unknown>;
  children: Record<string, unknown>[];
}

function buildNotionProperties(
  dbKey: DbKey,
  name: string,
  props: Record<string, unknown>
): PropertyBuilderResult {
  const notionProps: Record<string, unknown> = {};
  const children: Record<string, unknown>[] = [];

  // Title always set
  const titleField = dbKey === "tasks" ? "Tasks" :
    dbKey === "content_pipeline" ? "Content Name" :
    dbKey === "campaigns" ? "Campaign" :
    dbKey === "projects" ? "Project" :
    dbKey === "people" ? "People" : "Name";
  notionProps[titleField] = { title: [{ text: { content: name } }] };

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;

    switch (key) {
      // Date properties
      case "date":
      case "action_date":
      case "publish_date":
      case "start_date":
      case "end_date":
      case "deadline":
      case "project_start": {
        const dateKey = key === "action_date" ? "Action Date" :
          key === "publish_date" ? "Publish Date" :
          key === "start_date" ? "Start Date" :
          key === "end_date" ? "End Date" :
          key === "deadline" ? "Deadline" :
          key === "project_start" ? "Project Start" : "Date";
        notionProps[dateKey] = { date: { start: value as string } };
        break;
      }

      // Status properties
      case "status": {
        const statusKey = dbKey === "content_pipeline" ? "Status" :
          dbKey === "campaigns" ? "Status" : "Status";
        // Try status type first (most databases use status, not select)
        notionProps[statusKey] = { status: { name: value as string } };
        break;
      }

      // Select properties
      case "priority":
        notionProps["Priority"] = { select: { name: value as string } };
        break;
      case "impact":
        notionProps["Impact"] = { select: { name: value as string } };
        break;
      case "category":
        notionProps["Category"] = { select: { name: value as string } };
        break;
      case "capital_engine":
        notionProps["Capital Engine"] = { select: { name: value as string } };
        break;
      case "tone":
        notionProps["Tone"] = { select: { name: value as string } };
        break;
      case "pillar":
        notionProps["Pillar"] = { select: { name: value as string } };
        break;
      case "funnel_stage":
        notionProps["Funnel Stage"] = { select: { name: value as string } };
        break;
      case "relationship_status":
        notionProps["Relationship Status"] = { select: { name: value as string } };
        break;
      case "networking_profile":
        notionProps["Networking Profile"] = { select: { name: value as string } };
        break;
      case "value_exchange_balance":
        notionProps["Value Exchange Balance"] = { select: { name: value as string } };
        break;
      case "desired_trajectory":
        notionProps["Desired Trajectory"] = { select: { name: value as string } };
        break;
      case "city":
        notionProps["City"] = { select: { name: value as string } };
        break;
      case "developmental_altitude":
        notionProps["Developmental Altitude"] = { select: { name: value as string } };
        break;
      case "primary_center_of_intelligence":
        notionProps["Primary Center of Intelligence"] = { select: { name: value as string } };
        break;
      case "aspirational_drive":
        notionProps["Aspirational Drive"] = { select: { name: value as string } };
        break;
      case "core_shadow":
        notionProps["Core Shadow"] = { select: { name: value as string } };
        break;
      case "primary_conflict_style":
        notionProps["Primary Conflict Style"] = { select: { name: value as string } };
        break;
      case "temporal_focus":
        notionProps["Temporal Focus"] = { select: { name: value as string } };
        break;
      case "dominant_power_strategy":
        notionProps["Dominant Power Strategy"] = { select: { name: value as string } };
        break;
      case "content_frequency":
        notionProps["Content Frequency"] = { select: { name: value as string } };
        break;

      // Multi-select properties
      case "platforms":
        notionProps["Platforms"] = { multi_select: (value as string[]).map(v => ({ name: v })) };
        break;
      case "content_types":
        notionProps["Content Types"] = { multi_select: (value as string[]).map(v => ({ name: v })) };
        break;
      case "format":
        notionProps["Format"] = { multi_select: (value as string[]).map(v => ({ name: v })) };
        break;
      case "influence_toolkit":
        notionProps["Influence Toolkit"] = { multi_select: (value as string[]).map(v => ({ name: v })) };
        break;

      // Number properties
      case "amount":
        notionProps["Amount"] = { number: value as number };
        break;
      case "target_reach":
        notionProps["Target Reach"] = { number: value as number };
        break;
      case "connection_frequency":
        notionProps["In days Connection Frequency"] = { number: value as number };
        break;

      // Rich text properties
      case "description":
        notionProps["Description"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "psychograph":
        notionProps["Psychograph"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "nutrition":
        notionProps["Nutrition"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "notes":
        notionProps["Notes"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "ai_generated_report":
        notionProps["AI Generated Report"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "monitor":
        break; // Monitor is formula, skip
      case "strategy":
        notionProps["Strategy"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "kpi":
        notionProps["KPI"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "project_summary":
        notionProps["Project Summary"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "theme":
        notionProps["Theme"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "summary":
        notionProps["Summary"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "demographics":
        notionProps["Demographics"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "psychographics":
        notionProps["Psychographics"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "seo_keywords":
        notionProps["SEO Keywords"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "content_waterfall":
        notionProps["Content Waterfall"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "content_body":
        notionProps["Content Body"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "custom_name":
        notionProps["Custom Name"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "strategic_context":
        notionProps["Strategic Context"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "engagement_blueprint":
        notionProps["Engagement Blueprint"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "professional_domain":
        notionProps["Professional Domain & Influence"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "key_personal_intel":
        notionProps["Key Personal Intel"] = { rich_text: markdownToRichText(value as string) };
        break;
      case "origin_context":
        notionProps["Origin Context"] = { rich_text: markdownToRichText(value as string) };
        break;

      // Relation properties
      case "projects":
        notionProps["Projects"] = { relation: (value as string[]).map(id => ({ id })) };
        break;
      case "people":
        if (dbKey === "relational_journal") {
          notionProps["People"] = { relation: (value as string[]).map(id => ({ id })) };
        } else if (dbKey === "projects") {
          notionProps["People"] = { relation: (value as string[]).map(id => ({ id })) };
        }
        break;
      case "quarterly_goals":
        notionProps["Quarterly Goals"] = { relation: (value as string[]).map(id => ({ id })) };
        break;
      case "directives_risk_log":
        notionProps["Directives & Risk Log"] = { relation: (value as string[]).map(id => ({ id })) };
        break;
      case "opportunities_strengths":
        if (dbKey === "systemic_journal") {
          notionProps["Opportunities & Strengths Log"] = { relation: (value as string[]).map(id => ({ id })) };
        }
        break;
      case "campaigns":
        if (dbKey === "content_pipeline") {
          notionProps["Campaigns"] = { relation: (value as string[]).map(id => ({ id })) };
        } else if (dbKey === "projects") {
          notionProps["Campaign Calendar"] = { relation: (value as string[]).map(id => ({ id })) };
        }
        break;
      case "parent_content":
        notionProps["Parent Content"] = { relation: (value as string[]).map(id => ({ id })) };
        break;
      case "live_url":
        notionProps["Live URL"] = { url: value as string };
        break;
    }
  }

  return { properties: notionProps, children };
}

export function registerCreateEntryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  const dbEnum = z.enum(DB_KEYS);

  server.tool(
    "lifeos_create_entry",
    "Create a new entry in any LifeOS database. The tool schema documents available properties per database.\n\n" +
    Object.entries(DB_DESCRIPTIONS).map(([k, v]) => `**${k}**: ${v}`).join("\n\n"),
    {
      database: dbEnum.describe("Database to create entry in"),
      name: z.string().describe("Entry title / name"),
      properties: z.record(z.unknown()).optional().describe(
        "Properties as a JSON object. Only include fields relevant to the chosen database. " +
        "See tool description for available properties per database."
      ),
    },
    async ({ database, name, properties = {} }) => {
      const db = getDbConfig(config, database);
      const { properties: notionProps, children } = buildNotionProperties(
        database as DbKey, name, properties as Record<string, unknown>
      );

      // Build page body
      const body: Record<string, unknown> = {
        parent: { data_source_id: db.data_source_id },
        properties: notionProps,
      };

      if (children.length > 0) {
        body.children = children;
      }

      const result = await notion.createPage(body as any);

      const lines = [
        `## Entry Created: ${name}`,
        `- **Database:** ${db.name}`,
        `- **Page ID:** ${result.id}`,
        result.url ? `- **URL:** ${result.url}` : "",
        "",
      ].filter(Boolean);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
