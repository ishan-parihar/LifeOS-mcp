#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { NotionClient } from "./notion/client.js";
import { registerDiscoverTool } from "./tools/discover.js";
import { registerQueryTool } from "./tools/query.js";
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
import { registerDeleteEntryTool } from "./tools/delete-entry.js";
import { registerContextCardTool } from "./tools/context-card.js";
import { registerContentTool } from "./tools/content.js";
import { registerCampaignsTool } from "./tools/campaigns.js";
import { registerPlanningOpsTool } from "./tools/planning-ops.js";
import { registerPeopleOpsTool } from "./tools/people-ops.js";
import { registerFinanceOpsTool } from "./tools/finance-ops.js";
import { registerAlignmentTool } from "./tools/alignment.js";
import { registerProjectHealthTool } from "./tools/project-health.js";
import { registerOkrsProgressTool } from "./tools/okrs-progress.js";
import { registerJournalSynthesisTool } from "./tools/journal-synthesis.js";
import { registerHealthVitalityTool } from "./tools/health-vitality.js";
import { registerFinancialProductivityTool } from "./tools/financial-productivity.js";
import { registerWeeklyReviewTool } from "./tools/weekly-review.js";
import { registerCorrelateTool } from "./tools/correlate.js";
import { registerMonthlySynthesisTool } from "./tools/monthly-synthesis.js";
import { registerQuarterlyRetrospectiveTool } from "./tools/quarterly-retrospective.js";

const config = loadConfig();
const token = process.env.NOTION_API_TOKEN;
if (!token) {
  console.error("ERROR: NOTION_API_TOKEN environment variable is required");
  process.exit(1);
}

const notion = new NotionClient(config, token);

const server = new McpServer({
  name: "lifeos-mcp",
  version: "0.5.0",
});

// Layer 1: Data Access
registerDiscoverTool(server, config, notion);
registerQueryTool(server, config, notion);
registerTasksTool(server, config, notion);
registerJournalingTools(server, config, notion);
registerStrategicTools(server, config, notion);
registerContextCardTool(server, config, notion);
registerContentTool(server, config, notion);
registerCampaignsTool(server, config, notion);
registerPlanningOpsTool(server, config, notion);
registerPeopleOpsTool(server, config, notion);
registerFinanceOpsTool(server, config, notion);
registerAlignmentTool(server, config, notion);
registerProjectHealthTool(server, config, notion);
registerOkrsProgressTool(server, config, notion);
registerJournalSynthesisTool(server, config, notion);

// Layer 2: Synthesis
registerProductivityTool(server, config, notion);
registerDailyBriefingTool(server, config, notion);

// Layer 3: Temporal Analysis
registerTemporalAnalysisTool(server, config, notion);
registerTrajectoryTool(server, config, notion);
registerWeekdayPatternsTool(server, config, notion);

// Layer 3b: Domain-Specific Analysis
registerHealthVitalityTool(server, config, notion);
registerFinancialProductivityTool(server, config, notion);
registerWeeklyReviewTool(server, config, notion);
registerCorrelateTool(server, config, notion);

// Layer 4: Temporal Hierarchy (Monthly/Quarterly)
registerMonthlySynthesisTool(server, config, notion);
registerQuarterlyRetrospectiveTool(server, config, notion);

// Layer 4: Write Tools
registerCreateEntryTool(server, config, notion);
registerCreateReportTool(server, config, notion);

// Layer 5: Update & Delete Tools
registerFindEntryTool(server, config, notion);
registerUpdateEntryTool(server, config, notion);
registerDeleteEntryTool(server, config, notion);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LifeOS MCP server v0.5.0 running on stdio");
}

main().catch(console.error);
