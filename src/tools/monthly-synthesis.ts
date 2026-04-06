import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractNumber, extractRelationCount } from "../transformers/shared.js";
import { transformActivity } from "../transformers/activity.js";
import { transformTask } from "../transformers/tasks.js";
import { resolveDates } from "../transformers/dates.js";

export function registerMonthlySynthesisTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_monthly_synthesis",
    "Month-level performance review across all domains: time allocation, task completion, financial summary, project progress, health metrics, relationship activity, and content output. Includes month-over-month trends. Use with: lifeos_productivity_report (detailed time analysis), lifeos_okrs_progress (OKR alignment), lifeos_create_report (save synthesis).",
    {
      month: z.string().optional().describe("Month to review (YYYY-MM). Defaults to current month."),
      include_relationships: z.boolean().default(false).describe("Include relationship interaction summary"),
      include_content: z.boolean().default(false).describe("Include content pipeline summary"),
    },
    async ({ month, include_relationships, include_content }) => {
      const now = new Date();
      const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [year, monthNum] = targetMonth.split("-").map(Number);
      const monthStart = `${year}-${String(monthNum).padStart(2, "0")}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const monthEnd = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // Prior month
      const priorMonthDate = new Date(year, monthNum - 2, 1);
      const priorMonthStart = priorMonthDate.toISOString().split("T")[0];
      const priorLastDay = new Date(year, monthNum - 1, 0).getDate();
      const priorMonthEnd = `${year}-${String(monthNum - 1).padStart(2, "0")}-${String(priorLastDay).padStart(2, "0")}`;

      const lines: string[] = [];
      const monthName = new Date(year, monthNum - 1).toLocaleString("default", { month: "long" });
      lines.push(`# Monthly Synthesis — ${monthName} ${year}`);
      lines.push("");

      // Fetch all data for current and prior month
      const actDb = getDbConfig(config, "activity_log");
      const [currentActivities, priorActivities] = await Promise.all([
        fetchActivities(notion, actDb.data_source_id, monthStart, monthEnd),
        fetchActivities(notion, actDb.data_source_id, priorMonthStart, priorMonthEnd),
      ]);

      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, { page_size: 200 });
      const tasks = taskResult.results.map(transformTask);

      const finDb = getDbConfig(config, "financial_log");
      const [currentFin, priorFin] = await Promise.all([
        fetchFinancial(notion, finDb.data_source_id, monthStart, monthEnd),
        fetchFinancial(notion, finDb.data_source_id, priorMonthStart, priorMonthEnd),
      ]);

      const projDb = getDbConfig(config, "projects");
      const projResult = await notion.queryDataSource(projDb.data_source_id, {
        page_size: 30,
        filter: { property: "Status", status: { equals: "Active" } },
      });

      const qDb = getDbConfig(config, "quarterly_goals");
      const qResult = await notion.queryDataSource(qDb.data_source_id, { page_size: 20 });

      const dietDb = getDbConfig(config, "diet_log");
      const dietResult = await notion.queryDataSource(dietDb.data_source_id, {
        page_size: 50,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: monthStart } },
            { property: "Date", date: { on_or_before: `${monthEnd}T23:59:59Z` } },
          ],
        },
      });

      const moodDb = getDbConfig(config, "subjective_journal");
      const moodResult = await notion.queryDataSource(moodDb.data_source_id, {
        page_size: 50,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: monthStart } },
            { property: "Date", date: { on_or_before: `${monthEnd}T23:59:59Z` } },
          ],
        },
      });

      // 1. Overall Score
      const currentHours = currentActivities.reduce((s, a) => s + (a.durationHours ?? 0), 0);
      const priorHours = priorActivities.reduce((s, a) => s + (a.durationHours ?? 0), 0);
      const completedTasks = tasks.filter(t => t.status === "Done").length;
      const activeTasks = tasks.filter(t => ["Active", "Focus", "Up Next"].includes(t.status)).length;
      const netIncome = currentFin.revenue - currentFin.expenses;

      lines.push("## Month at a Glance");
      lines.push("");
      lines.push(`| Metric | This Month | Prior Month | Δ |`);
      lines.push("|--------|-----------|-------------|---|");
      lines.push(`| Tracked Hours | ${currentHours.toFixed(1)}h | ${priorHours.toFixed(1)}h | ${formatDelta(currentHours - priorHours, "h")} |`);
      lines.push(`| Active Tasks | ${activeTasks} | — | — |`);
      lines.push(`| Completed Tasks | ${completedTasks} | — | — |`);
      lines.push(`| Net Income | ₹${netIncome.toLocaleString()} | ₹${(priorFin.revenue - priorFin.expenses).toLocaleString()} | ${formatDeltaCurrency(netIncome - (priorFin.revenue - priorFin.expenses))} |`);
      lines.push(`| Active Projects | ${projResult.results.length} | — | — |`);
      lines.push(`| Meals Logged | ${dietResult.results.length} | — | — |`);
      lines.push(`| Mood Entries | ${moodResult.results.length} | — | — |`);
      lines.push("");

      // 2. Time Allocation
      lines.push("## Time Allocation");
      lines.push("");
      const categoryHours = new Map<string, number>();
      for (const a of currentActivities) {
        const cat = a.activityType || "Uncategorized";
        categoryHours.set(cat, (categoryHours.get(cat) || 0) + (a.durationHours ?? 0));
      }

      const priorCategoryHours = new Map<string, number>();
      for (const a of priorActivities) {
        const cat = a.activityType || "Uncategorized";
        priorCategoryHours.set(cat, (priorCategoryHours.get(cat) || 0) + (a.durationHours ?? 0));
      }

      if (categoryHours.size > 0) {
        lines.push("| Category | Hours | % | Prior | Δ |");
        lines.push("|----------|-------|---|-------|---|");
        const sorted = [...categoryHours.entries()].sort((a, b) => b[1] - a[1]);
        for (const [cat, hours] of sorted) {
          const pct = currentHours > 0 ? ((hours / currentHours) * 100).toFixed(0) : "0";
          const priorHrs = priorCategoryHours.get(cat) ?? 0;
          lines.push(`| ${cat} | ${hours.toFixed(1)}h | ${pct}% | ${priorHrs.toFixed(1)}h | ${formatDelta(hours - priorHrs, "h")} |`);
        }
        lines.push("");
      }

      // 3. Financial Summary
      lines.push("## Financial Summary");
      lines.push("");
      lines.push(`| Category | This Month | Prior Month | Δ |`);
      lines.push("|----------|-----------|-------------|---|");
      lines.push(`| Revenue | ₹${currentFin.revenue.toLocaleString()} | ₹${priorFin.revenue.toLocaleString()} | ${formatDeltaCurrency(currentFin.revenue - priorFin.revenue)} |`);
      lines.push(`| Expenses | ₹${currentFin.expenses.toLocaleString()} | ₹${priorFin.expenses.toLocaleString()} | ${formatDeltaCurrency(currentFin.expenses - priorFin.expenses)} |`);
      lines.push(`| Net | ₹${netIncome.toLocaleString()} | ₹${(priorFin.revenue - priorFin.expenses).toLocaleString()} | ${formatDeltaCurrency(netIncome - (priorFin.revenue - priorFin.expenses))} |`);
      lines.push(`| Transactions | ${currentFin.count} | ${priorFin.count} | ${formatDelta(currentFin.count - priorFin.count, "")} |`);
      lines.push("");

      if (currentFin.byCategory.size > 0) {
        lines.push("### Revenue by Category");
        lines.push("");
        lines.push("| Category | Amount | % |");
        lines.push("|----------|--------|---|");
        const sorted = [...currentFin.byCategory.entries()].sort((a, b) => b[1] - a[1]);
        for (const [cat, amount] of sorted) {
          const pct = currentFin.revenue > 0 ? ((amount / currentFin.revenue) * 100).toFixed(0) : "0";
          lines.push(`| ${cat} | ₹${amount.toLocaleString()} | ${pct}% |`);
        }
        lines.push("");
      }

      // 4. Project Progress
      if (projResult.results.length > 0) {
        lines.push("## Project Status");
        lines.push("");
        lines.push("| Project | Progress | Deadline | Status |");
        lines.push("|---------|----------|----------|--------|");
        for (const p of projResult.results.slice(0, 10)) {
          const name = extractTitle(p);
          const progress = extractString(p, "Progress");
          const deadline = extractDate(p, "Deadline");
          const status = extractString(p, "Status");
          const deadlineStr = deadline ? deadline.split("T")[0] : "—";
          lines.push(`| ${name} | ${progress || "—"}% | ${deadlineStr} | ${status} |`);
        }
        lines.push("");
      }

      // 5. OKR Progress
      if (qResult.results.length > 0) {
        lines.push("## Quarterly Goals Progress");
        lines.push("");
        lines.push("| Goal | Status | Key Results |");
        lines.push("|------|--------|-------------|");
        for (const q of qResult.results.slice(0, 5)) {
          const name = extractTitle(q);
          const status = extractString(q, "Status");
          const kr1 = extractString(q, "Key Result 1");
          lines.push(`| ${name} | ${status} | ${kr1 ? "✅" : "—"} |`);
        }
        lines.push("");
      }

      // 6. Health Summary
      lines.push("## Health & Wellness");
      lines.push("");
      let workoutHours = 0;
      let sleepHours = 0;
      for (const a of currentActivities) {
        const type = a.activityType.toLowerCase();
        const dur = a.durationHours ?? 0;
        if (type.includes("workout") || type.includes("exercise") || type.includes("gym") || type.includes("sport")) {
          workoutHours += dur;
        }
        if (type.includes("sleep")) {
          sleepHours += dur;
        }
      }
      lines.push(`- **Meals logged:** ${dietResult.results.length}`);
      lines.push(`- **Exercise:** ${workoutHours.toFixed(1)}h (${(workoutHours / lastDay).toFixed(1)}h/day avg)`);
      lines.push(`- **Sleep:** ${sleepHours.toFixed(1)}h (${(sleepHours / lastDay).toFixed(1)}h/night avg)`);
      lines.push(`- **Mood entries:** ${moodResult.results.length}`);
      lines.push("");

      // 7. Relationships (optional)
      if (include_relationships) {
        const relDb = getDbConfig(config, "relational_journal");
        const relResult = await notion.queryDataSource(relDb.data_source_id, {
          page_size: 50,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: monthStart } },
              { property: "Date", date: { on_or_before: `${monthEnd}T23:59:59Z` } },
            ],
          },
        });

        lines.push("## Relationship Activity");
        lines.push("");
        lines.push(`- **Interactions logged:** ${relResult.results.length}`);
        if (relResult.results.length > 0) {
          lines.push("");
          lines.push("### Recent Interactions");
          lines.push("");
          for (const p of relResult.results.slice(0, 5)) {
            const name = extractTitle(p);
            const date = extractDate(p, "Date");
            const dateStr = date ? date.split("T")[0] : "No date";
            lines.push(`- **[${dateStr}]** ${name.substring(0, 100)}`);
          }
        }
        lines.push("");
      }

      // 8. Content Pipeline (optional)
      if (include_content) {
        const contentDb = getDbConfig(config, "content_pipeline");
        const contentResult = await notion.queryDataSource(contentDb.data_source_id, {
          page_size: 50,
          filter: {
            and: [
              { property: "Publish Date", date: { on_or_after: monthStart } },
              { property: "Publish Date", date: { on_or_before: `${monthEnd}T23:59:59Z` } },
            ],
          },
        });

        lines.push("## Content Output");
        lines.push("");
        lines.push(`- **Published:** ${contentResult.results.length}`);
        if (contentResult.results.length > 0) {
          lines.push("");
          lines.push("### Published Content");
          lines.push("");
          for (const p of contentResult.results.slice(0, 5)) {
            const name = extractTitle(p);
            const platform = extractString(p, "Platforms");
            const format = extractString(p, "Format");
            lines.push(`- **${name}** — ${platform} (${format})`);
          }
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

async function fetchActivities(notion: NotionClient, dataSourceId: string, from: string, to: string) {
  const result = await notion.queryDataSource(dataSourceId, {
    page_size: 200,
    filter: {
      and: [
        { property: "Date", date: { on_or_after: from } },
        { property: "Date", date: { on_or_before: `${to}T23:59:59Z` } },
      ],
    },
  });
  return result.results.map(transformActivity);
}

interface FinancialSummary {
  revenue: number;
  expenses: number;
  count: number;
  byCategory: Map<string, number>;
}

async function fetchFinancial(notion: NotionClient, dataSourceId: string, from: string, to: string): Promise<FinancialSummary> {
  const result = await notion.queryDataSource(dataSourceId, {
    page_size: 200,
    filter: {
      and: [
        { property: "Date", date: { on_or_after: from } },
        { property: "Date", date: { on_or_before: `${to}T23:59:59Z` } },
      ],
    },
  });

  const revenueCategories = ["Business Revenue", "Client Payment", "Investment Income", "Income"];
  let revenue = 0;
  let expenses = 0;
  const byCategory = new Map<string, number>();

  for (const p of result.results) {
    const amount = extractNumber(p, "Amount") ?? 0;
    const category = extractString(p, "Category");
    if (revenueCategories.includes(category)) {
      revenue += amount;
      byCategory.set(category, (byCategory.get(category) || 0) + amount);
    } else {
      expenses += amount;
    }
  }

  return { revenue, expenses, count: result.results.length, byCategory };
}

function formatDelta(value: number, unit: string): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}

function formatDeltaCurrency(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `₹${sign}${value.toLocaleString()}`;
}
