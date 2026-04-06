import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractNumber } from "../transformers/shared.js";
import { transformActivity } from "../transformers/activity.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";
import {
  computeHealthVitality,
  healthVitalityToMarkdown,
  transformDietEntry,
} from "../transformers/health-vitality.js";

export function registerHealthVitalityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_health_vitality",
    "Health & vitality score computation from nutrition, exercise, sleep, and mood data. Returns component scores (0-100), trends, and recent meal details. Use with: lifeos_diet_log (raw nutrition data), lifeos_productivity_report (activity context), lifeos_subjective_journal (mood correlation).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      include_trends: z.boolean().default(true).describe("Include 7-day trend analysis (always included in current version)"),
    },
    async ({ period, date_from, date_to }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const dateFrom = resolved.date_from;
      const dateTo = resolved.date_to;

      // Fetch diet log
      const dietDb = getDbConfig(config, "diet_log");
      const dietResult = await notion.queryDataSource(dietDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
      });
      const dietEntries = dietResult.results.map(transformDietEntry);

      // Fetch activity log for workout and sleep
      const actDb = getDbConfig(config, "activity_log");
      const actResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
      });
      const activities = actResult.results.map(transformActivity);

      let workoutHours = 0;
      let sleepHours = 0;
      for (const a of activities) {
        const type = a.activityType.toLowerCase();
        const dur = a.durationHours ?? 0;
        if (type.includes("workout") || type.includes("exercise") || type.includes("gym") || type.includes("sport")) {
          workoutHours += dur;
        }
        if (type.includes("sleep")) {
          sleepHours += dur;
        }
      }

      // Fetch subjective journal for mood entries
      const moodDb = getDbConfig(config, "subjective_journal");
      const moodResult = await notion.queryDataSource(moodDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
      });
      const moodEntries = moodResult.results.length;

      const report = computeHealthVitality(
        dietEntries,
        workoutHours,
        sleepHours,
        moodEntries,
        dateFrom,
        dateTo
      );

      let markdown = `> Showing: ${resolved.rangeLabel}\n\n`;
      markdown += healthVitalityToMarkdown(report);

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
