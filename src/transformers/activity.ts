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

  return lines.join("\n");
}
