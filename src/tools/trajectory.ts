import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import {
  loadActivityTargets, computePeriodMetrics, computeTrend,
  mapTrajectory, type ActivityTarget, type TrendPoint
} from "../transformers/temporal.js";

function trajectoryToMarkdown(
  currentMetrics: ReturnType<typeof computePeriodMetrics>,
  targets: Map<string, ActivityTarget>,
  trends: Map<string, ReturnType<typeof computeTrend>>
): string {
  const lines: string[] = [];

  lines.push(`# Trajectory Analysis — ${currentMetrics.periodLabel}`);
  lines.push("");

  // Activity vs Ideal Targets
  lines.push("## Activity vs Ideal Targets");
  lines.push("");
  lines.push("| Activity | Target/day | Current/day | Δ | Trend | Status |");
  lines.push("|----------|-----------|-------------|---|-------|--------|");

  const currentDaily = new Map<string, number>();
  for (const [cat, data] of currentMetrics.categoryBreakdown) {
    currentDaily.set(cat, data.hours / currentMetrics.days);
  }

  const sortedEntries = [...targets.entries()].sort((a, b) => {
    const aCurrent = currentDaily.get(a[0]) ?? 0;
    const bCurrent = currentDaily.get(b[0]) ?? 0;
    const aGap = Math.abs(aCurrent - a[1].targetDuration);
    const bGap = Math.abs(bCurrent - b[1].targetDuration);
    return bGap - aGap; // Largest gaps first
  });

  for (const [name, target] of sortedEntries) {
    const current = currentDaily.get(name) ?? 0;
    const delta = current - target.targetDuration;
    const deltaPct = target.targetDuration > 0 ? (delta / target.targetDuration * 100) : 0;
    const trend = trends.get(name);
    const trendStr = trend ? (trend.trend === "improving" ? "↗️" : trend.trend === "declining" ? "↘️" : "→") : "—";

    let status: string;
    const absDeltaPct = Math.abs(deltaPct);
    if (absDeltaPct <= 15) status = "✅ On Track";
    else if (absDeltaPct <= 40) status = delta > 0 ? "⚠️ Over" : "⚠️ Under";
    else status = delta > 0 ? "⛔ Way Over" : "⛔ Way Under";

    lines.push(`| ${name} | ${target.targetDuration}h | ${current.toFixed(1)}h | ${delta >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% | ${trendStr} | ${status} |`);
  }
  lines.push("");

  // Daily Allocation Budget
  lines.push("## Daily Allocation Budget");
  lines.push("");

  let idealTotal = 0;
  let actualTotal = 0;
  const overBudget: string[] = [];
  const underBudget: string[] = [];

  for (const [name, target] of targets) {
    const actual = currentDaily.get(name) ?? 0;
    idealTotal += target.targetDuration;
    actualTotal += actual;
    const gap = actual - target.targetDuration;
    if (gap > 0.5) overBudget.push(`${name} (+${gap.toFixed(1)}h)`);
    if (gap < -0.5) underBudget.push(`${name} (${gap.toFixed(1)}h)`);
  }

  const untracked = Math.max(0, 24 - actualTotal);
  lines.push(`- **Ideal allocation:** ${idealTotal.toFixed(1)}h across ${targets.size} activities`);
  lines.push(`- **Actual tracked:** ${actualTotal.toFixed(1)}h/day`);
  lines.push(`- **Untracked gap:** ${untracked.toFixed(1)}h`);
  lines.push("");

  if (overBudget.length > 0) {
    lines.push(`- **Over-budget:** ${overBudget.join(", ")}`);
  }
  if (underBudget.length > 0) {
    lines.push(`- **Under-budget:** ${underBudget.join(", ")}`);
  }
  lines.push("");

  // Habit compliance
  lines.push("## Habit Compliance");
  lines.push("");
  const habitTargets = [...targets.values()].filter(t => t.isHabit);
  const habitEntries = currentMetrics.entriesCount > 0
    ? [...currentMetrics.categoryBreakdown.entries()].filter(([name]) => targets.get(name)?.isHabit)
    : [];

  for (const [name, target] of targets) {
    if (!target.isHabit) continue;
    const actual = currentDaily.get(name) ?? 0;
    const compliance = target.targetDuration > 0 ? (actual / target.targetDuration * 100) : 0;
    const bar = "█".repeat(Math.min(10, Math.round(compliance / 10))) + "░".repeat(Math.max(0, 10 - Math.round(compliance / 10)));
    lines.push(`- **${name}:** ${compliance.toFixed(0)}% ${bar} (${actual.toFixed(1)}h / ${target.targetDuration}h target)`);
  }
  lines.push("");

  // Trajectory projection for key activities
  const keyActivities = ["Work", "Recreation", "Sleep", "Workout"];
  const projectionLines: string[] = [];
  for (const act of keyActivities) {
    const trend = trends.get(act);
    const target = targets.get(act);
    if (!trend || !target) continue;

    const current = currentDaily.get(act) ?? 0;
    const trajectory = mapTrajectory(
      current,
      target.targetDuration,
      trend.slope,
      30
    );
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
    "Map your activity trajectory against ideal targets defined in the Activity Types database. Compares current daily averages to targets, computes trends, and projects whether you're on track. Targets are derived from Activity Types — no hardcoded values.",
    {
      date_from: z.string().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().describe("End date (YYYY-MM-DD)"),
      baseline_weeks: z.number().default(4).describe("Weeks of history for trend computation"),
    },
    async ({ date_from, date_to, baseline_weeks }) => {
      const actDb = getDbConfig(config, "activity_log");
      const atDb = getDbConfig(config, "activity_types");

      // Fetch Activity Types for ideal targets
      const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
      const targets = loadActivityTargets(atResult.results);

      // Fetch current period activities
      const currentResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: date_from } },
            { property: "Date", date: { on_or_before: `${date_to}T23:59:59Z` } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });
      const currentActivities = currentResult.results.map(transformActivity);
      const currentMetrics = computePeriodMetrics(currentActivities, date_from, date_to, targets);

      // Fetch baseline period for trends
      const baselineStart = new Date(new Date(date_from).getTime() - baseline_weeks * 7 * 24 * 60 * 60 * 1000);
      const baselineResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: baselineStart.toISOString().split("T")[0] } },
            { property: "Date", date: { on_or_before: `${date_to}T23:59:59Z` } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });
      const allActivities = baselineResult.results.map(transformActivity);

      // Compute per-activity trends
      const trends = new Map<string, ReturnType<typeof computeTrend>>();
      for (const [actName] of targets) {
        const points: TrendPoint[] = [];
        // Group by day and sum hours
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

      const markdown = trajectoryToMarkdown(currentMetrics, targets, trends);

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
