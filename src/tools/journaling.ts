import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractNumber, extractDate } from "../transformers/shared.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

const LOG_TYPE_ENUM = z.enum([
  "Meal",
  "Supplement",
  "Medication",
  "Symptom",
  "Vitals",
  "Mood",
  "Hormonal",
  "Exercise-Recovery",
  "Environmental",
]);

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

function registerDietLogTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_diet_log",
    "Retrieve diet log entries (nutrition, meals, supplements, vitals). Use with: lifeos_health_vitality (component scores), lifeos_trajectory (nutrition target gaps).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      log_type: LOG_TYPE_ENUM.optional().describe("Filter by log type. Default: all types"),
      limit: z.number().optional().describe("Max entries (default: 20)"),
    },
    async ({ period, date_from, date_to, log_type, limit = 20 }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const db = getDbConfig(config, "diet_log");
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
        sorts: [{ property: "Date", direction: "descending" }],
      };

      const dateFilter: Record<string, unknown> = { property: "Date" };
      dateFilter.date = { after: `${resolved.date_from}T00:00:00Z`, before: `${resolved.date_to}T23:59:59Z` };

      if (log_type) {
        const logTypeFilter = { property: db.properties["log_type"], select: { equals: log_type } };
        body.filter = { and: [dateFilter, logTypeFilter] };
      } else {
        body.filter = dateFilter;
      }

      const result = await notion.queryDataSource(db.data_source_id, body);
      const lines = [
        `## ${db.name} (${result.results.length} entries)`,
        "",
        `> Showing: ${resolved.rangeLabel}`,
        log_type ? `> Filtered by: ${log_type}` : "",
        "",
      ];

      for (const p of result.results) {
        const name = extractTitle(p);
        const date = extractDate(p, "Date");
        const dateStr = date ? date.split("T")[0] : "No date";
        lines.push(`### [${dateStr}] ${name.substring(0, 120)}${name.length > 120 ? "..." : ""}`);

        const logTypeVal = extractString(p, db.properties["log_type"]);
        const mealTypeVal = extractString(p, db.properties["meal_type"]);
        const caloriesVal = extractNumber(p, db.properties["calories"]);
        const proteinVal = extractNumber(p, db.properties["protein_g"]);
        const waterVal = extractNumber(p, db.properties["water_ml"]);
        const caffeineVal = extractNumber(p, db.properties["caffeine_mg"]);
        const energyVal = extractString(p, db.properties["energy_level"]);
        const moodVal = extractString(p, db.properties["mood"]);
        const sleepVal = extractString(p, db.properties["sleep_quality"]);
        const supplementsVal = extractString(p, db.properties["supplements"]);
        const symptomsVal = extractString(p, db.properties["symptoms"]);
        const environmentVal = extractString(p, db.properties["environment"]);

        const typeParts = [logTypeVal, mealTypeVal ? `(${mealTypeVal})` : null].filter(Boolean);
        if (typeParts.length > 0) {
          lines.push(`- **Type:** ${typeParts.join(" ")}`);
        }

        const nutritionParts: string[] = [];
        if (caloriesVal !== null) nutritionParts.push(`**Calories:** ${caloriesVal}`);
        if (proteinVal !== null) nutritionParts.push(`**Protein:** ${proteinVal}g`);
        if (waterVal !== null) nutritionParts.push(`**Water:** ${waterVal}ml`);
        if (caffeineVal !== null) nutritionParts.push(`**Caffeine:** ${caffeineVal}mg`);
        if (nutritionParts.length > 0) {
          lines.push(`- ${nutritionParts.join(" | ")}`);
        }

        const bioParts: string[] = [];
        if (energyVal) bioParts.push(`**Energy:** ${energyVal}/10`);
        if (moodVal) bioParts.push(`**Mood:** ${moodVal}`);
        if (sleepVal) bioParts.push(`**Sleep Quality:** ${sleepVal}`);
        if (bioParts.length > 0) {
          lines.push(`- ${bioParts.join(" | ")}`);
        }

        if (supplementsVal) {
          lines.push(`- **Supplements:** ${supplementsVal}`);
        }
        if (symptomsVal) {
          lines.push(`- **Symptoms:** ${symptomsVal}`);
        }
        if (environmentVal) {
          lines.push(`- **Environment:** ${environmentVal}`);
        }

        const jsonVal = extractString(p, db.properties["diet_json"]);
        if (jsonVal && jsonVal.length > 10) {
          lines.push("```json");
          lines.push(jsonVal.substring(0, 500));
          if (jsonVal.length > 500) lines.push("...");
          lines.push("```");
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
    "Retrieve subjective journal entries (internal states, emotions, reflections). Use with: lifeos_relational_journal, lifeos_systemic_journal, lifeos_daily_briefing."
  );
  registerJournalTool(
    server, config, notion, "relational_journal",
    "lifeos_relational_journal",
    "Retrieve relational journal entries (interactions, relationship reflections). Use with: lifeos_subjective_journal, lifeos_people (People DB)."
  );
  registerJournalTool(
    server, config, notion, "systemic_journal",
    "lifeos_systemic_journal",
    "Retrieve systemic journal entries (systems-level observations, project reflections). Use with: lifeos_subjective_journal, lifeos_projects."
  );
  registerJournalTool(
    server, config, notion, "financial_log",
    "lifeos_financial_log",
    "Retrieve financial log entries (amounts, categories, transaction types). Use with: lifeos_temporal_analysis (include_financial for month synthesis)."
  );
  registerDietLogTool(server, config, notion);
}
