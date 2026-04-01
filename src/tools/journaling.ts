import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate } from "../transformers/shared.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

function registerJournalTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient,
  dbKey: string,
  toolName: string,
  description: string
) {
  server.tool(
    toolName,
    description,
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      limit: z.number().optional().describe("Max entries (default: 20)"),
    },
    async ({ period, date_from, date_to, limit = 20 }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const db = getDbConfig(config, dbKey);
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
        sorts: [{ property: "Date", direction: "descending" }],
      };

      const df: Record<string, unknown> = { property: "Date" };
      df.date = { after: `${resolved.date_from}T00:00:00Z`, before: `${resolved.date_to}T23:59:59Z` };
      body.filter = df;

      const result = await notion.queryDataSource(db.data_source_id, body);
      const lines = [
        `## ${db.name} (${result.results.length} entries)`,
        "",
        `> Showing: ${resolved.rangeLabel}`,
        "",
      ];

      for (const p of result.results) {
        const name = extractTitle(p);
        const date = extractDate(p, "Date");
        const dateStr = date ? date.split("T")[0] : "No date";
        lines.push(`### [${dateStr}] ${name.substring(0, 120)}${name.length > 120 ? "..." : ""}`);

        // Show JSON field if available
        const jsonField = Object.keys(db.properties).find((k) => k.endsWith("_json"));
        if (jsonField) {
          const jsonVal = extractString(p, db.properties[jsonField]);
          if (jsonVal && jsonVal.length > 10) {
            lines.push("```json");
            lines.push(jsonVal.substring(0, 500));
            if (jsonVal.length > 500) lines.push("...");
            lines.push("```");
          }
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

export function registerJournalingTools(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  registerJournalTool(
    server, config, notion, "subjective_journal",
    "lifeos_subjective_journal",
    "Retrieve subjective journal entries (internal states, emotions, reflections). Date range: past_day (2d), past_week (8d), past_month (31d). Use with: lifeos_relational_journal, lifeos_systemic_journal, lifeos_daily_briefing."
  );
  registerJournalTool(
    server, config, notion, "relational_journal",
    "lifeos_relational_journal",
    "Retrieve relational journal entries (interactions, relationship reflections). Date range: past_day (2d), past_week (8d), past_month (31d). Use with: lifeos_subjective_journal, lifeos_people (People DB)."
  );
  registerJournalTool(
    server, config, notion, "systemic_journal",
    "lifeos_systemic_journal",
    "Retrieve systemic journal entries (systems-level observations, project reflections). Date range: past_day (2d), past_week (8d), past_month (31d). Use with: lifeos_subjective_journal, lifeos_projects."
  );
  registerJournalTool(
    server, config, notion, "financial_log",
    "lifeos_financial_log",
    "Retrieve financial log entries (amounts, categories, transaction types). Date range: past_day (2d), past_week (8d), past_month (31d). Use with: lifeos_temporal_analysis (include_financial for month synthesis)."
  );
  registerJournalTool(
    server, config, notion, "diet_log",
    "lifeos_diet_log",
    "Retrieve diet log entries (nutrition, meals). Date range: past_day (2d), past_week (8d), past_month (31d)."
  );
}
