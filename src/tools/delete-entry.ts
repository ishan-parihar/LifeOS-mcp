import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle } from "../transformers/shared.js";
import { DB_KEYS } from "./entry-helpers.js";

export function registerDeleteEntryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  const dbEnum = z.enum(DB_KEYS);

  server.tool(
    "lifeos_delete_entry",
    "Permanently delete a LifeOS entry. The entry is moved to the database's archive (Notion trash) and hidden from normal queries. Use lifeos_find_entry first to get the page_id.",
    {
      database: dbEnum.describe("Database the entry belongs to"),
      page_id: z.string().describe("Page ID of the entry to delete (from lifeos_find_entry or lifeos_query results)"),
    },
    async ({ database, page_id }) => {
      const db = getDbConfig(config, database);

      await notion.archivePage(page_id);

      const lines = [
        `## Entry Deleted`,
        `- **Database:** ${db.name}`,
        `- **Page ID:** ${page_id}`,
        "",
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
