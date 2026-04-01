import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import {
  loadActivityTargets, computePeriodMetrics, computeTrend, mapTrajectory,
  type ActivityTarget, type TrendPoint
} from "../transformers/temporal.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

function trajectoryToMarkdown(
  currentMetrics: ReturnType<typeof computePeriodMetrics>,
  targets: Map<string, ActivityTarget>,
  trends: Map<string, ReturnType<typeof computeTrend>>
): string {
  const lines: string[] = [];

  lines.push(`# Trajectory Analysis — ${currentMetrics.periodLabel}`);
  lines.push("");

  // Tracking context
  lines.push("## Tracking Context");
  lines.push("");
  lines.push(`- **Calendar days:** ${currentMetrics.days}`);
  lines.push(`- **Tracked days:** ${currentMetrics.trackedDays.toFixed(2)} (${currentMetrics.totalHours.toFixed(1)}h ÷ 24)`);
  lines.push(`- **Daily average (per calendar day):** ${currentMetrics.dailyAverage.toFixed(1)}h`);
  lines.push(`- Targets are as defined in Activity Types. Per-day averages computed from tracked days.`);
  lines.push("");

  // Activity vs Targets
  lines.push("## Activity vs Targets");
  lines.push("");
  lines.push("| Activity | Target/day | Actual/day | Δ | Trend | Status |");
  lines.push("|----------|-----------|------------|---|-------|--------|");

  const sortedEntries = [...targets.entries()].sort((a, b) => {
    const aActual = currentMetrics.categoryDailyAvg.get(a[0]) ?? 0;
    const bActual = currentMetrics.categoryDailyAvg.get(b[0]) ?? 0;
    const aGap = Math.abs(aActual - a[1].targetDuration);
    const bGap = Math.abs(bActual - b[1].targetDuration);
    return bGap - aGap;
  });

  for (const [name, target] of sortedEntries) {
    const current = currentMetrics.categoryDailyAvg.get(name) ?? 0;
    const delta = current - target.targetDuration;
    const deltaPct = target.targetDuration > 0 ? (delta / target.targetDuration * 100) : 0;
    const trend = trends.get(name);
    const trendStr = trend ? (trend.trend === "improving" ? "↗️" : trend.trend === "declining" ? "↘️" : "→") : "—";

    let status: string;
    const absDeltaPct = Math.abs(deltaPct);
    if (absDeltaPct <= 20) status = "✅ On Track";
    else if (absDeltaPct <= 50) status = delta > 0 ? "⚠️ Over" : "⚠️ Under";
    else status = delta > 0 ? "⛔ Way Over" : "⛔ Way Under";

    lines.push(`| ${name} | ${target.targetDuration}h | ${current.toFixed(1)}h | ${delta >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% | ${trendStr} | ${status} |`);
  }
  lines.push("");

  // Allocation Budget
  lines.push("## Daily Allocation Budget");
  lines.push("");

  const actualTotal = currentMetrics.dailyAverage;
  const targetTotal = [...targets.values()].reduce((s, t) => s + t.targetDuration, 0);
  const overBudget: string[] = [];
  const underBudget: string[] = [];

  for (const [name, target] of targets) {
    const actual = currentMetrics.categoryDailyAvg.get(name) ?? 0;
    const gap = actual - target.targetDuration;
    if (gap > 0.3) overBudget.push(`${name} (+${gap.toFixed(1)}h)`);
    if (gap < -0.3) underBudget.push(`${name} (${gap.toFixed(1)}h)`);
  }

  lines.push(`- **Tracked:** ${currentMetrics.totalHours.toFixed(1)}h over ${currentMetrics.trackedDays.toFixed(2)} days`);
  lines.push(`- **Target total:** ${targetTotal.toFixed(1)}h`);
  lines.push(`- **Surplus/Deficit:** ${(actualTotal - targetTotal).toFixed(1)}h`);
  lines.push("");

  if (overBudget.length > 0) lines.push(`- **Over-budget:** ${overBudget.join(", ")}`);
  if (underBudget.length > 0) lines.push(`- **Under-budget:** ${underBudget.join(", ")}`);
  lines.push("");

  // Habit compliance
  lines.push("## Habit Compliance");
  lines.push("");

  for (const [name, target] of targets) {
    if (!target.isHabit) continue;
    const actual = currentMetrics.categoryDailyAvg.get(name) ?? 0;
    const compliance = target.targetDuration > 0 ? (actual / target.targetDuration * 100) : 0;
    const bar = "█".repeat(Math.min(10, Math.round(compliance / 10))) + "░".repeat(Math.max(0, 10 - Math.round(compliance / 10)));
    lines.push(`- **${name}:** ${compliance.toFixed(0)}% ${bar} (${actual.toFixed(1)}h / ${target.targetDuration}h target)`);
  }
  lines.push("");

  // Trajectory projections
  const keyActivities = ["Work", "Recreation", "Sleep", "Workout"];
  const projectionLines: string[] = [];
  for (const act of keyActivities) {
    const trend = trends.get(act);
    const target = targets.get(act);
    if (!trend || !target) continue;

    const current = currentMetrics.categoryDailyAvg.get(act) ?? 0;
    const trajectory = mapTrajectory(current, target.targetDuration, trend.slope, 30);
    trajectory.metric = act;

    projectionLines.push(`### ${act} → ${target.targetDuration}h/day`);
    projectionLines.push(`- Current: ${current.toFixed(1)}h/day | Target: ${target.targetDuration}h/day`);
    projectionLines.push(`- Trend: ${trend.slope > 0 ? "+" : ""}${trend.slope.toFixed(3)}h/day (${trend.trend})`);
    projectionLines.push(`- ${trajectory.insight}`);
    projectionLines.push("");
  }

  if (projectionLines.length > 0) {
    lines.push("## Trajectory Projections (30-day)");
    lines.push("");
    lines.push(...projectionLines);
  }

  return lines.join("\n");
}

export function registerTrajectoryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_trajectory",
    "Target compliance analysis. Maps activity averages against ideal targets from Activity Types. Shows per-activity gaps, habit compliance, 30-day projections, and trend direction. Averages use tracked-hours only (untracked days excluded). Use with: lifeos_productivity_report (for allocation context), lifeos_weekday_patterns (for scheduling by weekday), lifeos_tasks (for task prioritization based on gaps).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      baseline_weeks: z.number().default(4).describe("Weeks of history for trend computation"),
    },
    async ({ period, date_from, date_to, baseline_weeks }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const date_from_r = resolved.date_from;
      const date_to_r = resolved.date_to;
      const actDb = getDbConfig(config, "activity_log");
      const atDb = getDbConfig(config, "activity_types");

      // Fetch Activity Types for targets
      const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
      const targets = loadActivityTargets(atResult.results);

      // Fetch current period activities
      const currentResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: date_from_r } },
            { property: "Date", date: { on_or_before: `${date_to_r}T23:59:59Z` } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });
      const currentActivities = currentResult.results.map(transformActivity);
      const currentMetrics = computePeriodMetrics(currentActivities, date_from_r, date_to_r, targets);

      // Fetch baseline period for trends
      const baselineStart = new Date(new Date(date_from_r).getTime() - baseline_weeks * 7 * 24 * 60 * 60 * 1000);
      const baselineResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: baselineStart.toISOString().split("T")[0] } },
            { property: "Date", date: { on_or_before: `${date_to_r}T23:59:59Z` } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });
      const allActivities = baselineResult.results.map(transformActivity);

      // Per-activity trends
      const trends = new Map<string, ReturnType<typeof computeTrend>>();
      for (const [actName] of targets) {
        const points: TrendPoint[] = [];
        const dailyMap = new Map<string, number>();
        for (const a of allActivities) {
          if (a.activityType === actName && a.date) {
            const day = a.date.split("T")[0];
            dailyMap.set(day, (dailyMap.get(day) || 0) + (a.durationHours ?? 0));
          }
        }
        for (const [date, hours] of [...dailyMap.entries()].sort()) {
          points.push({ date, value: hours });
        }
        if (points.length >= 3) {
          trends.set(actName, computeTrend(points, actName));
        }
      }

      let markdown = `> Showing: ${resolved.rangeLabel}\n\n`;
      markdown += trajectoryToMarkdown(currentMetrics, targets, trends);
      markdown += `\n---\n\n> Next: Use \`lifeos_weekday_patterns\` to plan by weekday, or \`lifeos_create_report\` to save this analysis.`;

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
