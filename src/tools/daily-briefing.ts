import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractRelationCount } from "../transformers/shared.js";

export function registerDailyBriefingTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_daily_briefing",
    "Generate a comprehensive daily briefing combining today's tasks, recent activities, journal entries, and upcoming deadlines. Designed for morning planning sessions.",
    {
      date: z
        .string()
        .optional()
        .describe("Date for briefing (YYYY-MM-DD). Default: today"),
    },
    async ({ date }) => {
      const targetDate = date || new Date().toISOString().split("T")[0];
      const lines = [`# Daily Briefing — ${targetDate}`, ""];

      // 1. Today's active tasks
      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, {
        page_size: 50,
      });
      const activeTasks = taskResult.results.filter((p) => {
        const status = extractString(p, "Status");
        return ["Active", "Focus", "Up Next"].includes(status);
      });

      lines.push("## 📋 Today's Active Tasks");
      lines.push("");
      if (activeTasks.length === 0) {
        lines.push("No active tasks. Consider reviewing your project backlog.");
      } else {
        for (const p of activeTasks.slice(0, 10)) {
          const name = extractTitle(p);
          const id = extractString(p, "ID");
          const status = extractString(p, "Status");
          const priority = extractString(p, "Priority");
          const actionDate = extractDate(p, "Action Date");
          const monitor = extractString(p, "Monitor");
          const icon = status === "Focus" ? "🎯" : status === "Active" ? "▶️" : "⏸️";
          lines.push(
            `- ${icon} **${id}: ${name}** [${status}]`
          );
          if (priority) lines.push(`  - Priority: ${priority}`);
          if (actionDate) lines.push(`  - Action Date: ${actionDate.split("T")[0]}`);
          if (monitor) lines.push(`  - Monitor: ${monitor}`);
        }
      }
      lines.push("");

      // 2. Recent activities (last 3 days)
      const actDb = getDbConfig(config, "activity_log");
      const threeDaysAgo = new Date(
        new Date(targetDate).getTime() - 3 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];
      const actResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 50,
        filter: {
          property: "Date",
          date: { after: `${threeDaysAgo}T00:00:00Z` },
        },
        sorts: [{ property: "Date", direction: "descending" }],
      });

      lines.push("## 📊 Recent Activities (Last 3 Days)");
      lines.push("");
      if (actResult.results.length === 0) {
        lines.push("No recent activities logged.");
      } else {
        const totalHrs = actResult.results.reduce((s, p) => {
          const prop = p.properties["Duration"];
          if (prop?.type === "formula" && (prop as any).formula?.type === "number") {
            return s + ((prop as any).formula.number ?? 0);
          }
          return s;
        }, 0);
        lines.push(`**Total tracked:** ${totalHrs.toFixed(1)}h across ${actResult.results.length} entries`);
        lines.push("");

        for (const p of actResult.results.slice(0, 15)) {
          const name = extractTitle(p);
          const actType = extractString(p, "Activity Type");
          const date = extractDate(p, "Date");
          const dur = extractString(p, "Duration");
          lines.push(
            `- **[${date.split("T")[0]}]** ${name} — ${actType} (${dur}h)`
          );
        }
      }
      lines.push("");

      // 3. Recent journal entries
      const journals = [
        { key: "subjective_journal", label: "Subjective" },
        { key: "relational_journal", label: "Relational" },
        { key: "systemic_journal", label: "Systemic" },
      ];

      lines.push("## 📝 Recent Journal Entries");
      lines.push("");

      for (const j of journals) {
        const jDb = getDbConfig(config, j.key);
        const jResult = await notion.queryDataSource(jDb.data_source_id, {
          page_size: 5,
          sorts: [{ property: "Date", direction: "descending" }],
        });

        if (jResult.results.length > 0) {
          lines.push(`### ${j.label} Journal`);
          for (const p of jResult.results.slice(0, 3)) {
            const name = extractTitle(p);
            const date = extractDate(p, "Date");
            lines.push(
              `- **[${date.split("T")[0]}]** ${name.substring(0, 100)}${name.length > 100 ? "..." : ""}`
            );
          }
          lines.push("");
        }
      }

      // 4. Financial snapshot (recent)
      const finDb = getDbConfig(config, "financial_log");
      const finResult = await notion.queryDataSource(finDb.data_source_id, {
        page_size: 10,
        sorts: [{ property: "Date", direction: "descending" }],
      });

      if (finResult.results.length > 0) {
        lines.push("## 💰 Recent Financial Activity");
        lines.push("");
        for (const p of finResult.results.slice(0, 5)) {
          const name = extractTitle(p);
          const amount = extractString(p, "Amount");
          const category = extractString(p, "Category");
          const date = extractDate(p, "Date");
          lines.push(
            `- **[${date.split("T")[0]}]** ${name} — ₹${amount} (${category})`
          );
        }
        lines.push("");
      }

      // 5. Overdue tasks alert
      const overdueTasks = taskResult.results.filter((p) => {
        const status = extractString(p, "Status");
        if (!["Active", "Focus", "Up Next", "Waiting", "Paused"].includes(status)) return false;
        const actionDate = extractDate(p, "Action Date");
        if (!actionDate) return false;
        return new Date(actionDate) < new Date(targetDate);
      });

      if (overdueTasks.length > 0) {
        lines.push(`## ⚠️ Overdue Tasks (${overdueTasks.length})`);
        lines.push("");
        for (const p of overdueTasks.slice(0, 5)) {
          const name = extractTitle(p);
          const id = extractString(p, "ID");
          const actionDate = extractDate(p, "Action Date");
          const daysOverdue = Math.floor(
            (new Date(targetDate).getTime() - new Date(actionDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          lines.push(
            `- **${id}: ${name}** — ${daysOverdue} day(s) overdue`
          );
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
