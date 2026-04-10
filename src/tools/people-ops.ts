import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractDate, extractNumber, extractString, extractTitle } from "../transformers/shared.js";
import { buildNotionProperties } from "./entry-helpers.js";

const ACTION = z.enum(["cadence_review", "queue_followups", "log_interaction"]);

export function registerPeopleOpsTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_people_ops",
    "People operations. Actions: 'cadence_review' (who needs reconnecting based on Last Connected Date vs Connection Frequency), 'follow_up_queue' (people overdue for contact), 'log_interaction' (create relational_journal entry, dry-run by default). Use with: lifeos_find_entry(people) to resolve person IDs, lifeos_relational_journal for interaction history.",
    {
      action: ACTION.describe("Action to perform"),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      min_gap_days: z.number().optional(),
      days_out: z.number().optional(),
      limit: z.number().optional(),
      person_search: z.string().optional(),
      person_id: z.string().optional(),
      note: z.string().optional(),
      date: z.string().optional(),
      dry_run: z.boolean().optional(),
    },
    async (args) => {
      const { action, limit = 50, dry_run = true } = args;
      if (action === "cadence_review") {
        const peopleDb = getDbConfig(config, "people");
        const res = await notion.queryDataSource(peopleDb.data_source_id, { page_size: Math.min(limit, 100) });
        // Compute days since last connection and overdue vs frequency
        const entries = res.results.map((p) => {
          const name = extractTitle(p);
          const pid = p.id;
          const last = extractDate(p, "Last Connected Date");
          const freq = Number(extractNumber(p, "In days Connection Frequency") || 0);
          const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : 999;
          const overdueBy = freq > 0 ? daysSince - freq : 0;
          return { pid, name, last, freq, daysSince, overdueBy };
        });
        const overdue = entries.filter((e) => e.freq > 0 && e.overdueBy > 0).sort((a, b) => b.overdueBy - a.overdueBy);
        const lines: string[] = [];
        lines.push(`# Cadence Review — Overdue Contacts (${overdue.length})`);
        lines.push("");
        for (const e of overdue.slice(0, limit)) {
          lines.push(`- ${e.name} — overdue by ${e.overdueBy}d (last: ${e.last || "never"}, freq: ${e.freq}d)`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "log_interaction") {
        const personId = args.person_id;
        if (!personId && !args.person_search) throw new Error("log_interaction requires person_id or person_search");
        // For simplicity, require person_id for write; search-based resolution can be added later
        const date = args.date || new Date().toISOString().slice(0, 10);
        const note = args.note || "Interaction logged via people_ops";
        const dry = args.dry_run !== false; // default true
        const lines: string[] = [];
        lines.push(`# Log Interaction — ${dry ? "dry_run" : "apply"}`);
        lines.push("");
        if (!personId) {
          lines.push("- person_search provided but person_id not resolved — skipping write.");
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }
        if (dry) {
          lines.push(`Would create relational_journal on ${date} with note: ${note}`);
          lines.push(`Would update person's Last Connected Date to ${date}`);
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }
        // Create relational_journal entry
        const relDb = getDbConfig(config, "relational_journal");
        const props = buildNotionProperties("relational_journal", `Interaction — ${date}`, {
          date,
          people: [personId],
          description: note,
        });
        await notion.createPage({ parent: { data_source_id: relDb.data_source_id }, properties: props.properties } as any);
        // Update person last_connected_date
        await notion.updatePage(personId, { ["Last Connected Date"]: { date: { start: date } } as any });
        lines.push("Created relational_journal entry and updated Last Connected Date.");
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "queue_followups") {
        const peopleDb = getDbConfig(config, "people");
        const res = await notion.queryDataSource(peopleDb.data_source_id, { page_size: Math.min(args.limit ?? 50, 100) });
        const daysOut = args.days_out ?? 7;
        const targetDate = new Date(Date.now() + daysOut * 86400000).toISOString().slice(0, 10);
        const dry = args.dry_run !== false; // default true
        const overdue = res.results.map((p) => {
          const name = extractTitle(p);
          const pid = p.id;
          const last = extractDate(p, "Last Connected Date");
          const freq = Number(extractNumber(p, "In days Connection Frequency") || 0);
          const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : 999;
          const overdueBy = freq > 0 ? daysSince - freq : 0;
          return { pid, name, last, freq, daysSince, overdueBy };
        }).filter(e => e.freq > 0 && e.overdueBy > 0).sort((a, b) => b.overdueBy - a.overdueBy);

        const lines: string[] = [];
        lines.push(`# Follow-ups — ${dry ? "Draft" : "Applied"} (due ${targetDate})`);
        lines.push("");
        if (overdue.length === 0) {
          lines.push("No overdue contacts found.");
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }
        if (dry) {
          for (const e of overdue.slice(0, 20)) {
            lines.push(`- Follow up with ${e.name} — schedule by ${targetDate}`);
          }
          lines.push("");
          lines.push("> dry_run=true — suggestions only. Set dry_run=false to create tasks.");
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }
        // Create tasks for top overdue contacts
        const tasksDb = getDbConfig(config, "tasks");
        const tasksHasPeople = Object.values(tasksDb.properties).some((v) => v === "People");
        for (const e of overdue.slice(0, 20)) {
          const props = buildNotionProperties("tasks", `Follow up with ${e.name}`, {
            status: "Active",
            action_date: targetDate,
            description: `Auto-queued follow-up. Last connected: ${e.last || "never"}. Freq: ${e.freq}d.`,
            ...(tasksHasPeople ? { people: [e.pid] } : {}),
          });
          await notion.createPage({ parent: { data_source_id: tasksDb.data_source_id }, properties: props.properties } as any);
        }
        lines.push(`Created ${Math.min(20, overdue.length)} follow-up task(s).`);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      return { content: [{ type: "text" as const, text: `Unknown action: ${action}` }] };
    }
  );
}
