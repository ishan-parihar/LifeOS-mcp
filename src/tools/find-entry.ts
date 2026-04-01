import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { NotionPage } from "../notion/types.js";
import { extractTitle, extractString, extractNumber, extractDate, extractBoolean } from "../transformers/shared.js";
import { DB_KEYS, TITLE_FIELD_MAP, DB_DESCRIPTIONS } from "./entry-helpers.js";

function extractProperty(page: NotionPage, propName: string): string {
  const prop = page.properties[propName];
  if (!prop) return "";

  switch (prop.type) {
    case "title":
      return (prop as any).title?.map((t: any) => t.plain_text).join("") || "";
    case "rich_text":
      return (prop as any).rich_text?.map((t: any) => t.plain_text).join("") || "";
    case "select":
      return (prop as any).select?.name || "";
    case "status":
      return (prop as any).status?.name || "";
    case "number":
      return String((prop as any).number ?? "");
    case "date":
      return (prop as any).date?.start || "";
    case "checkbox":
      return String((prop as any).checkbox);
    case "formula": {
      const f = (prop as any).formula;
      if (f.type === "string") return f.string ?? "";
      if (f.type === "number") return String(f.number ?? "");
      if (f.type === "boolean") return String(f.boolean);
      if (f.type === "date") return f.date?.start ?? "";
      return "";
    }
    case "unique_id": {
      const uid = (prop as any).unique_id;
      return uid ? `${uid.prefix}-${uid.number}` : "";
    }
    case "relation":
      return `${((prop as any).relation?.length ?? 0)} related`;
    case "multi_select":
      return ((prop as any).multi_select || []).map((s: any) => s.name).join(", ");
    case "url":
      return (prop as any).url || "";
    default:
      return "";
  }
}

export function registerFindEntryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  const dbEnum = z.enum(DB_KEYS);

  server.tool(
    "lifeos_find_entry",
    "Find entries in a LifeOS database by name/title search. Returns page IDs and requested properties. Use this to resolve names to page IDs before updating entries. Use with: lifeos_update_entry (to update found entries), lifeos_archive_entry (to archive found entries).",
    {
      database: dbEnum.describe("Database to search in"),
      search: z.string().describe("Name or title to search for (partial match)"),
      return_properties: z.array(z.string()).optional().describe(
        "Property names to return for each match (e.g., ['Status', 'Priority', 'Date']). " +
        "If omitted, returns title and page_id only. Use property names from the database schema."
      ),
      limit: z.number().optional().describe("Max results to return (default: 5)"),
    },
    async ({ database, search, return_properties, limit = 5 }) => {
      const db = getDbConfig(config, database);
      const titleField = TITLE_FIELD_MAP[database] || "Name";

      const result = await notion.queryDataSource(db.data_source_id, {
        page_size: Math.min(limit, 100),
        filter: {
          property: titleField,
          title: { contains: search },
        },
        sorts: [{ property: titleField, direction: "ascending" }],
      });

      const lines: string[] = [];

      if (result.results.length === 0) {
        lines.push(`No entries found matching "${search}" in ${db.name}.`);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      }

      lines.push(`## Found ${result.results.length} entries in ${db.name} matching "${search}"`);
      lines.push("");

      for (const page of result.results) {
        const title = extractTitle(page);
        lines.push(`### ${title}`);
        lines.push(`- **Page ID:** ${page.id}`);
        if (page.url) lines.push(`- **URL:** ${page.url}`);

        if (return_properties && return_properties.length > 0) {
          for (const propName of return_properties) {
            const val = extractProperty(page, propName);
            if (val) lines.push(`- **${propName}:** ${val}`);
          }
        }
        lines.push("");
      }

      // If single result, also show a convenience snippet
      if (result.results.length === 1) {
        const page = result.results[0];
        lines.push(`> Single match. Use page_id \`${page.id}\` with lifeos_update_entry or lifeos_archive_entry.`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
