import { NotionPage } from "../notion/types.js";
import {
  extractTitle,
  extractString,
  extractNumber,
  extractDate,
  extractBoolean,
  extractRelationCount,
  formatDateTime,
  daysAgo,
} from "./shared.js";

export interface ActivityEntry {
  id: string;
  name: string;
  date: string;
  activityType: string;
  durationHours: number | null;
  activityNotes: string;
  isHabit: boolean;
  isLogged: boolean;
  projectCount: number;
  daysAgo: number;
  energy: string;
  moodDelta: string;
}

export function transformActivity(page: NotionPage): ActivityEntry {
  return {
    id: extractString(page, "ID"),
    name: extractTitle(page),
    date: extractDate(page, "Date"),
    activityType: extractString(page, "Activity Type"),
    durationHours: extractNumber(page, "Duration"),
    activityNotes: extractString(page, "Activity Notes"),
    isHabit: extractBoolean(page, "Habit"),
    isLogged: extractBoolean(page, "Logged"),
    projectCount: extractRelationCount(page, "Projects"),
    daysAgo: daysAgo(extractDate(page, "Date")),
    energy: extractString(page, "energy"),
    moodDelta: extractString(page, "mood_delta"),
  };
}

export function activitiesToMarkdown(
  entries: ActivityEntry[],
  title = "Activity Log"
): string {
  if (entries.length === 0) {
    return `## ${title}\n\nNo activities found for the specified period.`;
  }

  const lines = [`## ${title}`, ""];

  const byType = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const type = e.activityType || "Uncategorized";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(e);
  }

  const totalHours = entries.reduce((s, e) => s + (e.durationHours ?? 0), 0);
  lines.push(`**Total entries:** ${entries.length} | **Total tracked time:** ${totalHours.toFixed(1)}h`);
  lines.push("");

  for (const [type, typeEntries] of byType) {
    const typeHours = typeEntries.reduce((s, e) => s + (e.durationHours ?? 0), 0);
    lines.push(`### ${type} (${typeHours.toFixed(1)}h, ${typeEntries.length} entries)`);
    lines.push("");

    for (const e of typeEntries) {
      const timeStr = e.date ? formatDateTime(e.date) : "No date";
      const durStr = e.durationHours != null ? `${e.durationHours}h` : "No duration";
      const habitTag = e.isHabit ? " 🔄 Habit" : "";
      const loggedTag = e.isLogged ? " ✅ Logged" : "";

      lines.push(`- **[${timeStr}]** ${e.name} — ${durStr}${habitTag}${loggedTag}`);
      if (e.activityNotes && e.activityNotes !== e.name) {
        lines.push(`  - Notes: ${e.activityNotes}`);
      }
    }
    lines.push("");
  }

  // Energy & Mood summary — only if any entry has data
  const hasEnergyOrMood = entries.some((e) => e.energy || e.moodDelta);
  if (hasEnergyOrMood) {
    lines.push("### Energy & Mood");
    lines.push("");

    // Energy distribution
    const energyCounts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    let energyUnspecified = 0;
    for (const e of entries) {
      if (e.energy && energyCounts[e.energy] !== undefined) {
        energyCounts[e.energy]++;
      } else if (e.energy) {
        energyUnspecified++;
      }
    }
    const totalWithEnergy = entries.length - energyUnspecified;
    if (totalWithEnergy > 0) {
      for (const [level, count] of Object.entries(energyCounts)) {
        const pct = ((count / totalWithEnergy) * 100).toFixed(0);
        lines.push(`- **${level}:** ${count} (${pct}%)`);
      }
    }

    // Mood trend
    const moodCounts: Record<string, number> = { "↑": 0, "→": 0, "↓": 0 };
    let moodUnspecified = 0;
    for (const e of entries) {
      if (e.moodDelta && moodCounts[e.moodDelta] !== undefined) {
        moodCounts[e.moodDelta]++;
      } else if (e.moodDelta) {
        moodUnspecified++;
      }
    }
    const totalWithMood = entries.length - moodUnspecified;
    if (totalWithMood > 0) {
      lines.push("");
      for (const [symbol, count] of Object.entries(moodCounts)) {
        lines.push(`- **${symbol}:** ${count}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
