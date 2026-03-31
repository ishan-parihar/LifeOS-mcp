import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbsByAgent } from "../config.js";
import { NotionClient } from "../notion/client.js";

export function registerDiscoverTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_discover",
    "Discover all available LifeOS databases, their schemas, and which agent domains they belong to. Use this first to understand what data is available.",
    {
      agent: z
        .enum(["productivity", "journaling", "strategic", "all"])
        .optional()
        .describe("Filter by agent domain. Default: all"),
    },
    async ({ agent = "all" }) => {
      const lines = ["# LifeOS Database Discovery", ""];

      const dbs =
        agent === "all"
          ? config.databases
          : getDbsByAgent(config, agent);

      const byAgent = new Map<string, Array<[string, typeof config.databases[string]]>>();
      for (const [key, db] of Object.entries(dbs)) {
        if (!byAgent.has(db.agent)) byAgent.set(db.agent, []);
        byAgent.get(db.agent)!.push([key, db]);
      }

      for (const [agentName, agentDbs] of byAgent) {
        lines.push(`## ${agentName.charAt(0).toUpperCase() + agentName.slice(1)} Agent`);
        lines.push("");

        for (const [key, db] of agentDbs) {
          lines.push(`### ${db.name} (\`${key}\`)`);
          lines.push(`- **Data Source ID:** \`${db.data_source_id}\``);
          lines.push(`- **Properties:**`);
          for (const [propKey, propName] of Object.entries(db.properties)) {
            lines.push(`  - \`${propKey}\` → "${propName}"`);
          }
          lines.push("");
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n"),
          },
        ],
      };
    }
  );
}
