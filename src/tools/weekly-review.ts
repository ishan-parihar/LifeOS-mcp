import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractNumber, extractRelationCount } from "../transformers/shared.js";
import { transformActivity } from "../transformers/activity.js";
import { transformTask } from "../transformers/tasks.js";
import { resolveDates } from "../transformers/dates.js";
import { loadActivityTargets, computePeriodMetrics } from "../transformers/temporal.js";

export function registerWeeklyReviewTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_weekly_review",
    "Holistic weekly review across all domains: time allocation, task completion, financial summary, project progress, health metrics, and mood trends. Includes week-over-week changes when prior week data is available. Use with: lifeos_productivity_report (detailed time analysis), lifeos_trajectory (target gaps), lifeos_create_report (save review).",
    {
      week_number: z.number().optional().describe("Specific week number to review (ISO week). Defaults to current week."),
      date: z.string().optional().describe("Date within the week to review (YYYY-MM-DD). Defaults to today."),
      include_health: z.boolean().default(true).describe("Include health metrics (diet, exercise, sleep)"),
    },
    async ({ week_number, date, include_health }) => {
      const targetDate = date || new Date().toISOString().split("T")[0];
      const target = new Date(targetDate);

      // Calculate week boundaries (Monday to Sunday)
      const dayOfWeek = target.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(target);
      monday.setDate(target.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const weekStart = monday.toISOString().split("T")[0];
      const weekEnd = sunday.toISOString().split("T")[0];

      // Calculate prior week boundaries
      const priorMonday = new Date(monday);
      priorMonday.setDate(monday.getDate() - 7);
      const priorSunday = new Date(sunday);
      priorSunday.setDate(sunday.getDate() - 7);
      const priorWeekStart = priorMonday.toISOString().split("T")[0];
      const priorWeekEnd = priorSunday.toISOString().split("T")[0];

      const lines: string[] = [];
      const isoWeek = getISOWeekNumber(target);
      lines.push(`# Weekly Review — Week ${isoWeek} (${weekStart} → ${weekEnd})`);
      lines.push("");

      // 1. Time Allocation
      const actDb = getDbConfig(config, "activity_log");
      const actResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: weekStart } },
            { property: "Date", date: { on_or_before: `${weekEnd}T23:59:59Z` } },
          ],
        },
      });
      const activities = actResult.results.map(transformActivity);

      // Prior week activities
      const priorActResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 100,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: priorWeekStart } },
            { property: "Date", date: { on_or_before: `${priorWeekEnd}T23:59:59Z` } },
          ],
        },
      });
      const priorActivities = priorActResult.results.map(transformActivity);

      const totalHours = activities.reduce((s, a) => s + (a.durationHours ?? 0), 0);
      const priorTotalHours = priorActivities.reduce((s, a) => s + (a.durationHours ?? 0), 0);
      const hoursDelta = totalHours - priorTotalHours;

      lines.push("## Time Allocation");
      lines.push("");
      lines.push(`- **Total tracked:** ${totalHours.toFixed(1)}h (${activities.length} entries)`);
      lines.push(`- **Prior week:** ${priorTotalHours.toFixed(1)}h (${priorActivities.length} entries)`);
      lines.push(`- **Change:** ${hoursDelta >= 0 ? "+" : ""}${hoursDelta.toFixed(1)}h`);
      lines.push("");

      // Category breakdown
      const categoryHours = new Map<string, number>();
      for (const a of activities) {
        const cat = a.activityType || "Uncategorized";
        categoryHours.set(cat, (categoryHours.get(cat) || 0) + (a.durationHours ?? 0));
      }

      if (categoryHours.size > 0) {
        lines.push("| Category | Hours | % | Prior Week | Δ |");
        lines.push("|----------|-------|---|-----------|---|");

        const sorted = [...categoryHours.entries()].sort((a, b) => b[1] - a[1]);
        for (const [cat, hours] of sorted) {
          const pct = totalHours > 0 ? ((hours / totalHours) * 100).toFixed(0) : "0";
          const priorCatHours = priorActivities
            .filter(a => a.activityType === cat)
            .reduce((s, a) => s + (a.durationHours ?? 0), 0);
          const delta = hours - priorCatHours;
          const deltaStr = delta !== 0 ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}h` : "—";
          lines.push(`| ${cat} | ${hours.toFixed(1)}h | ${pct}% | ${priorCatHours.toFixed(1)}h | ${deltaStr} |`);
        }
        lines.push("");
      }

      // 2. Task Completion
      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, {
        page_size: 100,
      });
      const tasks = taskResult.results.map(transformTask);

      // Use last_edited_time from raw pages to determine when tasks were completed
      const completedThisWeek = taskResult.results.filter(p => {
        const status = extractString(p, "Status");
        if (status !== "Done") return false;
        const lastEdited = p.last_edited_time || "";
        if (!lastEdited) return false;
        const completed = new Date(lastEdited);
        return completed >= new Date(weekStart) && completed <= new Date(`${weekEnd}T23:59:59Z`);
      }).map(transformTask);

      const activeTasks = tasks.filter(t => ["Active", "Focus", "Up Next"].includes(t.status));
      const overdueTasks = activeTasks.filter(t => {
        if (!t.actionDate) return false;
        return new Date(t.actionDate) < new Date(targetDate);
      });

      lines.push("## Task Completion");
      lines.push("");
      lines.push(`- **Completed this week:** ${completedThisWeek.length}`);
      lines.push(`- **Active tasks:** ${activeTasks.length}`);
      lines.push(`- **Overdue:** ${overdueTasks.length}`);
      lines.push("");

      if (completedThisWeek.length > 0) {
        lines.push("### Completed Tasks");
        lines.push("");
        for (const t of completedThisWeek.slice(0, 10)) {
          lines.push(`- ✅ ${t.name}`);
        }
        lines.push("");
      }

      if (overdueTasks.length > 0) {
        lines.push("### Overdue Tasks");
        lines.push("");
        for (const t of overdueTasks.slice(0, 5)) {
          const daysOverdue = Math.floor(
            (new Date(targetDate).getTime() - new Date(t.actionDate!).getTime()) / (1000 * 60 * 60 * 24)
          );
          lines.push(`- ⚠️ ${t.name} (${daysOverdue}d overdue)`);
        }
        lines.push("");
      }

      // 3. Financial Summary
      const finDb = getDbConfig(config, "financial_log");
      const finResult = await notion.queryDataSource(finDb.data_source_id, {
        page_size: 50,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: weekStart } },
            { property: "Date", date: { on_or_before: `${weekEnd}T23:59:59Z` } },
          ],
        },
      });

      let weekRevenue = 0;
      let weekExpenses = 0;
      const revenueCategories = ["Business Revenue", "Client Payment", "Investment Income", "Income"];

      for (const p of finResult.results) {
        const amount = extractNumber(p, "Amount") ?? 0;
        const category = extractString(p, "Category");
        if (revenueCategories.includes(category)) {
          weekRevenue += amount;
        } else {
          weekExpenses += amount;
        }
      }

      lines.push("## Financial Summary");
      lines.push("");
      lines.push(`- **Revenue:** ₹${weekRevenue.toLocaleString()}`);
      lines.push(`- **Expenses:** ₹${weekExpenses.toLocaleString()}`);
      lines.push(`- **Net:** ₹${(weekRevenue - weekExpenses).toLocaleString()}`);
      lines.push(`- **Transactions:** ${finResult.results.length}`);
      lines.push("");

      // 4. Project Progress
      const projDb = getDbConfig(config, "projects");
      const projResult = await notion.queryDataSource(projDb.data_source_id, {
        page_size: 30,
        filter: { property: "Status", status: { equals: "Active" } },
      });

      if (projResult.results.length > 0) {
        lines.push("## Active Projects");
        lines.push("");
        lines.push("| Project | Progress | Deadline |");
        lines.push("|---------|----------|----------|");

        for (const p of projResult.results.slice(0, 10)) {
          const name = extractTitle(p);
          const progress = extractString(p, "Progress");
          const deadline = extractDate(p, "Deadline");
          const deadlineStr = deadline ? deadline.split("T")[0] : "—";
          lines.push(`| ${name} | ${progress || "—"}% | ${deadlineStr} |`);
        }
        lines.push("");
      }

      // 5. Health Metrics (if requested)
      if (include_health) {
        const dietDb = getDbConfig(config, "diet_log");
        const dietResult = await notion.queryDataSource(dietDb.data_source_id, {
          page_size: 20,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: weekStart } },
              { property: "Date", date: { on_or_before: `${weekEnd}T23:59:59Z` } },
            ],
          },
        });

        // Extract workout and sleep hours
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

        const moodDb = getDbConfig(config, "subjective_journal");
        const moodResult = await notion.queryDataSource(moodDb.data_source_id, {
          page_size: 20,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: weekStart } },
              { property: "Date", date: { on_or_before: `${weekEnd}T23:59:59Z` } },
            ],
          },
        });

        lines.push("## Health & Wellness");
        lines.push("");
        lines.push(`- **Meals logged:** ${dietResult.results.length}`);
        lines.push(`- **Exercise:** ${workoutHours.toFixed(1)}h`);
        lines.push(`- **Sleep:** ${sleepHours.toFixed(1)}h (${(sleepHours / 7).toFixed(1)}h/night avg)`);
        lines.push(`- **Mood entries:** ${moodResult.results.length}`);
        lines.push("");
      }

      // 6. Key Learnings & Notes
      const weeksDb = getDbConfig(config, "weeks");
      const weekResult = await notion.queryDataSource(weeksDb.data_source_id, {
        page_size: 1,
        filter: {
          and: [
            { property: "Week Start", date: { on_or_after: weekStart } },
            { property: "Week Start", date: { on_or_before: weekEnd } },
          ],
        },
      });

      if (weekResult.results.length > 0) {
        const weekEntry = weekResult.results[0];
        const learnings = extractString(weekEntry, "Key Learnings");
        if (learnings) {
          lines.push("## Key Learnings");
          lines.push("");
          lines.push(learnings);
          lines.push("");
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
