import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import { transformTask } from "../transformers/tasks.js";
import { synthesizeMonth, monthSynthesisToMarkdown } from "../transformers/month-synthesis.js";
import { extractTitle, extractString, extractDate, extractNumber } from "../transformers/shared.js";
import {
  computePeriodMetrics, computeBaseline, computeDeviation, computeTrend,
  loadActivityTargets, type PeriodMetrics, type BaselineMetrics, type TrendPoint
} from "../transformers/temporal.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

async function fetchActivitiesForRange(
  notion: NotionClient, dataSourceId: string, dateFrom: string, dateTo: string
) {
  const result = await notion.queryDataSource(dataSourceId, {
    page_size: 100,
    filter: {
      and: [
        { property: "Date", date: { on_or_after: dateFrom } },
        { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
      ],
    },
    sorts: [{ property: "Date", direction: "ascending" }],
  });
  return result.results.map(transformActivity);
}

function periodMetricsToMarkdown(
  metrics: PeriodMetrics,
  baseline: BaselineMetrics | null,
  deviations: ReturnType<typeof computeDeviation>[],
  trends: ReturnType<typeof computeTrend>[],
  monthSynthesis: ReturnType<typeof synthesizeMonth> | null
): string {
  const lines: string[] = [];

  lines.push(`# Temporal Analysis — ${metrics.periodLabel}`);
  lines.push("");

  // Period Summary
  lines.push("## Period Summary");
  lines.push("");
  lines.push(`- **Calendar days:** ${metrics.days}`);
  lines.push(`- **Tracked days:** ${metrics.trackedDays.toFixed(2)} (${metrics.totalHours.toFixed(1)}h ÷ 24)`);
  lines.push(`- **Total tracked:** ${metrics.totalHours.toFixed(1)}h`);
  lines.push(`- **Daily average (per calendar day):** ${metrics.dailyAverage.toFixed(1)}h`);
  lines.push(`- **Entries:** ${metrics.entriesCount}`);
  if (metrics.peakDay.date) {
    lines.push(`- **Peak day:** ${metrics.peakDay.date} (${metrics.peakDay.hours.toFixed(1)}h)`);
  }
  if (metrics.lowDay.date) {
    lines.push(`- **Low day:** ${metrics.lowDay.date} (${metrics.lowDay.hours.toFixed(1)}h)`);
  }
  lines.push("");

  // Category Breakdown
  lines.push("### Time Allocation");
  lines.push("");
  const sorted = [...metrics.categoryBreakdown.entries()].sort((a, b) => b[1].hours - a[1].hours);
  for (const [cat, data] of sorted) {
    const dailyAvg = metrics.categoryDailyAvg.get(cat) ?? 0;
    lines.push(`- **${cat}:** ${data.hours.toFixed(1)}h total (${dailyAvg.toFixed(1)}h/day avg) (${data.pctOfTotal.toFixed(0)}%) — ${data.count} entries`);
  }
  lines.push("");

  // Baseline Comparison
  if (baseline && deviations.length > 0) {
    lines.push("## Baseline Comparison");
    lines.push("");
    lines.push("| Metric | Current | Baseline | Δ | Δ% | Status |");
    lines.push("|--------|---------|----------|---|-----|--------|");
    for (const d of deviations) {
      const icon = d.severity === "significant" ? (d.direction === "above" ? "⬆️" : "⬇️") :
        d.direction === "on-track" ? "✅" : "⚠️";
      lines.push(`| ${d.metric} | ${d.current.toFixed(1)} | ${d.baseline.toFixed(1)} | ${d.delta >= 0 ? "+" : ""}${d.delta.toFixed(1)} | ${d.deltaPct >= 0 ? "+" : ""}${d.deltaPct.toFixed(1)}% | ${d.severity} ${icon} |`);
    }
    lines.push("");
  }

  // Trend Analysis
  if (trends.length > 0) {
    lines.push("## Trend Analysis");
    lines.push("");
    for (const t of trends) {
      const trendIcon = t.trend === "improving" ? "↗️" : t.trend === "declining" ? "↘️" : t.trend === "volatile" ? "〰️" : "→";
      lines.push(`- **${t.metric}:** ${t.trend.charAt(0).toUpperCase() + t.trend.slice(1)} ${trendIcon} (slope: ${t.slope > 0 ? "+" : ""}${t.slope.toFixed(3)}/day, R²: ${t.r2.toFixed(2)})`);
      lines.push(`  - Projected 7d: ${t.projection7d.toFixed(1)} | 30d: ${t.projection30d.toFixed(1)}`);
    }
    lines.push("");
  }

  // Month Synthesis (if available)
  if (monthSynthesis) {
    lines.push(monthSynthesisToMarkdown(monthSynthesis));
  }

  return lines.join("\n");
}

export function registerTemporalAnalysisTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_temporal_analysis",
    "Activity pattern analysis with baseline comparison, deviation detection, and trend analysis. Compares current period against N prior weeks. Multi-domain support: tasks (completion trends), financial (revenue/expense trends), diet (nutrition trends). Parameters: scope (day/week/month granularity), baseline_weeks (historical baseline), include_financial (month-level financial synthesis), include_tasks (task completion trends), include_diet (nutrition trends). Date range: past_week covers 8 calendar days, past_month covers 31. Use with: lifeos_productivity_report (for summary context), lifeos_trajectory (for target compliance), lifeos_create_report (save analysis).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      scope: z.enum(["day", "week", "month"]).default("week").describe("Temporal granularity"),
      baseline_weeks: z.number().default(4).describe("Number of prior weeks to compute baseline"),
      include_financial: z.boolean().default(false).describe("Include Month-level financial synthesis if period spans a full month"),
      include_tasks: z.boolean().default(false).describe("Include task completion trends"),
      include_diet: z.boolean().default(false).describe("Include nutrition/diet trends"),
    },
    async ({ period, date_from, date_to, scope, baseline_weeks, include_financial, include_tasks, include_diet }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const date_from_r = resolved.date_from;
      const date_to_r = resolved.date_to;
      const actDb = getDbConfig(config, "activity_log");
      const atDb = getDbConfig(config, "activity_types");

      // Fetch Activity Types for targets
      const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
      const targets = loadActivityTargets(atResult.results);

      // Fetch current period activities
      const currentActivities = await fetchActivitiesForRange(notion, actDb.data_source_id, date_from_r, date_to_r);
      const currentMetrics = computePeriodMetrics(currentActivities, date_from_r, date_to_r, targets);

      // Fetch baseline periods (N weeks before date_from)
      const baselineStart = new Date(new Date(date_from_r).getTime() - baseline_weeks * 7 * 24 * 60 * 60 * 1000);
      const baselineEnd = new Date(new Date(date_from_r).getTime() - 24 * 60 * 60 * 1000);
      const baselineActivities = await fetchActivitiesForRange(
        notion, actDb.data_source_id,
        baselineStart.toISOString().split("T")[0],
        baselineEnd.toISOString().split("T")[0]
      );

      // Compute weekly metrics for baseline period
      const baselineWeekMetrics: PeriodMetrics[] = [];
      for (let w = 0; w < baseline_weeks; w++) {
        const weekStart = new Date(baselineStart.getTime() + w * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        const weekActivities = baselineActivities.filter(a => {
          if (!a.date) return false;
          const d = new Date(a.date);
          return d >= weekStart && d <= weekEnd;
        });
        if (weekActivities.length > 0) {
          baselineWeekMetrics.push(computePeriodMetrics(
            weekActivities,
            weekStart.toISOString().split("T")[0],
            weekEnd.toISOString().split("T")[0],
            targets
          ));
        }
      }

      // Compute baselines from historical weekly averages
      const dailyAvgs = baselineWeekMetrics.map(m => m.dailyAverage);
      const baseline = computeBaseline(dailyAvgs, "Daily Hours");

      // Compute deviations
      const deviations: ReturnType<typeof computeDeviation>[] = [];
      if (baseline.samples > 0) {
        deviations.push(computeDeviation(currentMetrics.dailyAverage, baseline));

        // Per-category deviations
        for (const [cat] of currentMetrics.categoryBreakdown) {
          const catBaselines = baselineWeekMetrics.map(m => m.categoryBreakdown.get(cat)?.hours ?? 0);
          const catBaseline = computeBaseline(catBaselines, cat);
          const catCurrent = currentMetrics.categoryBreakdown.get(cat)?.hours ?? 0;
          if (catBaseline.samples > 0) {
            deviations.push(computeDeviation(catCurrent, catBaseline));
          }
        }
      }

      // Compute trends from daily hours over baseline weeks + current
      const trendPoints: TrendPoint[] = [];
      for (const wm of [...baselineWeekMetrics, currentMetrics]) {
        for (const [date, hours] of wm.dailyHours) {
          trendPoints.push({ date, value: hours });
        }
      }
      trendPoints.sort((a, b) => a.date.localeCompare(b.date));

      const trends: ReturnType<typeof computeTrend>[] = [];
      if (trendPoints.length >= 3) {
        trends.push(computeTrend(trendPoints, "Daily Hours"));
      }

      // Month synthesis (if requested and period is ~1 month)
      let monthSynthesis: ReturnType<typeof synthesizeMonth> | null = null;
      if (include_financial && scope === "month") {
        const monthsDb = getDbConfig(config, "months");
        const monthResult = await notion.queryDataSource(monthsDb.data_source_id, {
          page_size: 1,
          filter: {
            and: [
              { property: "Month Start", formula: { date: { on_or_after: date_from_r } } },
              { property: "Month End", formula: { date: { on_or_before: date_to_r } } },
            ],
          },
        });
        if (monthResult.results.length > 0) {
          monthSynthesis = synthesizeMonth(monthResult.results[0]);
        }
      }

      // Task completion trends (if requested)
      let taskTrendSection = "";
      if (include_tasks) {
        const taskDb = getDbConfig(config, "tasks");
        const taskResult = await notion.queryDataSource(taskDb.data_source_id, {
          page_size: 200,
        });
        const tasks = taskResult.results.map(transformTask);

        const completedTasks = tasks.filter(t => t.status === "Done");
        const activeTasks = tasks.filter(t => ["Active", "Focus", "Up Next"].includes(t.status));
        const overdueTasks = activeTasks.filter(t => t.isOverdue);

        // Build daily completion trend using last_edited_time from raw pages
        const taskTrendPoints: TrendPoint[] = [];
        const dailyTaskMap = new Map<string, number>();
        for (const t of completedTasks) {
          const rawPage = taskResult.results.find(p => p.id === t.id);
          if (!rawPage) continue;
          const lastEdited = rawPage.last_edited_time || "";
          if (!lastEdited) continue;
          const dateStr = lastEdited.split("T")[0];
          dailyTaskMap.set(dateStr, (dailyTaskMap.get(dateStr) || 0) + 1);
        }
        for (const [date, count] of [...dailyTaskMap.entries()].sort()) {
          if (date >= date_from_r && date <= date_to_r) {
            taskTrendPoints.push({ date, value: count });
          }
        }

        let taskTrendStr = "";
        if (taskTrendPoints.length >= 3) {
          const taskTrend = computeTrend(taskTrendPoints, "Tasks Completed/Day");
          taskTrendStr = `Trend: ${taskTrend.trend} (slope: ${taskTrend.slope > 0 ? "+" : ""}${taskTrend.slope.toFixed(3)}/day)`;
        }

        taskTrendSection = `

## Task Completion Trends

- **Completed:** ${completedTasks.length}
- **Active:** ${activeTasks.length}
- **Overdue:** ${overdueTasks.length}
${taskTrendStr ? `- **${taskTrendStr}` : ""}
`;
      }

      // Diet/nutrition trends (if requested)
      let dietTrendSection = "";
      if (include_diet) {
        const dietDb = getDbConfig(config, "diet_log");
        const dietResult = await notion.queryDataSource(dietDb.data_source_id, {
          page_size: 100,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: date_from_r } },
              { property: "Date", date: { on_or_before: `${date_to_r}T23:59:59Z` } },
            ],
          },
        });

        const dailyDietMap = new Map<string, number>();
        for (const p of dietResult.results) {
          const date = extractDate(p, "Date");
          if (date) {
            const dateStr = date.split("T")[0];
            dailyDietMap.set(dateStr, (dailyDietMap.get(dateStr) || 0) + 1);
          }
        }

        const dietTrendPoints: TrendPoint[] = [];
        for (const [date, count] of [...dailyDietMap.entries()].sort()) {
          dietTrendPoints.push({ date, value: count });
        }

        let dietTrendStr = "";
        if (dietTrendPoints.length >= 3) {
          const dietTrend = computeTrend(dietTrendPoints, "Meals Logged/Day");
          dietTrendStr = `Trend: ${dietTrend.trend} (slope: ${dietTrend.slope > 0 ? "+" : ""}${dietTrend.slope.toFixed(3)}/day)`;
        }

        const totalDays = Math.ceil((new Date(date_to_r).getTime() - new Date(date_from_r).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const coverage = dietResult.results.length > 0 ? ((dietResult.results.length / totalDays) * 100).toFixed(0) : "0";

        dietTrendSection = `

## Nutrition Trends

- **Meals logged:** ${dietResult.results.length}
- **Coverage:** ${coverage}% of days
${dietTrendStr ? `- **${dietTrendStr}` : ""}
`;
      }

      let markdown = `> Showing: ${resolved.rangeLabel}\n\n`;
      markdown += periodMetricsToMarkdown(currentMetrics, baseline, deviations, trends, monthSynthesis);
      if (taskTrendSection) markdown += taskTrendSection;
      if (dietTrendSection) markdown += dietTrendSection;
      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
