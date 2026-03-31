import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity, activitiesToMarkdown } from "../transformers/activity.js";

export function registerActivityLogTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_activity_log",
    "Retrieve activity log entries for a date range. Returns activities grouped by type (Work, Recreation, Workout, Sleep, Chores, Socialize, Study, etc.) with duration tracking.",
    {
      date_from: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD). Default: 7 days ago"),
      date_to: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD). Default: today"),
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
    async ({ date_from, date_to, category, habits_only, limit = 100 }) => {
      const db = getDbConfig(config, "activity_log");
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
        sorts: [{ property: "Date", direction: "descending" }],
      };

      if (date_from || date_to) {
        const dateFilter: Record<string, unknown> = { property: "Date" };
        if (date_from && date_to) {
          dateFilter.date = { after: `${date_from}T00:00:00Z`, before: `${date_to}T23:59:59Z` };
        } else if (date_from) {
          dateFilter.date = { after: `${date_from}T00:00:00Z` };
        } else if (date_to) {
          dateFilter.date = { before: `${date_to}T23:59:59Z` };
        }
        body.filter = dateFilter;
      }

      const result = await notion.queryDataSource(db.data_source_id, body);

      let entries = result.results.map(transformActivity);

      if (category) {
        entries = entries.filter((e) => e.activityType.toLowerCase().includes(category.toLowerCase()));
      }
      if (habits_only) {
        entries = entries.filter((e) => e.isHabit);
      }

      const rangeLabel =
        date_from && date_to ? `${date_from} to ${date_to}` : date_from ? `since ${date_from}` : date_to ? `until ${date_to}` : "recent";

      return {
        content: [
          {
            type: "text" as const,
            text: activitiesToMarkdown(entries, `Activity Log — ${rangeLabel}`),
          },
        ],
      };
    }
  );
}
