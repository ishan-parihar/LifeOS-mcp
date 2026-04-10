import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformCampaign, campaignsToMarkdown } from "../transformers/campaigns.js";

const ACTION = z.enum(["list", "brief"]);

export function registerCampaignsTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_campaigns",
    "Campaign Management operations. Actions: 'list' (filter by status/date/platforms), 'brief' (single campaign details by campaign_id). Use with: lifeos_content for pipeline execution, lifeos_alignment for OKR↔campaign coverage.",
    {
      action: ACTION.describe("Action to perform"),
      status: z.string().optional(),
      start_date_from: z.string().optional(),
      end_date_to: z.string().optional(),
      platforms: z.array(z.string()).optional(),
      limit: z.number().optional(),
      campaign_id: z.string().optional(),
    },
    async ({ action, status, start_date_from, end_date_to, platforms, limit = 30, campaign_id }) => {
      const db = getDbConfig(config, "campaigns");
      if (action === "list") {
        const filters: any[] = [];
        if (status) filters.push({ property: "Status", status: { equals: status } });
        if (start_date_from) filters.push({ property: "Start Date", date: { on_or_after: start_date_from } });
        if (end_date_to) filters.push({ property: "End Date", date: { on_or_before: `${end_date_to}T23:59:59Z` } });
        const body: Record<string, unknown> = { page_size: Math.min(limit, 100) };
        if (filters.length) body.filter = { and: filters };
        const result = await notion.queryDataSource(db.data_source_id, body);
        const entries = result.results.map(transformCampaign);
        const md = campaignsToMarkdown(entries);
        return { content: [{ type: "text" as const, text: md }] };
      }
      if (action === "brief") {
        if (!campaign_id) throw new Error("brief requires campaign_id");
        const page = await notion.getPage(campaign_id);
        const c = transformCampaign(page);
        const lines: string[] = [];
        lines.push(`# Campaign Brief — ${c.name}`);
        if (c.theme) lines.push(`Theme: ${c.theme}`);
        if (c.summary) lines.push(`Summary: ${c.summary}`);
        if (c.platforms) lines.push(`Platforms: ${c.platforms}`);
        if (c.contentTypes) lines.push(`Types: ${c.contentTypes}`);
        if (c.contentFrequency) lines.push(`Frequency: ${c.contentFrequency}`);
        if (c.startDate || c.endDate) lines.push(`Window: ${[c.startDate, c.endDate].filter(Boolean).join(" → ")}`);
        if (c.targetReach) lines.push(`Target Reach: ${c.targetReach}`);
        const rel: string[] = [];
        if (c.projectsCount) rel.push(`Projects(${c.projectsCount})`);
        if (c.contentCount) rel.push(`Content(${c.contentCount})`);
        if (rel.length) lines.push(`Links: ${rel.join(" ")}`);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }
      throw new Error(`Unknown action: ${action}`);
    }
  );
}
