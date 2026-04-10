import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import {
  transformProject,
  transformQuarterlyGoal,
  transformAnnualGoal,
  transformDirectiveRisk,
  transformOpportunityStrength,
  projectsToMarkdown,
  quarterlyGoalsToMarkdown,
  annualGoalsToMarkdown,
  directivesRisksToMarkdown,
  opportunitiesStrengthsToMarkdown,
} from "../transformers/strategic.js";

function registerStrategicTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient,
  dbKey: string,
  toolName: string,
  description: string,
  transformer: (page: any) => any,
  toMarkdown: (entries: any[]) => string
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
      const entries = result.results.map(transformer);
      const markdown = toMarkdown(entries);

      return {
        content: [{ type: "text" as const, text: markdown }],
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
    "Retrieve projects with status, health, progress, task/activity counts, and deadlines. Use with: lifeos_tasks (to see project tasks), lifeos_quarterly_goals (for OKR alignment).",
    transformProject,
    projectsToMarkdown
  );
  registerStrategicTool(
    server, config, notion, "quarterly_goals",
    "lifeos_quarterly_goals",
    "Retrieve quarterly OKRs with key results, progress tracking, and health status. Use with: lifeos_annual_goals (for alignment), lifeos_projects (for execution).",
    transformQuarterlyGoal,
    quarterlyGoalsToMarkdown
  );
  registerStrategicTool(
    server, config, notion, "annual_goals",
    "lifeos_annual_goals",
    "Retrieve annual goals with strategic intent, epic descriptions, and quarterly breakdowns. Use with: lifeos_quarterly_goals (for decomposition).",
    transformAnnualGoal,
    annualGoalsToMarkdown
  );
  registerStrategicTool(
    server, config, notion, "directives_risk_log",
    "lifeos_directives_risks",
    "Retrieve directives and risks with threat levels, likelihood, impact, and mitigation status. Use with: lifeos_projects (project risk context), lifeos_opportunities_strengths (risk/opportunity balance).",
    transformDirectiveRisk,
    directivesRisksToMarkdown
  );
  registerStrategicTool(
    server, config, notion, "opportunities_strengths",
    "lifeos_opportunities_strengths",
    "Retrieve opportunities and strengths with leverage scores and activation status. Use with: lifeos_projects (project leverage context), lifeos_directives_risks (risk/opportunity balance).",
    transformOpportunityStrength,
    opportunitiesStrengthsToMarkdown
  );
}
