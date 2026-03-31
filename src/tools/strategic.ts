import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString } from "../transformers/shared.js";

function registerStrategicTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient,
  dbKey: string,
  toolName: string,
  description: string
) {
  server.tool(
    toolName,
    description,
    {
      status: z.string().optional().describe("Filter by status"),
      limit: z.number().optional().describe("Max entries (default: 30)"),
    },
    async ({ status, limit = 30 }) => {
      const db = getDbConfig(config, dbKey);
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
      };

      if (status) {
        body.filter = {
          property: "Status",
          status: { equals: status },
        };
      }

      const result = await notion.queryDataSource(db.data_source_id, body);
      const lines = [`## ${db.name} (${result.results.length} entries)`, ""];

      for (const p of result.results) {
        const name = extractTitle(p);
        const id = extractString(p, "ID");
        const statusVal = extractString(p, "Status");
        const monitor = extractString(p, "Monitor");
        const progress = extractString(p, "Progress");
        const health = extractString(p, "Health");

        lines.push(`### ${id ? `${id}: ` : ""}${name}`);
        if (statusVal) lines.push(`- **Status:** ${statusVal}`);
        if (monitor) lines.push(`- **Monitor:** ${monitor}`);
        if (progress) lines.push(`- **Progress:** ${progress.substring(0, 100)}`);
        if (health) lines.push(`- **Health:** ${health.substring(0, 100)}`);

        for (const [propKey, propName] of Object.entries(db.properties)) {
          if (["Name", "Status", "Monitor", "Progress", "Health", "ID"].includes(propName)) continue;
          if (propName.includes("JSON")) continue;
          const val = extractString(p, propName);
          if (val && val.length > 0 && val !== "0 related") {
            lines.push(`- **${propKey}:** ${val.substring(0, 150)}${val.length > 150 ? "..." : ""}`);
          }
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

export function registerStrategicTools(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  registerStrategicTool(
    server, config, notion, "projects",
    "lifeos_projects",
    "Retrieve projects with status, health, progress, and task/activity counts."
  );
  registerStrategicTool(
    server, config, notion, "quarterly_goals",
    "lifeos_quarterly_goals",
    "Retrieve quarterly OKRs with key results, progress tracking, and health status."
  );
  registerStrategicTool(
    server, config, notion, "annual_goals",
    "lifeos_annual_goals",
    "Retrieve annual goals with strategic intent, epic descriptions, and quarterly breakdowns."
  );
  registerStrategicTool(
    server, config, notion, "directives_risk_log",
    "lifeos_directives_risks",
    "Retrieve directives and risks with threat levels, likelihood, impact, and mitigation status."
  );
  registerStrategicTool(
    server, config, notion, "opportunities_strengths",
    "lifeos_opportunities_strengths",
    "Retrieve opportunities and strengths with leverage scores and activation status."
  );
}
