import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformActivity } from "../transformers/activity.js";
import { loadActivityTargets } from "../transformers/temporal.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";
import {
  computeWeekdayProfiles, detectAnomalies, suggestDayPlan,
  weekdayProfileToMarkdown, weekdayOverviewToMarkdown,
} from "../transformers/weekday-profiles.js";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function registerWeekdayPatternsTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_weekday_patterns",
    "What does your typical Monday/Tuesday/etc look like? Analyzes historical activity patterns per weekday. Returns per-category averages, consistency scores, anomaly detection for today, and suggested daily plans based on targets + historical patterns. Date range: past_month (31 calendar days) recommended for statistical significance. Use with: lifeos_daily_briefing (for today's actuals vs pattern), lifeos_create_entry (to log estimated activities for missing days — confirm with user before creating).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      reference_weeks: z.number().default(8).describe("How many weeks of history to analyze"),
      include_today: z.boolean().default(true).describe("Compare today's actuals against the typical pattern"),
    },
    async ({ period, date_from, date_to, reference_weeks, include_today }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const actDb = getDbConfig(config, "activity_log");

      // Fetch activities for the resolved range
      const result = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: `${resolved.date_from}T00:00:00Z` } },
            { property: "Date", date: { on_or_before: `${resolved.date_to}T23:59:59Z` } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });
      const activities = result.results.map(transformActivity);

      // Compute weekday profiles
      const profiles = computeWeekdayProfiles(activities, reference_weeks);

      // Build output
      const lines: string[] = [];
      lines.push("# Weekday Patterns");
      lines.push("");
      lines.push(`> Showing: ${resolved.rangeLabel}`);
      lines.push("");
      lines.push(`Based on ${activities.length} entries across ${reference_weeks}+ weeks of data.`);
      lines.push("");

      // Weekly grid
      const todayDow = new Date().getDay();
      lines.push(weekdayOverviewToMarkdown(profiles, todayDow));

      // Individual profiles
      lines.push("## Day-by-Day Profiles");
      lines.push("");

      for (let dow = 1; dow <= 7; dow++) {
        const idx = dow % 7;
        const p = profiles.get(idx);
        if (p) {
          lines.push(weekdayProfileToMarkdown(p));
        }
      }

      // Today comparison (if include_today)
      if (include_today) {
        const todayProfile = profiles.get(todayDow);
        if (todayProfile && todayProfile.instances >= 2) {
          // Fetch today's activities
          const today = new Date().toISOString().split("T")[0];
          const todayResult = await notion.queryDataSource(actDb.data_source_id, {
            page_size: 50,
            filter: {
              property: "Date",
              date: { after: `${today}T00:00:00Z` },
            },
          });
          const todayActivities = todayResult.results.map(transformActivity);

          const anomalies = detectAnomalies(todayActivities, todayProfile);

          if (anomalies.length > 0) {
            lines.push(`## Today vs Typical ${WEEKDAY_NAMES[todayDow]}`);
            lines.push("");
            lines.push(`> Today's tracked: ${todayActivities.reduce((s, a) => s + (a.durationHours ?? 0), 0).toFixed(1)}h across ${todayActivities.length} entries`);
            lines.push("");
            lines.push("| Activity | Expected | Actual | Deviation | Status |");
            lines.push("|----------|----------|--------|-----------|--------|");

            for (const a of anomalies) {
              const icon = a.severity === "significant" ? "⛔" : a.severity === "notable" ? "⚠️" : "✅";
              lines.push(
                `| ${a.category} | ${a.expectedMean.toFixed(1)}h ± ${a.expectedStdDev.toFixed(1)}h | ${a.actual.toFixed(1)}h | ${a.deviationSigma}σ | ${icon} ${a.severity} |`
              );
            }
            lines.push("");
          }

          // Day plan suggestion
          try {
            const atDb = getDbConfig(config, "activity_types");
            const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
            const targets = loadActivityTargets(atResult.results);

            const suggestions = suggestDayPlan(todayProfile, targets);
            if (suggestions.length > 0) {
              lines.push(`## Suggested Plan for Today (${WEEKDAY_NAMES[todayDow]})`);
              lines.push("");
              for (const s of suggestions) {
                const tag = s.fromTarget ? "🎯" : "📊";
                lines.push(`- ${tag} **${s.category}:** ${s.suggestedHours}h — ${s.reasoning}`);
              }
              lines.push("");
            }
          } catch {
            // Activity Types not available
          }
        }
      }

      lines.push("---");
      lines.push("");
      lines.push("> Next: Use `lifeos_daily_briefing` for today's actuals vs pattern, or `lifeos_create_entry` to log suggested activities (confirm with user).");

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
