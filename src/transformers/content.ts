import { NotionPage } from "../notion/types.js";
import { extractTitle, extractString, extractDate, extractNumber, extractRelationCount, formatDate } from "./shared.js";

export interface ContentEntry {
  id: string;
  name: string;
  status: string;
  platforms: string;
  format: string;
  tone: string;
  pillar: string;
  funnelStage: string;
  publishDate: string;
  actionDate: string;
  liveUrl: string;
  reach: number | null;
  clicks: number | null;
  engagement: number | null;
  parentCount: number;
  childCount: number;
  campaignCount: number;
}

export function transformContent(page: NotionPage): ContentEntry {
  return {
    id: page.id,
    name: extractTitle(page),
    status: extractString(page, "Status"),
    platforms: extractString(page, "Platforms"),
    format: extractString(page, "Format"),
    tone: extractString(page, "Tone"),
    pillar: extractString(page, "Pillar"),
    funnelStage: extractString(page, "Funnel Stage"),
    publishDate: extractDate(page, "Publish Date"),
    actionDate: extractDate(page, "Action Date"),
    liveUrl: extractString(page, "Live URL"),
    reach: extractNumber(page, "Reach"),
    clicks: extractNumber(page, "Clicks"),
    engagement: extractNumber(page, "Engagement"),
    parentCount: extractRelationCount(page, "Parent Content"),
    childCount: extractRelationCount(page, "Child Content"),
    campaignCount: extractRelationCount(page, "Campaigns"),
  };
}

export function contentsToMarkdown(entries: ContentEntry[], title = "Content Pipeline"): string {
  if (entries.length === 0) return `## ${title}\n\nNo content found.`;
  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push("");
  // Group by status for readability
  const byStatus = new Map<string, ContentEntry[]>();
  for (const e of entries) {
    const k = e.status || "(No Status)";
    if (!byStatus.has(k)) byStatus.set(k, []);
    byStatus.get(k)!.push(e);
  }
  for (const [status, arr] of byStatus) {
    lines.push(`### ${status} (${arr.length})`);
    lines.push("");
    for (const e of arr) {
      lines.push(`- ${e.name} — ${e.platforms || "-"} ${e.format ? `| ${e.format}` : ""}`.trim());
      const meta: string[] = [];
      if (e.publishDate) meta.push(`Publish: ${formatDate(e.publishDate)}`);
      if (e.liveUrl) meta.push(`URL`);
      if (e.reach != null) meta.push(`Reach ${e.reach}`);
      if (e.clicks != null) meta.push(`Clicks ${e.clicks}`);
      if (meta.length) lines.push(`  - ${meta.join(" • ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function calendarMarkdown(entries: ContentEntry[], dateFrom: string, dateTo: string): string {
  const lines: string[] = [];
  lines.push(`## Content Calendar — ${dateFrom} → ${dateTo}`);
  lines.push("");
  const withDate = entries.filter((e) => !!e.publishDate);
  withDate.sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  let current = "";
  for (const e of withDate) {
    const d = e.publishDate.split("T")[0];
    if (d !== current) {
      current = d;
      lines.push(`### ${current}`);
    }
    lines.push(`- ${e.name} (${e.status}) — ${e.platforms || "-"}`);
  }
  if (withDate.length === 0) lines.push("No scheduled items in range.");
  return lines.join("\n");
}
