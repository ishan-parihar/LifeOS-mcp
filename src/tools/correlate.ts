import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import { extractDate, extractNumber, extractString } from "../transformers/shared.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";

export function registerCorrelateTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_correlate",
    "Statistical correlation engine. Computes Pearson correlation, lag analysis, and conditional probability between any two measurable time series domains. Domains: work_hours, sleep_hours, workout_hours, mood_entries, revenue, expenses, tasks_completed. Use with: lifeos_temporal_analysis (individual domain trends), lifeos_trajectory (target gaps).",
    {
      domain_a: z.enum(["work_hours", "sleep_hours", "workout_hours", "mood_entries", "revenue", "expenses", "tasks_completed"]).describe("First domain to correlate"),
      domain_b: z.enum(["work_hours", "sleep_hours", "workout_hours", "mood_entries", "revenue", "expenses", "tasks_completed"]).describe("Second domain to correlate"),
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      lag_days: z.number().default(0).describe("Days to lag domain_b (positive = domain_b lags behind domain_a)"),
    },
    async ({ domain_a, domain_b, period, date_from, date_to, lag_days }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const dateFrom = resolved.date_from;
      const dateTo = resolved.date_to;

      // Fetch all required data
      const actDb = getDbConfig(config, "activity_log");
      const actResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 200,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
      });
      const activities = actResult.results.map(transformActivity);

      const finDb = getDbConfig(config, "financial_log");
      const finResult = await notion.queryDataSource(finDb.data_source_id, {
        page_size: 200,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
      });

      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, {
        page_size: 200,
      });

      const moodDb = getDbConfig(config, "subjective_journal");
      const moodResult = await notion.queryDataSource(moodDb.data_source_id, {
        page_size: 200,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
      });

      // Build daily time series
      const dailyMap = buildDailyTimeSeries(activities, finResult.results, taskResult.results, moodResult.results, dateFrom, dateTo);

      // Extract series for domains
      const seriesA = extractDomainSeries(dailyMap, domain_a);
      const seriesB = extractDomainSeries(dailyMap, domain_b);

      // Apply lag
      const laggedB = applyLag(seriesB, lag_days);

      // Compute correlation
      const correlation = pearsonCorrelation(seriesA, laggedB);

      // Compute conditional probability
      const condProb = computeConditionalProbability(seriesA, laggedB);

      // Build output
      const lines: string[] = [];
      lines.push(`# Correlation Analysis — ${resolved.rangeLabel}`);
      lines.push("");
      lines.push(`## ${formatDomainName(domain_a)} ↔ ${formatDomainName(domain_b)}`);
      lines.push("");
      lines.push(`- **Lag:** ${lag_days} day(s) (${lag_days > 0 ? `${formatDomainName(domain_b)} lags` : lag_days < 0 ? `${formatDomainName(domain_a)} lags` : "No lag"})`);
      lines.push(`- **Data points:** ${seriesA.length}`);
      lines.push(`- **Pearson r:** ${correlation.toFixed(3)}`);
      lines.push(`- **Strength:** ${correlationStrength(correlation)}`);
      lines.push(`- **Direction:** ${correlationDirection(correlation)}`);
      lines.push("");

      // Interpretation
      lines.push("## Interpretation");
      lines.push("");
      lines.push(correlationInterpretation(domain_a, domain_b, correlation, lag_days));
      lines.push("");

      // Conditional probability
      if (condProb) {
        lines.push("## Conditional Probability");
        lines.push("");
        lines.push(`- P(High ${formatDomainName(domain_b)} | High ${formatDomainName(domain_a)}): ${(condProb.highGivenHigh * 100).toFixed(0)}%`);
        lines.push(`- P(High ${formatDomainName(domain_b)} | Low ${formatDomainName(domain_a)}): ${(condProb.highGivenLow * 100).toFixed(0)}%`);
        lines.push(`- P(Low ${formatDomainName(domain_b)} | High ${formatDomainName(domain_a)}): ${(condProb.lowGivenHigh * 100).toFixed(0)}%`);
        lines.push(`- P(Low ${formatDomainName(domain_b)} | Low ${formatDomainName(domain_a)}): ${(condProb.lowGivenLow * 100).toFixed(0)}%`);
        lines.push("");
      }

      // Daily data table
      lines.push("## Daily Data");
      lines.push("");
      lines.push(`| Date | ${formatDomainName(domain_a)} | ${formatDomainName(domain_b)} |`);
      lines.push("|------|----------------------|----------------------|");

      const dates = [...dailyMap.keys()].sort();
      for (const date of dates) {
        const dayData = dailyMap.get(date)!;
        const valA = getDomainValue(dayData, domain_a);
        const valB = getDomainValue(dayData, domain_b);
        lines.push(`| ${date} | ${valA.toFixed(1)} | ${valB.toFixed(1)} |`);
      }
      lines.push("");

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

interface DailyData {
  workHours: number;
  sleepHours: number;
  workoutHours: number;
  moodEntries: number;
  revenue: number;
  expenses: number;
  tasksCompleted: number;
}

function buildDailyTimeSeries(
  activities: any[],
  financialResults: any[],
  taskResults: any[],
  moodResults: any[],
  dateFrom: string,
  dateTo: string
): Map<string, DailyData> {
  const map = new Map<string, DailyData>();

  // Initialize all dates
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    map.set(dateStr, {
      workHours: 0,
      sleepHours: 0,
      workoutHours: 0,
      moodEntries: 0,
      revenue: 0,
      expenses: 0,
      tasksCompleted: 0,
    });
  }

  // Activities
  for (const a of activities) {
    if (!a.date) continue;
    const dateStr = a.date.split("T")[0];
    const data = map.get(dateStr);
    if (!data) continue;

    const type = a.activityType.toLowerCase();
    const dur = a.durationHours ?? 0;

    if (type.includes("work")) data.workHours += dur;
    if (type.includes("sleep")) data.sleepHours += dur;
    if (type.includes("workout") || type.includes("exercise") || type.includes("gym") || type.includes("sport")) {
      data.workoutHours += dur;
    }
  }

  // Financial
  const revenueCategories = ["Business Revenue", "Client Payment", "Investment Income", "Income"];
  for (const p of financialResults) {
    const date = extractDate(p, "Date");
    if (!date) continue;
    const dateStr = date.split("T")[0];
    const data = map.get(dateStr);
    if (!data) continue;

    const amount = extractNumber(p, "Amount") ?? 0;
    const category = extractString(p, "Category");

    if (revenueCategories.includes(category)) {
      data.revenue += amount;
    } else {
      data.expenses += amount;
    }
  }

  // Tasks completed — use action_date as proxy for completion date
  const doneTasks = taskResults.filter((t: any) => {
    const status = t.properties["Status"]?.status?.name;
    return status === "Done";
  });
  for (const t of doneTasks) {
    const actionDateProp = t.properties["Action Date"];
    if (!actionDateProp) continue;
    let dateStr = "";
    if (actionDateProp.type === "date" && actionDateProp.date) {
      dateStr = actionDateProp.date.start.split("T")[0];
    }
    if (!dateStr) continue;
    const data = map.get(dateStr);
    if (data) {
      data.tasksCompleted += 1;
    }
  }

  // Mood entries — use actual dates from subjective_journal
  for (const m of moodResults) {
    const date = extractDate(m, "Date");
    if (!date) continue;
    const dateStr = date.split("T")[0];
    const data = map.get(dateStr);
    if (data) {
      data.moodEntries += 1;
    }
  }

  return map;
}

function extractDomainSeries(dailyMap: Map<string, DailyData>, domain: string): number[] {
  const values: number[] = [];
  for (const data of dailyMap.values()) {
    values.push(getDomainValue(data, domain));
  }
  return values;
}

function getDomainValue(data: DailyData, domain: string): number {
  switch (domain) {
    case "work_hours": return data.workHours;
    case "sleep_hours": return data.sleepHours;
    case "workout_hours": return data.workoutHours;
    case "mood_entries": return data.moodEntries;
    case "revenue": return data.revenue;
    case "expenses": return data.expenses;
    case "tasks_completed": return data.tasksCompleted;
    default: return 0;
  }
}

function applyLag(series: number[], lagDays: number): number[] {
  if (lagDays === 0) return series;
  const result = new Array(series.length).fill(0);
  for (let i = 0; i < series.length; i++) {
    const srcIdx = i - lagDays;
    if (srcIdx >= 0 && srcIdx < series.length) {
      result[i] = series[srcIdx];
    }
  }
  return result;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

function correlationStrength(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return "Strong";
  if (abs >= 0.4) return "Moderate";
  if (abs >= 0.2) return "Weak";
  return "Negligible";
}

function correlationDirection(r: number): string {
  return r >= 0 ? "Positive" : "Negative";
}

function correlationInterpretation(a: string, b: string, r: number, lag: number): string {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "increase together" : "move in opposite directions";
  const lagStr = lag !== 0 ? ` with ${Math.abs(lag)} day(s) lag` : "";

  if (abs >= 0.7) {
    return `Strong ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}). ${formatDomainName(a)} and ${formatDomainName(b)} ${direction}${lagStr}. This suggests a meaningful relationship between these domains.`;
  } else if (abs >= 0.4) {
    return `Moderate ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}). ${formatDomainName(a)} and ${formatDomainName(b)} tend to ${direction}${lagStr}, but the relationship is not strong.`;
  } else if (abs >= 0.2) {
    return `Weak ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}). There is a slight tendency for ${formatDomainName(a)} and ${formatDomainName(b)} to ${direction}${lagStr}, but the relationship is not reliable.`;
  } else {
    return `No significant correlation (r=${r.toFixed(2)}). ${formatDomainName(a)} and ${formatDomainName(b)} appear to be independent during this period.`;
  }
}

function computeConditionalProbability(x: number[], y: number[]): {
  highGivenHigh: number;
  highGivenLow: number;
  lowGivenHigh: number;
  lowGivenLow: number;
} | null {
  if (x.length < 4) return null;

  const medianX = median(x);
  const medianY = median(y);

  let highXHighY = 0, highXLowY = 0, lowXHighY = 0, lowXLowY = 0;
  let highXCount = 0, lowXCount = 0;

  for (let i = 0; i < x.length; i++) {
    const isHighX = x[i] >= medianX;
    const isHighY = y[i] >= medianY;

    if (isHighX) {
      highXCount++;
      if (isHighY) highXHighY++;
      else highXLowY++;
    } else {
      lowXCount++;
      if (isHighY) lowXHighY++;
      else lowXLowY++;
    }
  }

  return {
    highGivenHigh: highXCount > 0 ? highXHighY / highXCount : 0,
    highGivenLow: lowXCount > 0 ? lowXHighY / lowXCount : 0,
    lowGivenHigh: highXCount > 0 ? highXLowY / highXCount : 0,
    lowGivenLow: lowXCount > 0 ? lowXLowY / lowXCount : 0,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatDomainName(domain: string): string {
  return domain
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
