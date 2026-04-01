import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity, activitiesToMarkdown } from "../transformers/activity.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

export function registerActivityLogTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_activity_log",
    "Retrieve activity log entries grouped by type with duration tracking. Supports date range filtering, category filtering, and habit-only mode. Date range: past_day (2 calendar days), past_week (8), past_month (31). Use with: lifeos_productivity_report (for summarized analysis), lifeos_weekday_patterns (to understand typical patterns), lifeos_query (for custom filtered queries).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      category: z
        .string()
        .optional()
        .describe("Filter by activity type (e.g., 'Work', 'Recreation', 'Workout', 'Sleep')"),
      habits_only: z
        .boolean()
        .optional()
        .describe("Show only habit-tracked activities"),
      limit: z
        .number()
        .optional()
        .describe("Max entries to return (default: 100)"),
    },
    async ({ period, date_from, date_to, category, habits_only, limit = 100 }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const db = getDbConfig(config, "activity_log");
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
        sorts: [{ property: "Date", direction: "descending" }],
      };

      const dateFilter: Record<string, unknown> = { property: "Date" };
      dateFilter.date = { after: `${resolved.date_from}T00:00:00Z`, before: `${resolved.date_to}T23:59:59Z` };
      body.filter = dateFilter;

      const result = await notion.queryDataSource(db.data_source_id, body);

      let entries = result.results.map(transformActivity);

      if (category) {
        entries = entries.filter((e) => e.activityType.toLowerCase().includes(category.toLowerCase()));
      }
      if (habits_only) {
        entries = entries.filter((e) => e.isHabit);
      }

      const header = `Activity Log — ${resolved.rangeLabel}\n> Showing: ${resolved.rangeLabel}`;

      return {
        content: [
          {
            type: "text" as const,
            text: activitiesToMarkdown(entries, header),
          },
        ],
      };
    }
  );
}
