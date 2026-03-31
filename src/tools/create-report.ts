import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { markdownToNotionChildren } from "../transformers/notion-blocks.js";

export function registerCreateReportTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_create_report",
    "Save an analysis or report to the Reports database as agent memory. Accepts full markdown content — auto-converted to Notion blocks. Returns the page URL for future reference.",
    {
      title: z.string().describe("Report title (e.g., 'Weekly Analysis — W13 2026', 'Trajectory: Work Hours Q1')"),
      agent: z.enum(["Psychologist", "Productivity", "Relational", "Strategic", "Nutritionist", "Financial"]),
      report_content: z.string().describe("Full report text in markdown. Auto-segmented into Notion rich text blocks. Can be the output of any analysis tool."),
    },
    async ({ title, agent, report_content }) => {
      const db = getDbConfig(config, "reports");

      const body: Record<string, unknown> = {
        parent: { data_source_id: db.data_source_id },
        properties: {
          "Title": { title: [{ text: { content: title } }] },
          "Agent": { select: { name: agent } },
          "Report": { rich_text: [{ type: "text", text: { content: report_content.substring(0, 2000) } }] },
        },
      };

      // Also add report content as page blocks for rich formatting
      const children = markdownToNotionChildren(report_content);
      if (children.length > 0) {
        body.children = children;
      }

      const result = await notion.createPage(body as any);

      const lines = [
        `## Report Saved: ${title}`,
        `- **Agent:** ${agent}`,
        `- **Page ID:** ${result.id}`,
        result.url ? `- **URL:** ${result.url}` : "",
        `- **Content length:** ${report_content.length} chars → ${children.length} blocks`,
        "",
        "This report is now persisted as agent memory in the Reports database.",
      ].filter(Boolean);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
