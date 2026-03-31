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
import { loadActivityTargets, scaleTargetsByTrackedTime, trackedHoursPerDay } from "../transformers/temporal.js";

export function registerProductivityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_productivity_report",
    "Generate a synthesized productivity report correlating activity log data with task completion. Shows time allocation, task performance, and automated insights. Compares actual vs ideal targets from Activity Types database. Use this for weekly reviews or daily check-ins.",
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

      // Fetch Activity Types for ideal target comparison
      try {
        const atDb = getDbConfig(config, "activity_types");
        const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
        const idealTargets = loadActivityTargets(atResult.results);

        const days = Math.max(1, Math.ceil(
          (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1);

        // Compute tracked hours and scale targets
        const totalTracked = report.totalHours;
        const trackedPerDay = totalTracked / days;
        const idealTotal = [...idealTargets.values()].reduce((s, t) => s + t.targetDuration, 0);
        const trackingRatio = idealTotal > 0 ? Math.min(1, trackedPerDay / idealTotal) : 1;
        const scaledTargets = scaleTargetsByTrackedTime(idealTargets, trackedPerDay);

        const lines: string[] = [];
        lines.push("");
        lines.push("## vs Scaled Targets (from Activity Types)");
        lines.push("");
        lines.push(`> Targets scaled to ${trackedPerDay.toFixed(1)}h/day tracked (${(trackingRatio * 100).toFixed(0)}% of 24h). Comparing against your tracked time, not a full day.`);
        lines.push("");
        lines.push("| Activity | Ideal | Scaled | Actual/day | Δ | Status |");
        lines.push("|----------|-------|--------|------------|---|--------|");

        for (const [name, scaled] of scaledTargets) {
          const catData = report.categoryBreakdown.get(name);
          const actualDaily = catData ? catData.hours / days : 0;
          const ideal = idealTargets.get(name);
          const delta = actualDaily - scaled.targetDuration;
          const deltaPct = scaled.targetDuration > 0 ? (delta / scaled.targetDuration * 100) : 0;

          let status: string;
          if (Math.abs(deltaPct) <= 20) status = "✅";
          else if (Math.abs(deltaPct) <= 50) status = delta > 0 ? "⚠️ Over" : "⚠️ Under";
          else status = delta > 0 ? "⛔ Way Over" : "⛔ Way Under";

          lines.push(`| ${name} | ${ideal?.targetDuration ?? 0}h | ${scaled.targetDuration.toFixed(1)}h | ${actualDaily.toFixed(1)}h | ${delta >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% | ${status} |`);
        }
        lines.push("");

        markdown += lines.join("\n");
      } catch {
        // Activity Types DB not available — skip targets comparison
      }

      return {
        content: [
          {
            type: "text" as const,
            text: markdown,
          },
        ],
      };
    }
  );
}
