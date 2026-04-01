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
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

export function registerProductivityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_productivity_report",
    "Weekly/monthly productivity analysis. Returns time allocation by category, task completion metrics, and comparison against Activity Types targets (daily averages computed from tracked hours only). Date range: past_week covers 8 calendar days, past_month covers 31. Use with: lifeos_temporal_analysis (baseline trends), lifeos_trajectory (target gaps), lifeos_create_report (save insights).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
    },
    async ({ period, date_from, date_to }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const to = resolved.date_to;
      const from = resolved.date_from;

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
      let markdown = `> Showing: ${resolved.rangeLabel}\n\n`;
      markdown += productivityReportToMarkdown(report);

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
        lines.push(`> Tracked: ${metrics.trackedDays.toFixed(2)} days (${metrics.totalHours.toFixed(1)}h ÷ 24) across ${metrics.days} calendar days. Targets as defined.`);
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

      markdown += `\n---\n\n> Next: Use \`lifeos_trajectory\` for target gap analysis, or \`lifeos_create_report\` to save this analysis.`;

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
