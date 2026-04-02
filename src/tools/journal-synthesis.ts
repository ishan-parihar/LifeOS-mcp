import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractDate, extractString, extractTitle } from "../transformers/shared.js";
import { resolveDates, PERIOD_PARAM } from "../transformers/dates.js";

const SOURCES = z.array(z.enum(["subjective", "relational", "systemic"]));

export function registerJournalSynthesisTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_journal_synthesis",
    "Journal synthesis: consolidate themes across journals with simple keyword counts; designed to feed interventions.",
    {
      period: PERIOD_PARAM,
      sources: SOURCES.optional(),
      limit: z.number().optional(),
    },
    async ({ period, sources = ["subjective", "relational", "systemic"], limit = 50 }) => {
      const { date_from, date_to, rangeLabel } = resolveDates(period);
      const mapKeyToDb: Record<string, string> = {
        subjective: "subjective_journal",
        relational: "relational_journal",
        systemic: "systemic_journal",
      };
      const wordCounts = new Map<string, number>();
      const entries: Array<{ src: string; date: string; title: string }> = [];
      for (const s of sources) {
        const key = mapKeyToDb[s];
        const db = getDbConfig(config, key);
        const res = await notion.queryDataSource(db.data_source_id, {
          page_size: Math.min(limit, 100),
          filter: {
            and: [
              { property: "Date", date: { on_or_after: `${date_from}T00:00:00Z` } },
              { property: "Date", date: { on_or_before: `${date_to}T23:59:59Z` } },
            ],
          },
          sorts: [{ property: "Date", direction: "descending" }],
        });
        for (const p of res.results) {
          const title = extractTitle(p);
          const date = extractDate(p, "Date");
          entries.push({ src: s, date, title });
          // naive keyword extraction from title
          const tokens = title.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !["with", "from", "that", "this"].includes(t));
          for (const t of tokens) wordCounts.set(t, (wordCounts.get(t) || 0) + 1);
        }
      }
      const top = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
      const lines: string[] = [];
      lines.push(`# Journal Synthesis — ${rangeLabel}`);
      lines.push("");
      lines.push("## Top Keywords");
      lines.push("");
      for (const [w, c] of top) lines.push(`- ${w}: ${c}`);
      lines.push("");
      lines.push("## Recent Entries");
      lines.push("");
      for (const e of entries.slice(0, 15)) lines.push(`- [${e.date.split("T")[0]}] (${e.src}) ${e.title.substring(0, 120)}${e.title.length > 120 ? "..." : ""}`);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
