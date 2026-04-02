import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformContent, contentsToMarkdown, calendarMarkdown } from "../transformers/content.js";

const ACTION = z.enum(["list", "transition", "publish", "update_metrics", "calendar"]);

const STATUS_ORDER = [
  "Potential Idea",
  "Scheduled",
  "Next Up 🚩",
  "Writing 📝",
  "Recording ⏺",
  "Editing 🎞",
  "Ready to Post 📤",
  "Published 💥",
];

function canTransition(to: string): boolean {
  return STATUS_ORDER.includes(to);
}

export function registerContentTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_content",
    "Content Pipeline operations for agents: list, guarded transitions, publish with URL, bulk metrics update, and calendar view.",
    {
      action: ACTION.describe("Action to perform"),
      // list filters
      status: z.string().optional(),
      platforms: z.array(z.string()).optional(),
      campaign_ids: z.array(z.string()).optional(),
      publish_date_from: z.string().optional(),
      publish_date_to: z.string().optional(),
      limit: z.number().optional(),
      // transition/publish/metrics
      content_id: z.string().optional(),
      content_ids: z.array(z.string()).optional(),
      to: z.string().optional(),
      override: z.boolean().optional(),
      live_url: z.string().optional(),
      live_urls: z.array(z.string()).optional(),
      reach: z.number().optional(),
      clicks: z.number().optional(),
      engagement: z.number().optional(),
      // calendar
      date_from: z.string().optional(),
      date_to: z.string().optional(),
    },
    async (args) => {
      const db = getDbConfig(config, "content_pipeline");
      const act = args.action as z.infer<typeof ACTION>;

      if (act === "list") {
        const body: Record<string, unknown> = {
          page_size: Math.min(args.limit ?? 50, 100),
        };
        const filters: any[] = [];
        if (args.status) filters.push({ property: "Status", status: { equals: args.status } });
        if (args.publish_date_from) filters.push({ property: "Publish Date", date: { on_or_after: args.publish_date_from } });
        if (args.publish_date_to) filters.push({ property: "Publish Date", date: { on_or_before: `${args.publish_date_to}T23:59:59Z` } });
        if (filters.length) body.filter = { and: filters };
        const result = await notion.queryDataSource(db.data_source_id, body);
        const entries = result.results.map(transformContent);
        const md = contentsToMarkdown(entries);
        return { content: [{ type: "text" as const, text: md }] };
      }

      if (act === "transition") {
        if (!args.content_id || !args.to) throw new Error("transition requires content_id and to");
        const to = args.to;
        if (!canTransition(to) && !args.override) throw new Error(`invalid status '${to}' — set override=true to force`);
        await notion.updatePage(args.content_id, { Status: { status: { name: to } } as any });
        return { content: [{ type: "text" as const, text: `## Transitioned\n- content_id: ${args.content_id}\n- to: ${to}` }] };
      }

      if (act === "publish") {
        const ids = args.content_ids ?? (args.content_id ? [args.content_id] : []);
        if (ids.length === 0) throw new Error("publish requires content_id or content_ids");
        const urls = args.live_urls ?? (args.live_url ? [args.live_url] : []);
        const updates: string[] = [];
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const url = urls[i] ?? urls[0] ?? "";
          const props: Record<string, unknown> = { Status: { status: { name: "Published 💥" } } } as any;
          if (url) props["Live URL"] = { url };
          await notion.updatePage(id, props);
          updates.push(`- ${id} → Published ${url ? `(URL set)` : ""}`.trim());
        }
        return { content: [{ type: "text" as const, text: `## Published\n${updates.join("\n")}` }] };
      }

      if (act === "update_metrics") {
        const ids = args.content_ids ?? (args.content_id ? [args.content_id] : []);
        if (ids.length === 0) throw new Error("update_metrics requires content_id or content_ids");
        const props: Record<string, unknown> = {};
        if (typeof args.reach === "number") props["Reach"] = { number: args.reach };
        if (typeof args.clicks === "number") props["Clicks"] = { number: args.clicks };
        if (typeof args.engagement === "number") props["Engagement"] = { number: args.engagement };
        if (Object.keys(props).length === 0) throw new Error("no metrics provided");
        for (const id of ids) await notion.updatePage(id, props);
        return { content: [{ type: "text" as const, text: `## Metrics Updated\n- updated: ${ids.length} item(s)` }] };
      }

      if (act === "calendar") {
        const from = args.date_from ?? new Date().toISOString().slice(0, 10);
        const to = args.date_to ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const body: Record<string, unknown> = {
          page_size: 100,
          filter: {
            and: [
              { property: "Publish Date", date: { on_or_after: from } },
              { property: "Publish Date", date: { on_or_before: `${to}T23:59:59Z` } },
            ],
          },
          sorts: [{ property: "Publish Date", direction: "ascending" }],
        };
        const result = await notion.queryDataSource(db.data_source_id, body);
        const entries = result.results.map(transformContent);
        const md = calendarMarkdown(entries, from, to);
        return { content: [{ type: "text" as const, text: md }] };
      }

      throw new Error(`Unknown action: ${act}`);
    }
  );
}
