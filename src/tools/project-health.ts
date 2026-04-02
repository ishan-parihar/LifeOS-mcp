import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractDate, extractRelationCount, extractString, extractTitle } from "../transformers/shared.js";

export function registerProjectHealthTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_project_health",
    "Project health synthesis: overdue tasks, risks/opps presence, progress hint, and deadline proximity.",
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
      const lines: string[] = [];
      lines.push(`# Project Health — ${res.results.length} project(s)`);
      lines.push("");
      for (const p of res.results) {
        const name = extractTitle(p);
        const prog = extractString(p, "Progress");
        const deadline = extractDate(p, "Deadline");
        const people = extractRelationCount(p, "People");
        const risks = extractRelationCount(p, "Directives & Risk Log");
        const opps = extractRelationCount(p, "Opportunities & Strengths Log");
        const urgency = deadline ? Math.floor((new Date(deadline).getTime() - Date.now()) / 86400000) : null;
        const badges: string[] = [];
        if (urgency !== null && urgency < 7) badges.push(urgency < 0 ? `⚠️ ${Math.abs(urgency)}d overdue` : `⚠️ ${urgency}d left`);
        if (risks > 0) badges.push(`🔥 Risks(${risks})`);
        if (opps > 0) badges.push(`💡 Opps(${opps})`);
        lines.push(`## ${name}${badges.length ? " — " + badges.join("  ") : ""}`);
        if (prog) lines.push(`- Progress: ${prog}%`);
        if (deadline) lines.push(`- Deadline: ${deadline.split("T")[0]}`);
        if (people > 0) lines.push(`- People: ${people}`);
        lines.push("");
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
