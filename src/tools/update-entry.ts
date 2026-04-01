import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle } from "../transformers/shared.js";
import { DB_KEYS, DbKey, DB_DESCRIPTIONS, buildUpdateProperties } from "./entry-helpers.js";

export function registerUpdateEntryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  const dbEnum = z.enum(DB_KEYS);

  server.tool(
    "lifeos_update_entry",
    "Update properties of an existing LifeOS entry. Use lifeos_find_entry or lifeos_query first to get the page_id. Only the properties you provide will be updated — others remain unchanged. Use with: lifeos_find_entry (to resolve names to page IDs).\n\n" +
    Object.entries(DB_DESCRIPTIONS).map(([k, v]) => `**${k}**: ${v}`).join("\n\n"),
    {
      database: dbEnum.describe("Database the entry belongs to"),
      page_id: z.string().describe("Page ID of the entry to update (from lifeos_find_entry or lifeos_query results)"),
      properties: z.record(z.unknown()).describe(
        "Properties to update as a JSON object. Only include fields you want to change. " +
        "See tool description for available properties per database. Title/name updates are supported."
      ),
    },
    async ({ database, page_id, properties }) => {
      const db = getDbConfig(config, database);
      
      const notionProps = buildUpdateProperties(
        database as DbKey, properties as Record<string, unknown>
      );

      await notion.updatePage(page_id, notionProps);

      const lines = [
        `## Entry Updated`,
        `- **Database:** ${db.name}`,
        `- **Page ID:** ${page_id}`,
        `- **Updated properties:** ${Object.keys(properties).join(", ")}`,
        "",
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
