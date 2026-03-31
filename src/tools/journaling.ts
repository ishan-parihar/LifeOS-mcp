import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate } from "../transformers/shared.js";

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
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Max entries (default: 20)"),
    },
    async ({ date_from, date_to, limit = 20 }) => {
      const db = getDbConfig(config, dbKey);
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
        sorts: [{ property: "Date", direction: "descending" }],
      };

      if (date_from || date_to) {
        const df: Record<string, unknown> = { property: "Date" };
        if (date_from && date_to) {
          df.date = { after: `${date_from}T00:00:00Z`, before: `${date_to}T23:59:59Z` };
        } else if (date_from) {
          df.date = { after: `${date_from}T00:00:00Z` };
        } else {
          df.date = { before: `${date_to}T23:59:59Z` };
        }
        body.filter = df;
      }

      const result = await notion.queryDataSource(db.data_source_id, body);
      const lines = [`## ${db.name} (${result.results.length} entries)`, ""];

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
    "Retrieve subjective journal entries tracking internal states, emotions, and reflections."
  );
  registerJournalTool(
    server, config, notion, "relational_journal",
    "lifeos_relational_journal",
    "Retrieve relational journal entries tracking interactions and relationship reflections."
  );
  registerJournalTool(
    server, config, notion, "systemic_journal",
    "lifeos_systemic_journal",
    "Retrieve systemic journal entries tracking systems-level observations and patterns."
  );
  registerJournalTool(
    server, config, notion, "financial_log",
    "lifeos_financial_log",
    "Retrieve financial log entries with amounts, categories, and transaction types."
  );
  registerJournalTool(
    server, config, notion, "diet_log",
    "lifeos_diet_log",
    "Retrieve diet log entries tracking nutrition and meals."
  );
}
