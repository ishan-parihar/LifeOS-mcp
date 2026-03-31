import { NotionPage } from "../notion/types.js";
import {
  extractTitle,
  extractString,
  extractDate,
  extractRelationCount,
  formatDateTime,
  daysAgo,
} from "./shared.js";

export interface TaskEntry {
  id: string;
  name: string;
  status: string;
  priority: string;
  actionDate: string;
  description: string;
  monitor: string;
  sprintStatus: string;
  projectCount: number;
  daysAgo: number;
  isOverdue: boolean;
}

const ACTIVE_STATUSES = new Set(["Active", "Focus", "Up Next", "Waiting", "Paused"]);
const DONE_STATUSES = new Set(["Done", "Cancelled", "Archived"]);

export function transformTask(page: NotionPage): TaskEntry {
  const actionDate = extractDate(page, "Action Date");
  const status = extractString(page, "Status");
  const isOverdue =
    ACTIVE_STATUSES.has(status) &&
    actionDate !== "" &&
    daysAgo(actionDate) > 0;

  return {
    id: extractString(page, "ID"),
    name: extractTitle(page),
    status,
    priority: extractString(page, "Priority"),
    actionDate,
    description: extractString(page, "Description"),
    monitor: extractString(page, "Monitor"),
    sprintStatus: extractString(page, "Sprint Status"),
    projectCount: extractRelationCount(page, "Projects"),
    daysAgo: daysAgo(actionDate),
    isOverdue,
  };
}

export function tasksToMarkdown(
  entries: TaskEntry[],
  title = "Tasks"
): string {
  if (entries.length === 0) {
    return `## ${title}\n\nNo tasks found.`;
  }

  const lines = [`## ${title}`, ""];

  const active = entries.filter((e) => ACTIVE_STATUSES.has(e.status));
  const done = entries.filter((e) => DONE_STATUSES.has(e.status));
  const overdue = entries.filter((e) => e.isOverdue);

  lines.push(
    `**Total:** ${entries.length} | **Active:** ${active.length} | **Done:** ${done.length} | ⚠️ **Overdue:** ${overdue.length}`
  );
  lines.push("");

  if (overdue.length > 0) {
    lines.push("### ⚠️ Overdue Tasks");
    lines.push("");
    for (const t of overdue) {
      const dueStr = t.actionDate ? formatDateTime(t.actionDate) : "No date";
      lines.push(
        `- **[${t.status}]** ${t.id}: ${t.name} (was due: ${dueStr})`
      );
      if (t.priority) lines.push(`  - Priority: ${t.priority}`);
      if (t.monitor) lines.push(`  - Monitor: ${t.monitor}`);
    }
    lines.push("");
  }

  if (active.length > 0) {
    lines.push("### Active Tasks");
    lines.push("");
    for (const t of active) {
      const dueStr = t.actionDate ? formatDateTime(t.actionDate) : "No date";
      const statusIcon =
        t.status === "Focus" ? "🎯" : t.status === "Active" ? "▶️" : "⏸️";
      lines.push(
        `- ${statusIcon} **[${t.status}]** ${t.id}: ${t.name}`
      );
      if (t.priority) lines.push(`  - Priority: ${t.priority}`);
      if (t.actionDate) lines.push(`  - Action Date: ${dueStr}`);
      if (t.monitor) lines.push(`  - Monitor: ${t.monitor}`);
    }
    lines.push("");
  }

  if (done.length > 0) {
    lines.push("### Completed/Cancelled");
    lines.push("");
    for (const t of done.slice(0, 10)) {
      lines.push(
        `- ~~${t.id}: ${t.name}~~ (${t.status})`
      );
    }
    if (done.length > 10) {
      lines.push(`- ... and ${done.length - 10} more`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
