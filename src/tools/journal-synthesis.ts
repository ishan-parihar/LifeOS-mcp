import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractDate, extractString, extractTitle } from "../transformers/shared.js";
import { resolveDates, PERIOD_PARAM } from "../transformers/dates.js";

const SOURCES = z.array(z.enum(["subjective", "relational", "systemic"]));

interface JournalEntry {
  src: string;
  date: string;
  title: string;
  content: string;
}

export function registerJournalSynthesisTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_journal_synthesis",
    "Journal synthesis: analyzes actual journal content (psychograph, relational notes, systemic notes) across all journal types. Returns keyword frequency table, cross-journal theme overlap, and recent entries with content snippets. Use with: lifeos_subjective_journal (raw subjective entries), lifeos_relational_journal (relationship context), lifeos_correlate (mood correlation with other domains).",
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

      // Content field mapping per journal type
      const contentFields: Record<string, string[]> = {
        subjective: ["Psychograph"],
        relational: ["Summary", "Strategic Context"],
        systemic: ["AI Generated Report", "Impact"],
      };

      const wordCounts = new Map<string, { total: number; bySource: Map<string, number> }>();
      const entries: JournalEntry[] = [];
      const themeOverlap = new Map<string, Set<string>>(); // theme -> set of sources

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

          // Extract actual content from relevant fields
          const fields = contentFields[s] || [];
          const contentParts: string[] = [];
          for (const field of fields) {
            const value = extractString(p, field);
            if (value) contentParts.push(value);
          }
          const content = contentParts.join(" ");

          entries.push({ src: s, date, title, content });

          // Keyword extraction from both title AND content
          const fullText = `${title} ${content}`.toLowerCase();
          const tokens = fullText.split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOP_WORDS.has(t));

          for (const t of tokens) {
            if (!wordCounts.has(t)) {
              wordCounts.set(t, { total: 0, bySource: new Map() });
            }
            const entry = wordCounts.get(t)!;
            entry.total++;
            entry.bySource.set(s, (entry.bySource.get(s) || 0) + 1);
          }
        }
      }

      // Compute theme overlap (themes appearing in multiple sources)
      const overlappingThemes: Array<{ theme: string; sources: string[]; total: number }> = [];
      for (const [word, data] of wordCounts) {
        if (data.bySource.size >= 2) {
          overlappingThemes.push({
            theme: word,
            sources: [...data.bySource.keys()],
            total: data.total,
          });
        }
      }
      overlappingThemes.sort((a, b) => b.total - a.total);

      // Top keywords overall
      const topWords = [...wordCounts.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);

      // Top keywords per source
      const topBySource = new Map<string, Array<{ word: string; count: number }>>();
      for (const s of sources) {
        const sourceWords = [...wordCounts.entries()]
          .map(([word, data]) => ({ word, count: data.bySource.get(s) || 0 }))
          .filter(x => x.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        topBySource.set(s, sourceWords);
      }

      const lines: string[] = [];
      lines.push(`# Journal Synthesis — ${rangeLabel}`);
      lines.push("");
      lines.push(`**Entries analyzed:** ${entries.length} across ${sources.length} source(s)`);
      lines.push("");

      // Top keywords table
      lines.push("## Top Keywords (All Sources)");
      lines.push("");
      lines.push("| Keyword | Total | " + sources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" | ") + " |");
      lines.push("|---------|-------|" + sources.map(() => "-------|").join(""));

      for (const [word, data] of topWords) {
        const counts = sources.map(s => data.bySource.get(s) || 0).join(" | ");
        lines.push(`| ${word} | ${data.total} | ${counts} |`);
      }
      lines.push("");

      // Cross-journal theme overlap
      if (overlappingThemes.length > 0) {
        lines.push("## Cross-Journal Themes");
        lines.push("");
        lines.push("Themes appearing in multiple journal types (potential systemic patterns):");
        lines.push("");
        lines.push("| Theme | Sources | Total |");
        lines.push("|-------|---------|-------|");
        for (const t of overlappingThemes.slice(0, 10)) {
          const sourceNames = t.sources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
          lines.push(`| ${t.theme} | ${sourceNames} | ${t.total} |`);
        }
        lines.push("");
      }

      // Per-source top keywords
      for (const s of sources) {
        const words = topBySource.get(s);
        if (words && words.length > 0) {
          lines.push(`## Top Keywords — ${s.charAt(0).toUpperCase() + s.slice(1)}`);
          lines.push("");
          for (const w of words.slice(0, 8)) {
            lines.push(`- ${w.word}: ${w.count}`);
          }
          lines.push("");
        }
      }

      // Recent entries with content snippets
      lines.push("## Recent Entries");
      lines.push("");
      for (const e of entries.slice(0, 15)) {
        const dateStr = e.date ? e.date.split("T")[0] : "No date";
        const snippet = e.content ? e.content.substring(0, 100) + (e.content.length > 100 ? "..." : "") : e.title.substring(0, 120);
        lines.push(`- **[${dateStr}]** (${e.src}) ${snippet}`);
      }
      lines.push("");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}

const STOP_WORDS = new Set([
  "with", "from", "that", "this", "have", "been", "were", "they", "their",
  "what", "when", "where", "which", "while", "would", "could", "should",
  "about", "after", "before", "between", "through", "during", "without",
  "there", "these", "those", "other", "each", "more", "some", "such",
  "only", "over", "into", "than", "then", "them", "also", "just",
]);
