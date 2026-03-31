import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate } from "../transformers/shared.js";

export function registerQueryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_query",
    "Query any LifeOS database with custom filters. Use lifeos_discover first to see available databases and property names.",
    {
      database: z
        .string()
        .describe("Database key (e.g., 'activity_log', 'tasks', 'projects'). Use lifeos_discover to see all options."),
      filter_property: z
        .string()
        .optional()
        .describe("Property name to filter on (use the Notion property name, not the key)"),
      filter_value: z
        .string()
        .optional()
        .describe("Value to filter for"),
      filter_type: z
        .enum(["select", "status", "rich_text", "title"])
        .optional()
        .describe("Type of the filter property"),
      sort_property: z
        .string()
        .optional()
        .describe("Property to sort by"),
      sort_direction: z
        .enum(["ascending", "descending"])
        .optional()
        .describe("Sort direction"),
      limit: z
        .number()
        .optional()
        .describe("Max results to return (default: 50)"),
    },
    async ({ database, filter_property, filter_value, filter_type, sort_property, sort_direction, limit = 50 }) => {
      const db = getDbConfig(config, database);
      const body: Record<string, unknown> = { page_size: Math.min(limit, 100) };

      if (filter_property && filter_value && filter_type) {
        const filterMap: Record<string, Record<string, unknown>> = {
          select: { select: { equals: filter_value } },
          status: { status: { equals: filter_value } },
          rich_text: { rich_text: { contains: filter_value } },
          title: { title: { contains: filter_value } },
        };
        body.filter = {
          property: filter_property,
          ...filterMap[filter_type],
        };
      }

      if (sort_property) {
        body.sorts = [
          {
            property: sort_property,
            direction: sort_direction || "descending",
          },
        ];
      }

      const result = await notion.queryDataSource(db.data_source_id, body);

      const lines = [`## ${db.name} — Query Results (${result.results.length} entries)`, ""];

      for (const page of result.results) {
        const title = extractTitle(page);
        lines.push(`### ${title}`);

        for (const [propKey, propName] of Object.entries(db.properties)) {
          if (propName === "Name" || propName === "title") continue;
          const val = extractString(page, propName);
          if (val && val !== "0 related") {
            lines.push(`- **${propKey}:** ${val}`);
          }
        }
        lines.push("");
      }

      if (result.has_more) {
        lines.push(`> ⚠️ More results available. Increase limit or add filters.`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
