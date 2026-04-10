import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractRelationCount, extractNumber } from "../transformers/shared.js";
import { transformActivity } from "../transformers/activity.js";
import { loadActivityTargets } from "../transformers/temporal.js";
import { resolveDates } from "../transformers/dates.js";
import {
  computeWeekdayProfiles, detectAnomalies, suggestDayPlan,
} from "../transformers/weekday-profiles.js";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function registerDailyBriefingTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_daily_briefing",
    "Daily snapshot for a specific date. Sections: active tasks, recent activities (last 3 days), weekday pattern comparison with anomaly detection, suggested daily plan, journal entries, financial activity, overdue alerts, today vs targets. Use with: lifeos_weekday_patterns (for deeper pattern analysis), lifeos_trajectory (for target gaps), lifeos_create_entry (to log suggested activities — confirm with user).",
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
        lines.push("No active tasks.");
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

      // Energy & Mood summary from recent activities
      const energyCounts: Record<string, number> = {};
      const moodCounts: Record<string, number> = {};
      for (const p of actResult.results) {
        const energy = extractString(p, "energy");
        const moodDelta = extractString(p, "mood_delta");
        if (energy) energyCounts[energy] = (energyCounts[energy] || 0) + 1;
        if (moodDelta) moodCounts[moodDelta] = (moodCounts[moodDelta] || 0) + 1;
      }
      if (Object.keys(energyCounts).length > 0 || Object.keys(moodCounts).length > 0) {
        lines.push("## ⚡ Energy & Mood");
        lines.push("");
        if (Object.keys(energyCounts).length > 0) {
          lines.push("**Energy Distribution:**");
          const energyOrder = ["High", "Medium", "Low"];
          for (const level of energyOrder) {
            if (energyCounts[level]) {
              lines.push(`- ${level}: ${energyCounts[level]}`);
            }
          }
          for (const [level, count] of Object.entries(energyCounts)) {
            if (!energyOrder.includes(level)) {
              lines.push(`- ${level}: ${count}`);
            }
          }
          lines.push("");
        }
        if (Object.keys(moodCounts).length > 0) {
          lines.push("**Mood Deltas:**");
          const moodOrder = ["↑", "→", "↓"];
          for (const delta of moodOrder) {
            if (moodCounts[delta]) {
              lines.push(`- ${delta}: ${moodCounts[delta]}`);
            }
          }
          for (const [delta, count] of Object.entries(moodCounts)) {
            if (!moodOrder.includes(delta)) {
              lines.push(`- ${delta}: ${count}`);
            }
          }
          lines.push("");
        }
      }

      // Compute today's hours per activity type (for use in pattern section)
      const todayActivities = actResult.results.filter(p => {
        const d = extractDate(p, "Date");
        return d && d.startsWith(targetDate);
      });
      const todayHours = new Map<string, number>();
      for (const p of todayActivities) {
        const actType = extractString(p, "Activity Type");
        const durProp = p.properties["Duration"];
        let dur = 0;
        if (durProp?.type === "formula" && (durProp as any).formula?.type === "number") {
          dur = (durProp as any).formula.number ?? 0;
        }
        todayHours.set(actType, (todayHours.get(actType) || 0) + dur);
      }

      // 3. Typical day pattern (weekday profile)
      try {
        const profileRange = resolveDates("past_month");
        const profileResult = await notion.queryDataSource(actDb.data_source_id, {
          page_size: 100,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: `${profileRange.date_from}T00:00:00Z` } },
              { property: "Date", date: { on_or_before: `${profileRange.date_to}T23:59:59Z` } },
            ],
          },
          sorts: [{ property: "Date", direction: "ascending" }],
        });
        const profileActivities = profileResult.results.map(transformActivity);
        const profiles = computeWeekdayProfiles(profileActivities, 8);

        const targetDow = new Date(targetDate + "T12:00:00Z").getDay();
        const todayProfile = profiles.get(targetDow);

        if (todayProfile && todayProfile.instances >= 2) {
          lines.push(`## 📐 Typical ${WEEKDAY_NAMES[targetDow]} Pattern (${todayProfile.instances} instances)`);
          lines.push("");
          lines.push(`> Based on last 30 days of data.`);
          lines.push("");

          // Show category table
          const sortedCats = [...todayProfile.categories.entries()]
            .filter(([, s]) => s.mean >= 0.1)
            .sort((a, b) => b[1].mean - a[1].mean);

          if (sortedCats.length > 0) {
            lines.push("| Activity | Typical | Today So Far | Status |");
            lines.push("|----------|---------|-------------|--------|");

            for (const [cat, stats] of sortedCats) {
              const todayActual = todayHours.get(cat) ?? 0;
              const sigma = stats.stdDev > 0 ? Math.abs(todayActual - stats.mean) / stats.stdDev : 0;
              let status: string;
              if (todayActual === 0 && stats.mean > 0.5) status = "⛔ Not Started";
              else if (sigma <= 1.5) status = "✅ On Track";
              else if (sigma <= 2.5) status = "⚠️ Notable";
              else status = "⛔ Anomaly";

              lines.push(`| ${cat} | ${stats.mean.toFixed(1)}h ± ${stats.stdDev.toFixed(1)}h | ${todayActual.toFixed(1)}h | ${status} |`);
            }
            lines.push("");
          }

          // Anomaly detection
          const todayActivitiesForAnomaly = actResult.results
            .filter(p => {
              const d = extractDate(p, "Date");
              return d && d.startsWith(targetDate);
            })
            .map(transformActivity);

          const anomalies = detectAnomalies(todayActivitiesForAnomaly, todayProfile);
          const notableAnomalies = anomalies.filter(a => a.severity !== "ok");

          if (notableAnomalies.length > 0) {
            lines.push("### Anomalies Detected");
            lines.push("");
            for (const a of notableAnomalies) {
              const icon = a.severity === "significant" ? "⛔" : "⚠️";
              lines.push(`- ${icon} ${a.insight}`);
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
              lines.push("### 💡 Suggested Plan for Today");
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
      } catch {
        // Insufficient data for weekday profile
      }

      // 4. Recent journal entries
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

      // Health score from today's days entry
      try {
        const daysDb = getDbConfig(config, "days");
        const daysResult = await notion.queryDataSource(daysDb.data_source_id, {
          page_size: 1,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: `${targetDate}T00:00:00Z` } },
              { property: "Date", date: { on_or_before: `${targetDate}T23:59:59Z` } },
            ],
          },
        });
        if (daysResult.results.length > 0) {
          const healthScore = extractNumber(daysResult.results[0], "health_score");
          if (healthScore !== null) {
            lines.push(`## 🏥 Health Score: ${healthScore}/100`);
            lines.push("");
          }
        }
      } catch {
        // Days DB not available or query failed
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

      // 6. Today vs Targets (from Activity Types)
      try {
        const atDb = getDbConfig(config, "activity_types");
        const atResult = await notion.queryDataSource(atDb.data_source_id, { page_size: 20 });
        const targets = loadActivityTargets(atResult.results);

        if (targets.size > 0) {
          const todayTracked = [...todayHours.values()].reduce((s, v) => s + v, 0);

          lines.push("## Today vs Targets");
          lines.push("");
          lines.push(`> Tracked today: ${todayTracked.toFixed(1)}h. Targets as defined in Activity Types.`);
          lines.push("");
          lines.push("| Activity | Target | Actual | Status |");
          lines.push("|----------|--------|--------|--------|");

          for (const [name, target] of targets) {
            const actual = todayHours.get(name) ?? 0;
            const pct = target.targetDuration > 0 ? (actual / target.targetDuration * 100) : 0;
            let status: string;
            if (actual === 0 && target.targetDuration > 0) status = "⛔ Not Started";
            else if (pct >= 80) status = "✅ On Track";
            else if (pct >= 50) status = "⚠️ Partial";
            else if (pct > 0) status = "⛔ Behind";
            else status = "⛔ Not Started";

            lines.push(`| ${name} | ${target.targetDuration}h | ${actual.toFixed(1)}h | ${status} |`);
          }
          lines.push("");
        }
      } catch {
        // Activity Types not available — skip
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
