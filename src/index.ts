#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { NotionClient } from "./notion/client.js";
import { registerDiscoverTool } from "./tools/discover.js";
import { registerQueryTool } from "./tools/query.js";
import { registerActivityLogTool } from "./tools/activity-log.js";
import { registerTasksTool } from "./tools/tasks.js";
import { registerProductivityTool } from "./tools/productivity.js";
import { registerDailyBriefingTool } from "./tools/daily-briefing.js";
import { registerJournalingTools } from "./tools/journaling.js";
import { registerStrategicTools } from "./tools/strategic.js";

const config = loadConfig();
const token = process.env.NOTION_API_TOKEN;
if (!token) {
  console.error("ERROR: NOTION_API_TOKEN environment variable is required");
  process.exit(1);
}

const notion = new NotionClient(config, token);

const server = new McpServer({
  name: "lifeos-mcp",
  version: "0.1.0",
});

// Register all tools
registerDiscoverTool(server, config, notion);
registerQueryTool(server, config, notion);
registerActivityLogTool(server, config, notion);
registerTasksTool(server, config, notion);
registerProductivityTool(server, config, notion);
registerDailyBriefingTool(server, config, notion);
registerJournalingTools(server, config, notion);
registerStrategicTools(server, config, notion);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LifeOS MCP server running on stdio");
}

main().catch(console.error);
