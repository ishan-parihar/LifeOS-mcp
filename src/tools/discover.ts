import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbsByAgent } from "../config.js";
import { NotionClient } from "../notion/client.js";

const LAYER_MAP: Record<string, string> = {
  activity_log: "temporal",
  tasks: "strategic",
  days: "temporal",
  weeks: "temporal",
  months: "temporal",
  quarters: "temporal",
  years: "temporal",
  projects: "strategic",
  subjective_journal: "logs",
  relational_journal: "logs",
  systemic_journal: "logs",
  financial_log: "logs",
  diet_log: "logs",
  quarterly_goals: "strategic",
  annual_goals: "strategic",
  directives_risk_log: "strategic",
  opportunities_strengths: "strategic",
  people: "strategic",
  campaigns: "strategic",
  content_pipeline: "strategic",
  activity_types: "reference",
  reports: "reference",
  notes_management: "reference",
  financial_accounts: "reference",
};

export function registerDiscoverTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_discover",
    "Discover all LifeOS databases and tools organized by the dual-flywheel architecture. Shows schemas, property types, tool inventory, and synergistic workflow patterns. Start here to understand what data is available and how tools work together.",
    {
      agent: z
        .enum(["productivity", "journaling", "strategic", "all"])
        .optional()
        .describe("Filter by agent domain. Default: all"),
      verbose: z
        .boolean()
        .optional()
        .describe("Show full property listings. Default: false (condensed output)"),
    },
    async ({ agent = "all", verbose = false }) => {
      const lines = [
        "# LifeOS — Database Architecture",
        "",
        "## Dual Flywheel Structure",
        "",
        "**Temporal Ledger Layer:** Years → Quarters → Months → Weeks → Days → 6 Log DBs",
        "**Strategic/Tactical Layer:** Vision → Values → Annual Goals → Quarterly Goals → Projects → Tasks",
        "  ↳ Campaigns → Content Pipeline | People | Directives & Risks | Opportunities & Strengths",
        "",
      ];

      const dbs =
        agent === "all"
          ? config.databases
          : getDbsByAgent(config, agent);

      // Group by layer
      const byLayer = new Map<string, Array<[string, typeof config.databases[string]]>>();
      for (const [key, db] of Object.entries(dbs)) {
        const layer = LAYER_MAP[key] || db.agent;
        if (!byLayer.has(layer)) byLayer.set(layer, []);
        byLayer.get(layer)!.push([key, db]);
      }

      const layerOrder = ["temporal", "logs", "strategic", "reference"];
      const layerNames: Record<string, string> = {
        temporal: "Temporal Ledger Layer",
        logs: "Daily Log Databases (6)",
        strategic: "Strategic/Tactical Layer",
        reference: "Reference & Memory",
      };

      for (const layer of layerOrder) {
        const layerDbs = byLayer.get(layer);
        if (!layerDbs || layerDbs.length === 0) continue;

        lines.push(`## ${layerNames[layer] || layer}`);
        lines.push("");

        for (const [key, db] of layerDbs) {
          const propCount = Object.keys(db.properties).length;
          if (verbose) {
            lines.push(`### ${db.name} (\`${key}\`)`);
            lines.push(`- **Data Source ID:** \`${db.data_source_id}\``);
            lines.push(`- **Properties:**`);
            for (const [propKey, propName] of Object.entries(db.properties)) {
              lines.push(`  - \`${propKey}\` → "${propName}"`);
            }
            lines.push("");
          } else {
            lines.push(`### ${db.name} (\`${key}\`) — ${propCount} properties | ${layer}`);
          }
        }
        if (!verbose) lines.push("");
      }

      // Tools summary
      lines.push("## Available MCP Tools");
      lines.push("");
      lines.push("### Layer 1: Data Access");
      lines.push("- `lifeos_discover` — Show this architecture map");
      lines.push("- `lifeos_query_db_schema` — Get real-time schema for any database (property names, types, select options)");
      lines.push("- `lifeos_context_card` — Agent-scoped startup context (compact/schemas/workflows)");
      lines.push("- `lifeos_query` — Query any database (auto-detects property types)");
      lines.push("- `lifeos_tasks` — Tasks with priority and overdue detection");
      lines.push("- `lifeos_projects` / `quarterly_goals` / `annual_goals`");
      lines.push("- `lifeos_directives_risks` / `opportunities_strengths`");
      lines.push("");
      lines.push("### Layer 2: Synthesis");
      lines.push("- `lifeos_productivity_report` — Activity × Task correlation with baseline");
      lines.push("- `lifeos_daily_briefing` — Multi-database daily snapshot");
      lines.push("- `lifeos_campaigns` — List campaigns, get briefs");
      lines.push("- `lifeos_content` — Pipeline ops: list, transition, publish, metrics, calendar");
      lines.push("- `lifeos_project_health` — Project health composite indicators");
      lines.push("- `lifeos_okrs_progress` — OKR progress rollups and coverage");
      lines.push("- `lifeos_journal_synthesis` — Cross-journal theme clustering");
      lines.push("");
      lines.push("### Layer 2.5: Ops (Macro Tools)");
      lines.push("- `lifeos_planning_ops` — Morning planner, weekly review, habit compliance");
      lines.push("- `lifeos_people_ops` — Cadence review, follow-ups, log interaction");
      lines.push("- `lifeos_finance_ops` — Month close, anomalies, cashflow summary, receivables/payables");
      lines.push("- `lifeos_alignment` — OKR↔Project↔Campaign coverage and stakeholders");
      lines.push("");
      lines.push("### Layer 3: Temporal Analysis");
      lines.push("- `lifeos_temporal_analysis` — Baselines, deviations, trends across any time period");
      lines.push("- `lifeos_trajectory` — Map activity vs ideal targets from Activity Types DB");
      lines.push("- `lifeos_weekday_patterns` — Per-weekday activity profiles, anomaly detection, suggested plans");
      lines.push("");
      lines.push("### Layer 4: Write Tools");
      lines.push("- `lifeos_create_entry` — Create tasks, journals, projects, campaigns, content, people, notes (notes_management)");
      lines.push("- `lifeos_create_report` — Save structured analysis outputs & agent memory in Reports DB (NOT for meeting/research notes → use notes_management)");
      lines.push("- `lifeos_log_activity` — Log a time-tracked activity (start/end time, type, notes)");
      lines.push("- `lifeos_complete_task` — Mark task as Done by name search");
      lines.push("- `lifeos_log_transaction` — Log financial transaction (amount, category, type)");
      lines.push("- `lifeos_journal_entry` — Create journal entry (subjective/relational/systemic/diet)");
      lines.push("");
      lines.push("### Layer 5: Update & Delete Tools");
      lines.push("- `lifeos_find_entry` — Find entries by name (resolve name → page_id)");
      lines.push("- `lifeos_update_entry` — Update page properties (status, progress, dates, etc.)");
      lines.push("- `lifeos_delete_entry` — Delete (archive) a page");
      lines.push("");

      // Synergistic Workflows
      lines.push("## Synergistic Workflows");
      lines.push("");
      lines.push("Date presets: past_day (2 calendar days), past_week (8d), past_month (31d). All include today up to now.");
      lines.push("");

      lines.push("### Morning Briefing (daily planning)");
      lines.push("1. `lifeos_daily_briefing` — tasks, activities, pattern comparison, suggested plan");
      lines.push("2. `lifeos_weekday_patterns` — deeper weekday analysis, consistency scores");
      lines.push("3. `lifeos_trajectory` — target gaps to address today");
      lines.push("");

      lines.push("### Weekly Review (end-of-week analysis)");
      lines.push("1. `lifeos_productivity_report` (period: past_week) — allocation vs targets");
      lines.push("2. `lifeos_temporal_analysis` (period: past_week) — baselines and trends");
      lines.push("3. `lifeos_trajectory` (period: past_week) — compliance and projections");
      lines.push("4. `lifeos_create_report` — save analysis as agent memory");
      lines.push("");

      lines.push("### Missing Data Recovery (fill activity log gaps)");
      lines.push("1. `lifeos_query` (database: activity_log, filter_property: Date) — check what days have entries");
      lines.push("2. `lifeos_weekday_patterns` — typical pattern for the missing weekday");
      lines.push("3. Present suggestions to user for confirmation");
      lines.push("4. `lifeos_create_entry` — create confirmed entries (one per activity)");
      lines.push("");

      lines.push("### Task Prioritization (based on activity gaps)");
      lines.push("1. `lifeos_trajectory` — which targets are most behind");
      lines.push("2. `lifeos_tasks` — active/overdue tasks");
      lines.push("3. `lifeos_projects` — project context for task grouping");
      lines.push("4. `lifeos_create_entry` — create new tasks for unaddressed gaps (confirm with user)");
      lines.push("");

      lines.push("### Task Completion (update after finishing work)");
      lines.push("1. `lifeos_find_entry` (search: task name) — resolve name to page_id");
      lines.push("2. `lifeos_update_entry` (page_id, {status: Done}) — mark complete");
      lines.push("3. `lifeos_find_entry` (search: project name) — find linked project");
      lines.push("4. `lifeos_update_entry` (page_id, {progress: new_value}) — update project progress");
      lines.push("");

      lines.push("### After Connecting with Someone");
      lines.push("1. `lifeos_find_entry` (database: people, search: name) — find their page");
      lines.push("2. `lifeos_update_entry` (page_id, {last_connected_date: today}) — update connection date");
      lines.push("3. `lifeos_create_entry` (database: relational_journal) — log the interaction");
      lines.push("");

      lines.push("### Content Pipeline Management");
      lines.push("1. `lifeos_find_entry` (database: content_pipeline, search: content name) — find the entry");
      lines.push("2. `lifeos_update_entry` (page_id, {status: Complete, live_url: url}) — mark published");
      lines.push("3. Later: `lifeos_update_entry` (page_id, {reach: N, engagement: N}) — add metrics");
      lines.push("");

      lines.push("### Knowledge Capture (meeting notes, research, knowledge)");
      lines.push("1. `lifeos_create_entry` (database: notes_management, name: note title, properties: {status: \"New Note\", projects: [...]}) — create the note");
      lines.push("2. Content is stored as rich markdown page body automatically");
      lines.push("3. Later: `lifeos_update_entry` (page_id, {status: \"Live\"}) — promote active notes");
      lines.push("");

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n"),
          },
        ],
      };
    }
  );
}
