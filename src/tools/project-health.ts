import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractDate, extractRelationCount, extractRelationIds, extractString, extractTitle } from "../transformers/shared.js";

export function registerProjectHealthTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_project_health",
    "Project health synthesis: overdue tasks, risks/opps presence, progress hint, and deadline proximity. Fetches actual risk and opportunity content (name, status, likelihood, impact, threat level, leverage score). Use with: lifeos_okrs_progress (for OKR alignment), lifeos_alignment (for stakeholder mapping), lifeos_tasks (for project task details).",
    {
      project_search: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ project_search, status, limit = 30 }) => {
      const pDb = getDbConfig(config, "projects");
      const res = await notion.queryDataSource(pDb.data_source_id, {
        page_size: Math.min(limit, 100),
        ...(status
          ? { filter: { property: "Status", status: { equals: status } } }
          : {}),
      });

      const riskDb = getDbConfig(config, "directives_risk_log");
      const oppDb = getDbConfig(config, "opportunities_strengths");

      const lines: string[] = [];
      lines.push(`# Project Health — ${res.results.length} project(s)`);
      lines.push("");

      for (const p of res.results) {
        const name = extractTitle(p);
        const prog = extractString(p, "Progress");
        const deadline = extractDate(p, "Deadline");
        const people = extractRelationCount(p, "People");
        const riskIds = extractRelationIds(p, "Directives & Risk Log");
        const oppIds = extractRelationIds(p, "Opportunities & Strengths Log");
        const urgency = deadline ? Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000) : null;

        lines.push(`## ${name}`);
        if (prog) lines.push(`- Progress: ${prog}%`);
        if (deadline) lines.push(`- Deadline: ${deadline.split("T")[0]}${urgency !== null ? ` (${urgency >= 0 ? urgency + "d left" : Math.abs(urgency) + "d overdue"})` : ""}`);
        if (people > 0) lines.push(`- People: ${people}`);
        lines.push("");

        // Fetch and show actual risk content
        if (riskIds.length > 0) {
          lines.push(`### Risks (${riskIds.length})`);
          for (const id of riskIds) {
            try {
              const riskRes = await notion.queryDataSource(riskDb.data_source_id, {
                page_size: 1,
                filter: { property: "id", rich_text: { equals: id } },
              });
              if (riskRes.results.length > 0) {
                const r = riskRes.results[0];
                const rName = extractTitle(r);
                const rStatus = extractString(r, "Status");
                const rLikelihood = extractString(r, "Likelihood");
                const rImpact = extractString(r, "Impact");
                const rThreat = extractString(r, "Threat Level");
                let line = `- **${rName}**`;
                const parts = [rStatus, rLikelihood, rImpact, rThreat].filter(Boolean);
                if (parts.length > 0) line += ` [${parts.join(" | ")}]`;
                lines.push(line);
              }
            } catch {
              // Skip if individual fetch fails
            }
          }
          lines.push("");
        }

        // Fetch and show actual opportunity content
        if (oppIds.length > 0) {
          lines.push(`### Opportunities (${oppIds.length})`);
          for (const id of oppIds) {
            try {
              const oppRes = await notion.queryDataSource(oppDb.data_source_id, {
                page_size: 1,
                filter: { property: "id", rich_text: { equals: id } },
              });
              if (oppRes.results.length > 0) {
                const o = oppRes.results[0];
                const oName = extractTitle(o);
                const oStatus = extractString(o, "Status");
                const oLeverage = extractString(o, "Leverage Score");
                let line = `- **${oName}**`;
                const parts = [oStatus, oLeverage].filter(Boolean);
                if (parts.length > 0) line += ` [${parts.join(" | ")}]`;
                lines.push(line);
              }
            } catch {
              // Skip if individual fetch fails
            }
          }
          lines.push("");
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
