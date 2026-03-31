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
};

export function registerDiscoverTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_discover",
    "Discover all LifeOS databases organized by the dual-flywheel architecture (Temporal Ledger Layer + Strategic/Tactical Layer). Shows schemas, property types, and available tools.",
    {
      agent: z
        .enum(["productivity", "journaling", "strategic", "all"])
        .optional()
        .describe("Filter by agent domain. Default: all"),
    },
    async ({ agent = "all" }) => {
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
          lines.push(`### ${db.name} (\`${key}\`)`);
          lines.push(`- **Data Source ID:** \`${db.data_source_id}\``);
          lines.push(`- **Properties:**`);
          for (const [propKey, propName] of Object.entries(db.properties)) {
            lines.push(`  - \`${propKey}\` → "${propName}"`);
          }
          lines.push("");
        }
      }

      // Tools summary
      lines.push("## Available MCP Tools");
      lines.push("");
      lines.push("### Layer 1: Data Access");
      lines.push("- `lifeos_discover` — Show this architecture map");
      lines.push("- `lifeos_query` — Query any database (auto-detects property types)");
      lines.push("- `lifeos_activity_log` — Activities by date range and category");
      lines.push("- `lifeos_tasks` — Tasks with priority and overdue detection");
      lines.push("- `lifeos_subjective_journal` / `relational_journal` / `systemic_journal`");
      lines.push("- `lifeos_financial_log` / `diet_log`");
      lines.push("- `lifeos_projects` / `quarterly_goals` / `annual_goals`");
      lines.push("- `lifeos_directives_risks` / `opportunities_strengths`");
      lines.push("");
      lines.push("### Layer 2: Synthesis");
      lines.push("- `lifeos_productivity_report` — Activity × Task correlation with baseline");
      lines.push("- `lifeos_daily_briefing` — Multi-database daily snapshot");
      lines.push("");
      lines.push("### Layer 3: Temporal Analysis");
      lines.push("- `lifeos_temporal_analysis` — Baselines, deviations, trends across any time period");
      lines.push("- `lifeos_trajectory` — Map activity vs ideal targets from Activity Types DB");
      lines.push("");
      lines.push("### Layer 4: Write Tools");
      lines.push("- `lifeos_create_entry` — Create tasks, journals, projects, campaigns, content, people");
      lines.push("- `lifeos_create_report` — Save analysis as agent memory in Reports DB");

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
