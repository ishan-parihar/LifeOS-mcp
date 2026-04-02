import { NotionPage } from "../notion/types.js";
import { extractTitle, extractString, extractDate, extractRelationCount, formatDate } from "./shared.js";

export interface CampaignEntry {
  id: string;
  name: string;
  theme: string;
  summary: string;
  startDate: string;
  endDate: string;
  platforms: string;
  contentTypes: string;
  contentFrequency: string;
  targetReach: string;
  projectsCount: number;
  contentCount: number;
}

export function transformCampaign(page: NotionPage): CampaignEntry {
  return {
    id: page.id,
    name: extractTitle(page),
    theme: extractString(page, "Theme"),
    summary: extractString(page, "Summary"),
    startDate: extractDate(page, "Start Date"),
    endDate: extractDate(page, "End Date"),
    platforms: extractString(page, "Platforms"),
    contentTypes: extractString(page, "Content Types"),
    contentFrequency: extractString(page, "Content Frequency"),
    targetReach: extractString(page, "Target Reach"),
    projectsCount: extractRelationCount(page, "Projects"),
    contentCount: extractRelationCount(page, "Content Pipeline"),
  };
}

export function campaignsToMarkdown(entries: CampaignEntry[]): string {
  if (entries.length === 0) return "## Campaigns\n\nNo campaigns found.";
  const lines: string[] = [];
  lines.push("## Campaigns");
  lines.push("");
  for (const c of entries) {
    lines.push(`### ${c.name}`);
    if (c.theme) lines.push(`- Theme: ${c.theme}`);
    if (c.contentFrequency) lines.push(`- Frequency: ${c.contentFrequency}`);
    if (c.platforms) lines.push(`- Platforms: ${c.platforms}`);
    const dates: string[] = [];
    if (c.startDate) dates.push(formatDate(c.startDate));
    if (c.endDate) dates.push(formatDate(c.endDate));
    if (dates.length) lines.push(`- Window: ${dates.join(" → ")}`);
    if (c.contentTypes) lines.push(`- Types: ${c.contentTypes}`);
    const rel: string[] = [];
    if (c.projectsCount) rel.push(`Projects(${c.projectsCount})`);
    if (c.contentCount) rel.push(`Content(${c.contentCount})`);
    if (rel.length) lines.push(`- 🔗 ${rel.join(" ")}`);
    lines.push("");
  }
  return lines.join("\n");
}
