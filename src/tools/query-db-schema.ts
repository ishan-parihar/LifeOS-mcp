import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { DB_KEYS } from "./entry-helpers.js";

export function registerQueryDbSchemaTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  const dbEnum = z.enum(DB_KEYS);

  server.tool(
    "lifeos_query_db_schema",
    "Get the real-time schema for any LifeOS database: property names, types, and usage guidance. Returns compact, agent-optimized schema with exact property names for lifeos_create_entry, lifeos_update_entry, and lifeos_query filters. Use before creating or updating entries to know exactly which properties exist and their types.",
    {
      database: dbEnum.describe("Database key to get schema for"),
    },
    async ({ database }) => {
      const db = getDbConfig(config, database);
      const ds = await notion.getDataSource(db.data_source_id);

      const lines = [
        `## ${db.name} — Schema (\`${database}\`)`,
        "",
        `**Data Source ID:** \`${db.data_source_id}\``,
        `**Total properties:** ${Object.keys(ds.properties).length}`,
        "",
      ];

      const byType = new Map<string, Array<[string, any]>>();
      for (const [name, prop] of Object.entries(ds.properties)) {
        const type = (prop as any).type || "unknown";
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push([name, prop]);
      }

      const typeOrder = [
        "title", "rich_text", "number", "date", "select", "multi_select",
        "status", "checkbox", "relation", "url", "unique_id", "formula",
      ];

      for (const type of typeOrder) {
        const props = byType.get(type);
        if (!props || props.length === 0) continue;

        lines.push(`### ${type}`);
        for (const [name, prop] of props) {
          const options = (prop as any)[type]?.options;
          const extra = options && options.length > 0
            ? ` [${options.map((o: any) => o.name).join(" | ")}]`
            : "";
          lines.push(`- \`${name}\`${extra}`);
        }
        lines.push("");
      }

      for (const [type, props] of byType) {
        if (!typeOrder.includes(type)) {
          lines.push(`### ${type}`);
          for (const [name] of props) {
            lines.push(`- \`${name}\``);
          }
          lines.push("");
        }
      }

      const configProps = Object.entries(db.properties);
      if (configProps.length > 0) {
        lines.push("### Configured Mappings (for lifeos_create_entry / lifeos_update_entry)");
        lines.push("Use these keys in the `properties` JSON object:");
        lines.push("");
        for (const [key, name] of configProps) {
          const propSchema = ds.properties[name];
          const propType = propSchema ? (propSchema as any).type : "unknown";
          lines.push(`- \`${key}\` → "${name}" (${propType})`);
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
