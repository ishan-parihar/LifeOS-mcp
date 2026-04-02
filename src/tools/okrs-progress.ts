import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractNumber, extractRelationCount, extractString, extractTitle } from "../transformers/shared.js";

export function registerOkrsProgressTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_okrs_progress",
    "OKRs progress synthesis: KR rollups, health, blocked items, and project coverage map.",
    {
      quarter: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ quarter, status }) => {
      const qDb = getDbConfig(config, "quarterly_goals");
      const res = await notion.queryDataSource(qDb.data_source_id, {
        page_size: 100,
        ...(status ? { filter: { property: "Status", status: { equals: status } } } : {}),
      });
      const lines: string[] = [];
      lines.push(`# OKRs Progress — ${quarter || "current"}`);
      lines.push("");
      for (const g of res.results) {
        const name = extractTitle(g);
        const prog = extractNumber(g, "Progress");
        const health = extractString(g, "Health");
        const proj = extractRelationCount(g, "Projects");
        const blocked = proj === 0 ? " ⚠️ No projects linked" : "";
        lines.push(`## ${name}${blocked}`);
        if (health) lines.push(`- Health: ${health}`);
        if (prog !== null) lines.push(`- Progress: ${prog}%`);
        lines.push(`- Projects linked: ${proj}`);
        const kr1 = extractString(g, "Key Result 1");
        const kr2 = extractString(g, "Key Result 2");
        const kr3 = extractString(g, "Key Result 3");
        if (kr1) lines.push(`- KR1: ${kr1.substring(0, 120)}${kr1.length > 120 ? "..." : ""}`);
        if (kr2) lines.push(`- KR2: ${kr2.substring(0, 120)}${kr2.length > 120 ? "..." : ""}`);
        if (kr3) lines.push(`- KR3: ${kr3.substring(0, 120)}${kr3.length > 120 ? "..." : ""}`);
        lines.push("");
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
