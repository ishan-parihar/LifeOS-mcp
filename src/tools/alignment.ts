import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractRelationCount, extractString, extractTitle } from "../transformers/shared.js";
import { PERIOD_PARAM } from "../transformers/dates.js";

const ACTION = z.enum(["okr_campaign_coverage", "project_people_stakeholders", "project_activity_targets"]);

export function registerAlignmentTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_alignment",
    "Cross-domain alignment reports for CEO/COO/CMO. Actions: okr_campaign_coverage (OKR to campaign mapping), project_people_stakeholders (stakeholder analysis), project_activity_targets (activity vs target gaps). Use with: lifeos_okrs_progress (for OKR details), lifeos_project_health (for project status), lifeos_productivity_report (for activity context).",
    {
      action: ACTION.describe("Action to perform"),
      quarter: z.string().optional().describe("Quarter label or date range key"),
      project_search: z.string().optional(),
      project_id: z.string().optional(),
      period: PERIOD_PARAM,
    },
    async (args) => {
      if (args.action === "okr_campaign_coverage") {
        const qDb = getDbConfig(config, "quarterly_goals");
        const goals = await notion.queryDataSource(qDb.data_source_id, { page_size: 100 });
        const lines: string[] = [];
        lines.push(`# OKR ↔ Campaign Coverage`);
        lines.push("");
        for (const g of goals.results) {
          const gName = extractTitle(g);
          const projCount = extractRelationCount(g, "Projects");
          lines.push(`## ${gName}`);
          lines.push(`- Projects: ${projCount}`);
          if (projCount === 0) {
            lines.push("");
            continue;
          }
          // Fetch projects linked to this goal (fallback: list all active projects)
          const pDb = getDbConfig(config, "projects");
          const projects = await notion.queryDataSource(pDb.data_source_id, { page_size: 100 });
          const linked = projects.results; // In a later version, filter by relation
          const items: string[] = [];
          for (const p of linked.slice(0, 10)) {
            const name = extractTitle(p);
            const camp = extractRelationCount(p, "Campaign Calendar");
            items.push(`- ${name} — Campaigns(${camp})`);
          }
          lines.push(...items);
          lines.push("");
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (args.action === "project_people_stakeholders") {
        const pDb = getDbConfig(config, "projects");
        const projects = await notion.queryDataSource(pDb.data_source_id, { page_size: 50 });
        const lines: string[] = [];
        lines.push(`# Project Stakeholders`);
        lines.push("");
        for (const p of projects.results.slice(0, 10)) {
          const name = extractTitle(p);
          const pc = extractRelationCount(p, "People");
          lines.push(`- ${name}: People(${pc})`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (args.action === "project_activity_targets") {
        let projectId = args.project_id || "";
        // Resolve by search if not provided
        if (!projectId && args.project_search) {
          const pDb = getDbConfig(config, "projects");
          const res = await notion.queryDataSource(pDb.data_source_id, { page_size: 100 });
          const matches = res.results.filter(p => extractTitle(p).toLowerCase().includes(args.project_search!.toLowerCase()));
          if (matches.length === 0) return { content: [{ type: "text" as const, text: `No project matched '${args.project_search}'.` }] };
          if (matches.length > 1) return { content: [{ type: "text" as const, text: `Multiple projects matched '${args.project_search}'. Please refine search or pass project_id.` }] };
          projectId = matches[0].id;
        }
        if (!projectId) return { content: [{ type: "text" as const, text: "project_id or project_search is required" }] };
        const actDb = getDbConfig(config, "activity_log");
        const atDb = getDbConfig(config, "activity_types");
        const act = await notion.queryDataSource(actDb.data_source_id, {
          page_size: 100,
          filter: { property: "Projects", relation: { contains: projectId } as any },
          sorts: [{ property: "Date", direction: "descending" }],
        });
        const targetsRes = await notion.queryDataSource(atDb.data_source_id, { page_size: 100 });
        // Sum hours by Activity Type
        const totals = new Map<string, number>();
        for (const p of act.results) {
          const type = extractString(p, "Activity Type") || "Uncategorized";
          const f = (p.properties["Duration"] as any)?.formula;
          const dur = f?.type === "number" ? (f.number || 0) : 0;
          totals.set(type, (totals.get(type) || 0) + dur);
        }
        const targets = new Map<string, { hours: number }>();
        for (const page of targetsRes.results) {
          const name = extractTitle(page);
          const dur = (page.properties["Duration (in hrs)"] as any)?.number ?? 0;
          targets.set(name, { hours: dur });
        }
        const lines: string[] = [];
        lines.push(`# Project Activity Targets — ${projectId}`);
        lines.push("");
        if (act.results.length === 0) lines.push("No linked activities.");
        for (const [k, v] of [...totals.entries()].sort((a, b) => b[1] - a[1])) {
          const t = targets.get(k)?.hours ?? 0;
          lines.push(`- ${k}: actual ${v.toFixed(1)}h vs target ${t}h/day`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      return { content: [{ type: "text" as const, text: `Unknown action: ${args.action}` }] };
    }
  );
}
