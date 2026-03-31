import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import {
  loadActivityTargets, scaleTargetsByTrackedTime, trackedHoursPerDay,
  computePeriodMetrics, computeTrend, mapTrajectory,
  type ActivityTarget, type TrendPoint
} from "../transformers/temporal.js";

function trajectoryToMarkdown(
  currentMetrics: ReturnType<typeof computePeriodMetrics>,
  idealTargets: Map<string, ActivityTarget>,
  scaledTargets: Map<string, ActivityTarget>,
  trackingRatio: number,
  trackedPerDay: number,
  trends: Map<string, ReturnType<typeof computeTrend>>
): string {
  const lines: string[] = [];

  lines.push(`# Trajectory Analysis — ${currentMetrics.periodLabel}`);
  lines.push("");

  // Tracking context
  const idealTotal = [...idealTargets.values()].reduce((s, t) => s + t.targetDuration, 0);
  lines.push("## Tracking Context");
  lines.push("");
  lines.push(`- **Tracked time:** ${trackedPerDay.toFixed(1)}h/day (out of 24h)`);
  lines.push(`- **Tracking ratio:** ${(trackingRatio * 100).toFixed(0)}%`);
  lines.push(`- **Ideal total allocation:** ${idealTotal.toFixed(1)}h/day`);
  lines.push(`- **Scaled total allocation:** ${(idealTotal * trackingRatio).toFixed(1)}h/day`);
  lines.push(`- Targets are scaled proportionally — comparisons reflect your tracked time only.`);
  lines.push("");

  // Activity vs Scaled Targets
  lines.push("## Activity vs Scaled Targets");
  lines.push("");
  lines.push("| Activity | Ideal | Scaled | Actual/day | Δ | Status |");
  lines.push("|----------|-------|--------|------------|---|--------|");

  const currentDaily = new Map<string, number>();
  for (const [cat, data] of currentMetrics.categoryBreakdown) {
    currentDaily.set(cat, data.hours / currentMetrics.days);
  }

  const sortedEntries = [...scaledTargets.entries()].sort((a, b) => {
    const aCurrent = currentDaily.get(a[0]) ?? 0;
    const bCurrent = currentDaily.get(b[0]) ?? 0;
    const aGap = Math.abs(aCurrent - a[1].targetDuration);
    const bGap = Math.abs(bCurrent - b[1].targetDuration);
    return bGap - aGap;
  });

  for (const [name, scaled] of sortedEntries) {
    const ideal = idealTargets.get(name);
    const current = currentDaily.get(name) ?? 0;
    const delta = current - scaled.targetDuration;
    const deltaPct = scaled.targetDuration > 0 ? (delta / scaled.targetDuration * 100) : 0;
    const trend = trends.get(name);
    const trendStr = trend ? (trend.trend === "improving" ? "↗️" : trend.trend === "declining" ? "↘️" : "→") : "—";

    let status: string;
    const absDeltaPct = Math.abs(deltaPct);
    if (absDeltaPct <= 20) status = "✅ On Track";
    else if (absDeltaPct <= 50) status = delta > 0 ? "⚠️ Over" : "⚠️ Under";
    else status = delta > 0 ? "⛔ Way Over" : "⛔ Way Under";

    lines.push(
      `| ${name} | ${ideal?.targetDuration ?? 0}h | ${scaled.targetDuration.toFixed(1)}h | ${current.toFixed(1)}h | ${delta >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% | ${status} |`
    );
  }
  lines.push("");

  // Daily Allocation Budget
  lines.push("## Daily Allocation Budget");
  lines.push("");

  const actualTotal = [...currentDaily.values()].reduce((s, v) => s + v, 0);
  const scaledTotal = [...scaledTargets.values()].reduce((s, t) => s + t.targetDuration, 0);
  const overBudget: string[] = [];
  const underBudget: string[] = [];

  for (const [name, scaled] of scaledTargets) {
    const actual = currentDaily.get(name) ?? 0;
    const gap = actual - scaled.targetDuration;
    if (gap > 0.3) overBudget.push(`${name} (+${gap.toFixed(1)}h)`);
    if (gap < -0.3) underBudget.push(`${name} (${gap.toFixed(1)}h)`);
  }

  lines.push(`- **Tracked:** ${actualTotal.toFixed(1)}h/day`);
  lines.push(`- **Scaled target total:** ${scaledTotal.toFixed(1)}h/day`);
  lines.push(`- **Surplus/Deficit:** ${(actualTotal - scaledTotal).toFixed(1)}h`);
  lines.push("");

  if (overBudget.length > 0) lines.push(`- **Over-budget:** ${overBudget.join(", ")}`);
  if (underBudget.length > 0) lines.push(`- **Under-budget:** ${underBudget.join(", ")}`);
  lines.push("");

  // Habit compliance (using scaled targets)
  lines.push("## Habit Compliance");
  lines.push("");

  for (const [name, scaled] of scaledTargets) {
    if (!scaled.isHabit) continue;
    const actual = currentDaily.get(name) ?? 0;
    const compliance = scaled.targetDuration > 0 ? (actual / scaled.targetDuration * 100) : 0;
    const bar = "█".repeat(Math.min(10, Math.round(compliance / 10))) + "░".repeat(Math.max(0, 10 - Math.round(compliance / 10)));
    lines.push(
      `- **${name}:** ${compliance.toFixed(0)}% ${bar} (${actual.toFixed(1)}h / ${scaled.targetDuration.toFixed(1)}h scaled target [ideal: ${idealTargets.get(name)?.targetDuration ?? 0}h])`
    );
  }
  lines.push("");

  // Trajectory projections (using scaled targets)
  const keyActivities = ["Work", "Recreation", "Sleep", "Workout"];
  const projectionLines: string[] = [];
  for (const act of keyActivities) {
    const trend = trends.get(act);
    const scaled = scaledTargets.get(act);
    const ideal = idealTargets.get(act);
    if (!trend || !scaled) continue;

    const current = currentDaily.get(act) ?? 0;
    const trajectory = mapTrajectory(current, scaled.targetDuration, trend.slope, 30);
    trajectory.metric = act;

    projectionLines.push(`### ${act} → ${scaled.targetDuration.toFixed(1)}h/day (scaled from ${ideal?.targetDuration ?? 0}h)`);
    projectionLines.push(`- Current: ${current.toFixed(1)}h/day | Scaled target: ${scaled.targetDuration.toFixed(1)}h/day`);
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
    "Map your activity trajectory against ideal targets from Activity Types. Targets are automatically scaled based on your tracked hours — comparisons reflect only the time you actually tracked, not a full 24h day.",
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
      const idealTargets = loadActivityTargets(atResult.results);

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
      const currentMetrics = computePeriodMetrics(currentActivities, date_from, date_to, idealTargets);

      // Scale targets based on tracked hours
      const trackedPerDay = trackedHoursPerDay(currentMetrics.categoryBreakdown, currentMetrics.days);
      const idealTotal = [...idealTargets.values()].reduce((s, t) => s + t.targetDuration, 0);
      const trackingRatio = idealTotal > 0 ? Math.min(1, trackedPerDay / idealTotal) : 1;
      const scaledTargets = scaleTargetsByTrackedTime(idealTargets, trackedPerDay);

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
      for (const [actName] of idealTargets) {
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

      const markdown = trajectoryToMarkdown(
        currentMetrics, idealTargets, scaledTargets, trackingRatio, trackedPerDay, trends
      );

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
