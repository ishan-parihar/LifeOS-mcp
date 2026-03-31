import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import { transformTask } from "../transformers/tasks.js";
import {
  computeProductivityReport,
  productivityReportToMarkdown,
} from "../transformers/productivity.js";

export function registerProductivityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_productivity_report",
    "Generate a synthesized productivity report correlating activity log data with task completion. Shows time allocation, task performance, and automated insights. Use this for weekly reviews or daily check-ins.",
    {
      date_from: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD). Default: 7 days ago"),
      date_to: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD). Default: today"),
    },
    async ({ date_from, date_to }) => {
      const today = new Date();
      const to = date_to || today.toISOString().split("T")[0];
      const from =
        date_from ||
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

      const actDb = getDbConfig(config, "activity_log");
      const actResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          property: "Date",
          date: {
            after: `${from}T00:00:00Z`,
            before: `${to}T23:59:59Z`,
          },
        },
      });
      const activities = actResult.results.map(transformActivity);

      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, {
        page_size: 100,
      });
      const tasks = taskResult.results.map(transformTask);

      const report = computeProductivityReport(activities, tasks, from, to);

      return {
        content: [
          {
            type: "text" as const,
            text: productivityReportToMarkdown(report),
          },
        ],
      };
    }
  );
}
