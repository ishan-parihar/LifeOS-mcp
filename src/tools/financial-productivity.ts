import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractNumber } from "../transformers/shared.js";
import { transformActivity } from "../transformers/activity.js";
import { resolveDates, PERIOD_PARAM, DATE_FROM_PARAM, DATE_TO_PARAM } from "../transformers/dates.js";
import {
  computeFinancialProductivity,
  financialProductivityToMarkdown,
  type FinancialEntry,
} from "../transformers/financial-productivity.js";

function transformFinancialEntry(page: any): FinancialEntry {
  return {
    id: page.id,
    name: extractTitle(page),
    date: extractDate(page, "Date"),
    amount: extractNumber(page, "Amount"),
    category: extractString(page, "Category"),
    capitalEngine: extractString(page, "Capital Engine"),
    notes: extractString(page, "Notes"),
  };
}

export function registerFinancialProductivityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_financial_productivity",
    "Financial productivity analysis: revenue/hour, expense patterns, capital engine breakdown, and top transactions. Use with: lifeos_productivity_report (activity context), lifeos_temporal_analysis (trends), lifeos_create_report (save insights).",
    {
      period: PERIOD_PARAM,
      date_from: DATE_FROM_PARAM,
      date_to: DATE_TO_PARAM,
      by_project: z.boolean().default(false).describe("Break down financials by project"),
      include_expenses: z.boolean().default(true).describe("Include expense analysis"),
    },
    async ({ period, date_from, date_to, by_project, include_expenses }) => {
      const resolved = resolveDates(period, date_from, date_to);
      const dateFrom = resolved.date_from;
      const dateTo = resolved.date_to;

      // Fetch financial log
      const finDb = getDbConfig(config, "financial_log");
      const finResult = await notion.queryDataSource(finDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: dateFrom } },
            { property: "Date", date: { on_or_before: `${dateTo}T23:59:59Z` } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      });
      const financialEntries = finResult.results.map(transformFinancialEntry);

      // Fetch activity log for work hours
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

      const report = computeFinancialProductivity(
        financialEntries,
        activities,
        dateFrom,
        dateTo,
        by_project,
        include_expenses
      );

      let markdown = `> Showing: ${resolved.rangeLabel}\n\n`;
      markdown += financialProductivityToMarkdown(report);

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );
}
