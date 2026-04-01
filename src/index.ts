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
import { registerCreateEntryTool } from "./tools/create-entry.js";
import { registerCreateReportTool } from "./tools/create-report.js";
import { registerTemporalAnalysisTool } from "./tools/temporal-analysis.js";
import { registerTrajectoryTool } from "./tools/trajectory.js";
import { registerWeekdayPatternsTool } from "./tools/weekday-patterns.js";
import { registerFindEntryTool } from "./tools/find-entry.js";
import { registerUpdateEntryTool } from "./tools/update-entry.js";
import { registerArchiveEntryTool } from "./tools/archive-entry.js";

const config = loadConfig();
const token = process.env.NOTION_API_TOKEN;
if (!token) {
  console.error("ERROR: NOTION_API_TOKEN environment variable is required");
  process.exit(1);
}

const notion = new NotionClient(config, token);

const server = new McpServer({
  name: "lifeos-mcp",
  version: "0.4.0",
});

// Layer 1: Data Access
registerDiscoverTool(server, config, notion);
registerQueryTool(server, config, notion);
registerActivityLogTool(server, config, notion);
registerTasksTool(server, config, notion);
registerJournalingTools(server, config, notion);
registerStrategicTools(server, config, notion);

// Layer 2: Synthesis
registerProductivityTool(server, config, notion);
registerDailyBriefingTool(server, config, notion);

// Layer 3: Temporal Analysis
registerTemporalAnalysisTool(server, config, notion);
registerTrajectoryTool(server, config, notion);
registerWeekdayPatternsTool(server, config, notion);

// Layer 4: Write Tools
registerCreateEntryTool(server, config, notion);
registerCreateReportTool(server, config, notion);

// Layer 5: Update & Archive Tools
registerFindEntryTool(server, config, notion);
registerUpdateEntryTool(server, config, notion);
registerArchiveEntryTool(server, config, notion);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LifeOS MCP server v0.4.0 running on stdio");
}

main().catch(console.error);
