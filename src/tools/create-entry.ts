import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { markdownToNotionChildren } from "../transformers/notion-blocks.js";
import { DB_KEYS, DbKey, buildNotionProperties } from "./entry-helpers.js";

export function registerCreateEntryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  const dbEnum = z.enum(DB_KEYS);

  server.tool(
    "lifeos_create_entry",
    "Create a new entry in any LifeOS database. Use lifeos_query_db_schema(database) first to see available properties for the target database. Always confirm with user before creating entries based on estimates or suggestions. Use with: lifeos_query_db_schema (schema lookup), lifeos_weekday_patterns (suggested activities for missing days), lifeos_daily_briefing (tasks from daily context), lifeos_create_report (save analysis outputs).",
    {
      database: dbEnum.describe("Database to create entry in"),
      name: z.string().describe("Entry title / name"),
      properties: z.record(z.unknown()).optional().describe(
        "Properties as a JSON object. Only include fields relevant to the chosen database. " +
        "Use lifeos_query_db_schema(database) to see available property keys."
      ),
    },
    async ({ database, name, properties = {} }) => {
      const db = getDbConfig(config, database);
      const { properties: notionProps, children } = buildNotionProperties(
        database as DbKey, name, properties as Record<string, unknown>
      );

      const body: Record<string, unknown> = {
        parent: { data_source_id: db.data_source_id },
        properties: notionProps,
      };

      if (children.length > 0) {
        body.children = children;
      }

      const result = await notion.createPage(body as any);

      const lines = [
        `## Entry Created: ${name}`,
        `- **Database:** ${db.name}`,
        `- **Page ID:** ${result.id}`,
        result.url ? `- **URL:** ${result.url}` : "",
        "",
      ].filter(Boolean);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
