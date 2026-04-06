import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate } from "../transformers/shared.js";

const FILTER_TYPES = ["select", "status", "rich_text", "title", "formula", "number", "date", "checkbox", "relation", "unique_id"] as const;

function buildFilter(property: string, filterType: string, value: string): Record<string, unknown> {
  switch (filterType) {
    case "select":
      return { property, select: { equals: value } };
    case "status":
      return { property, status: { equals: value } };
    case "rich_text":
      return { property, rich_text: { contains: value } };
    case "title":
      return { property, title: { contains: value } };
    case "formula":
      return { property, formula: { string: { contains: value } } };
    case "number":
      return { property, formula: { number: { equals: Number(value) } } };
    case "checkbox":
      return { property, checkbox: { equals: value === "true" } };
    case "date":
      return { property, date: { equals: value } };
    case "relation":
      return { property, relation: { contains: value } };
    case "unique_id": {
      // Parse number from value - handle both "123" and "TASK-123" formats
      const numMatch = String(value).match(/^([A-Za-z]+-)?(\d+)$/);
      const num = numMatch ? parseInt(numMatch[2], 10) : parseInt(String(value), 10);
      if (isNaN(num)) return { property, rich_text: { contains: String(value) } };
      return { property, unique_id: { equals: num } };
    }
    default:
      return { property, rich_text: { contains: value } };
  }
}

export function registerQueryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_query",
    "Query any LifeOS database with custom filters. Property types are auto-detected from the database schema — filter_type is optional. Use with: lifeos_discover (to see available databases and property names first).",
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
        .enum(FILTER_TYPES)
        .optional()
        .describe("Override property type for filtering. Auto-detected if omitted."),
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
      return_properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return. If omitted, returns all properties."),
    },
    async ({ database, filter_property, filter_value, filter_type, sort_property, sort_direction, limit = 50, return_properties }) => {
      const db = getDbConfig(config, database);
      const body: Record<string, unknown> = { page_size: Math.min(limit, 100) };

      if (filter_property && filter_value) {
        let resolvedType = filter_type;

        if (!resolvedType) {
          // Auto-detect property type from data source schema
          const ds = await notion.getDataSource(db.data_source_id);
          const propSchema = ds.properties[filter_property];
          if (propSchema) {
            const detectedType = propSchema.type;
            if (detectedType === "formula") {
              resolvedType = "formula";
            } else if (detectedType === "select") {
              resolvedType = "select";
            } else if (detectedType === "status") {
              resolvedType = "status";
            } else if (detectedType === "title") {
              resolvedType = "title";
            } else if (detectedType === "number") {
              resolvedType = "number";
            } else if (detectedType === "checkbox") {
              resolvedType = "checkbox";
            } else if (detectedType === "date") {
              resolvedType = "date";
            } else if (detectedType === "relation") {
              resolvedType = "relation";
            } else if (detectedType === "unique_id") {
              resolvedType = "unique_id";
            } else {
              resolvedType = "rich_text";
            }
          } else {
            resolvedType = "rich_text";
          }
        }

        body.filter = buildFilter(filter_property, resolvedType, filter_value);
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

        const propsToShow = return_properties && return_properties.length > 0
          ? return_properties
          : Object.entries(db.properties)
              .filter(([propKey, propName]) => {
                if (propName === "Name" || propName === "title" || propName === db.properties.title) return false;
                if (propKey.endsWith("_json")) return false;
                return true;
              })
              .map(([propKey]) => propKey);

        for (const propKey of propsToShow) {
          const propName = db.properties[propKey];
          if (!propName) continue;
          const val = extractString(page, propName);
          if (val && val !== "0 related") {
            lines.push(`- **${propKey}:** ${val}`);
          }
        }
        lines.push("");
      }

      if (result.has_more) {
        lines.push(`> More results available. Increase limit or add filters.`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
