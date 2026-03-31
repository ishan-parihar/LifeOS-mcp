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
import { loadActivityTargets, computePeriodMetrics } from "../transformers/temporal.js";

export function registerProductivityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_productivity_report",
    "Generate a synthesized productivity report correlating activity log data with task completion. Shows time allocation, task performance, and automated insights. Compares actual per-tracked-day averages vs Activity Types targets.",
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
          and: [
            { property: "Date", date: { on_or_after: from } },
            { property: "Date", date: { on_or_before: `${to}T23:59:59Z` } },
          ],
        },
      });
      const activities = actResult.results.map(transformActivity);

      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, {
        page_size: 100,
      });
      const tasks = taskResult.results.map(transformTask);

      const report = computeProductivityReport(activities, tasks, from, to);
      let markdown = productivityReportToMarkdown(report);

      // Fetch Activity Types for target comparison
      try {
        const atDb = getDbConfig(config, "activity_types");
        const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
        const targets = loadActivityTargets(atResult.results);

        // Use tracked-day metrics for proper averaging
        const metrics = computePeriodMetrics(activities, from, to, targets);

        const lines: string[] = [];
        lines.push("");
        lines.push("## vs Targets (from Activity Types)");
        lines.push("");
        lines.push(`> Averages from ${metrics.trackedDays} tracked days (${metrics.days} calendar). Targets as defined.`);
        lines.push("");
        lines.push("| Activity | Target/day | Actual/day | Δ | Status |");
        lines.push("|----------|-----------|------------|---|--------|");

        for (const [name, target] of targets) {
          const actualDaily = metrics.categoryDailyAvg.get(name) ?? 0;
          const delta = actualDaily - target.targetDuration;
          const deltaPct = target.targetDuration > 0 ? (delta / target.targetDuration * 100) : 0;

          let status: string;
          if (Math.abs(deltaPct) <= 20) status = "✅";
          else if (Math.abs(deltaPct) <= 50) status = delta > 0 ? "⚠️ Over" : "⚠️ Under";
          else status = delta > 0 ? "⛔ Way Over" : "⛔ Way Under";

          lines.push(`| ${name} | ${target.targetDuration}h | ${actualDaily.toFixed(1)}h | ${delta >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% | ${status} |`);
        }
        lines.push("");

        markdown += lines.join("\n");
      } catch {
        // Activity Types DB not available
      }

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
