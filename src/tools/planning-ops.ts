import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractDate, extractString, extractTitle } from "../transformers/shared.js";
import { resolveDates, PERIOD_PARAM } from "../transformers/dates.js";
import { loadActivityTargets } from "../transformers/temporal.js";

const ACTION = z.enum(["morning_planner", "weekly_review", "habit_compliance"]);

export function registerPlanningOpsTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_planning_ops",
    "Planning operations for COO Productivity. Morning planner, weekly review, and habit compliance summaries with suggested actions (dry-run by default).",
    {
      action: ACTION.describe("Action to perform"),
      date: z.string().optional().describe("Date for morning planner (YYYY-MM-DD)"),
      period: PERIOD_PARAM,
      dry_run: z.boolean().optional().describe("If false, will create suggested tasks in future versions. Default true"),
      focus_count: z.number().optional().describe("Max tasks to mark Focus when dry_run=false (default 3)"),
    },
    async ({ action, date, period = "past_week", dry_run = true, focus_count = 3 }) => {
      if (action === "morning_planner") {
        const target = date || new Date().toISOString().split("T")[0];
        const tasksDb = getDbConfig(config, "tasks");
        const result = await notion.queryDataSource(tasksDb.data_source_id, {
          page_size: 100,
          sorts: [{ property: "Action Date", direction: "ascending" }],
        });
        // Score tasks: overdue first, then priority stars, then action date
        const scored = result.results
          .map((p) => {
            const name = extractTitle(p);
            const id = extractString(p, "ID");
            const status = extractString(p, "Status");
            const priority = extractString(p, "Priority");
            const ad = extractDate(p, "Action Date");
            const overdue = ad ? new Date(ad) < new Date(target) : false;
            const stars = (priority.match(/⭐/g) || []).length;
            const score = (overdue ? 1000 : 0) + stars * 10 - (ad ? new Date(ad).getTime() / 86400000 : 0);
            return { page: p, id, name, status, priority, ad, overdue, score };
          })
          .filter((t) => ["Active", "Focus", "Up Next"].includes(t.status))
          .sort((a, b) => b.score - a.score);

        const top = scored.slice(0, Math.max(1, focus_count));
        const lines: string[] = [];
        lines.push(`# Morning Planner — ${target}`);
        lines.push("");
        lines.push(`## Suggested Focus (top ${top.length})`);
        lines.push("");
        if (top.length === 0) {
          lines.push("No candidates. Consider reviewing your backlog.");
        } else {
          for (const t of top) {
            const badge = t.overdue ? "🚨 Overdue" : t.priority || "";
            lines.push(`- ${t.id ? t.id + ": " : ""}${t.name} — ${badge}`);
          }
        }
        lines.push("");
        if (!dry_run) {
          // Apply Focus status to top N
          for (const t of top) {
            await notion.updatePage(t.page.id, { Status: { status: { name: "Focus" } } as any });
          }
          lines.push(`Applied Focus status to ${top.length} task(s).`);
        } else {
          lines.push("> dry_run=true — suggestions only. Set dry_run=false to apply Focus to the tasks above.");
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "weekly_review" || action === "habit_compliance") {
        const { date_from, date_to, rangeLabel } = resolveDates(period);
        const actDb = getDbConfig(config, "activity_log");
        const actResult = await notion.queryDataSource(actDb.data_source_id, {
          page_size: 100,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: `${date_from}T00:00:00Z` } },
              { property: "Date", date: { on_or_before: `${date_to}T23:59:59Z` } },
            ],
          },
          sorts: [{ property: "Date", direction: "ascending" }],
        });

        // Aggregate hours by Activity Type using formula Duration
        const totals = new Map<string, number>();
        for (const p of actResult.results) {
          const type = extractString(p, "Activity Type") || "Uncategorized";
          const prop = p.properties["Duration"] as any;
          const dur = prop?.type === "formula" && prop.formula?.type === "number" ? prop.formula.number || 0 : 0;
          totals.set(type, (totals.get(type) || 0) + dur);
        }

        const lines: string[] = [];
        lines.push(`# ${action === "weekly_review" ? "Weekly Review" : "Habit Compliance"} — ${rangeLabel}`);
        lines.push("");
        lines.push("## Time Allocation");
        lines.push("");
        const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
        for (const [k, v] of sorted) lines.push(`- ${k}: ${v.toFixed(1)}h`);
        lines.push("");
        if (action === "habit_compliance") {
          try {
            const atDb = getDbConfig(config, "activity_types");
            const atRes = await notion.queryDataSource(atDb.data_source_id, { page_size: 100 });
            const targets = loadActivityTargets(atRes.results as any);
            if (targets.size > 0) {
              lines.push("## Targets vs Actual (tracked-days average)");
              lines.push("");
              for (const [name, t] of targets) {
                const actual = (totals.get(name) || 0) / Math.max(1, (Object.values(Object.fromEntries(totals)).reduce((s: number, v: number) => s + v, 0) / 24));
                lines.push(`- ${name}: target ${t.targetDuration}h/day • actual ~${actual.toFixed(1)}h/day`);
              }
              lines.push("");
            }
          } catch {}
        }
        if (action === "weekly_review") {
          // Overdue tasks snapshot
          const tasksDb = getDbConfig(config, "tasks");
          const tasks = await notion.queryDataSource(tasksDb.data_source_id, { page_size: 100 });
          const overdue = tasks.results.filter((p) => {
            const status = extractString(p, "Status");
            if (!["Active", "Focus", "Up Next", "Waiting", "Paused"].includes(status)) return false;
            const ad = extractDate(p, "Action Date");
            return ad && new Date(ad) < new Date(date_to);
          });
          lines.push(`## Overdue Tasks (${overdue.length})`);
          lines.push("");
          for (const t of overdue.slice(0, 10)) {
            lines.push(`- ${extractString(t, "ID")}: ${extractTitle(t)}`);
          }
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      return { content: [{ type: "text" as const, text: `Unknown action: ${action}` }] };
    }
  );
}
