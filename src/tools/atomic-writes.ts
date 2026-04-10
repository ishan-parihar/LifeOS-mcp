import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { markdownToNotionChildren } from "../transformers/notion-blocks.js";

const JOURNAL_TYPE = z.enum(["subjective", "relational", "systemic", "diet", "financial"]);

export function registerLogActivityTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_log_activity",
    "Log a single activity entry. Creates an Activity Log entry with date range and activity type. Duration is auto-calculated by Notion formula. Use for tracking time spent on work, workouts, study, chores, sleep, recreation, or socializing.",
    {
      name: z.string().describe("Activity name (e.g., 'Deep Work - Coding', 'Morning Workout')"),
      date: z.string().describe("Date in YYYY-MM-DD format"),
      start_time: z.string().describe("Start time as HH:MM or full ISO datetime (YYYY-MM-DDTHH:MM)"),
      end_time: z.string().describe("End time as HH:MM or full ISO datetime (YYYY-MM-DDTHH:MM)"),
      activity_type: z.string().describe("Activity category (Work, Workout, Study, Chores, Sleep, Recreation, Socialize)"),
      activity_notes: z.string().optional().describe("Optional notes about the activity"),
      project_ids: z.array(z.string()).optional().describe("Array of project page IDs to link"),
    },
    async ({ name, date, start_time, end_time, activity_type, activity_notes, project_ids }) => {
      const db = getDbConfig(config, "activity_log");
      const notionProps: Record<string, unknown> = {
        "Name": { title: [{ text: { content: name } }] },
        "Date": {
          date: {
            start: start_time.includes("T") ? start_time : `${date}T${start_time}:00+05:30`,
            end: end_time.includes("T") ? end_time : `${date}T${end_time}:00+05:30`,
          },
        },
        "Activity Type": { select: { name: activity_type } },
      };
      if (activity_notes) notionProps["Activity Notes"] = { rich_text: [{ type: "text", text: { content: activity_notes } }] };
      if (project_ids && project_ids.length > 0) notionProps["Projects"] = { relation: project_ids.map(id => ({ id })) };

      const body: Record<string, unknown> = {
        parent: { data_source_id: db.data_source_id },
        properties: notionProps,
      };

      const result = await notion.createPage(body as any);

      return {
        content: [{ type: "text" as const, text: [
          `## Activity Logged: ${name}`,
          `- **Date:** ${date} | **Time:** ${start_time} → ${end_time}`,
          `- **Type:** ${activity_type}`,
          `- **Page ID:** ${result.id}`,
          result.url ? `- **URL:** ${result.url}` : "",
          "",
        ].filter(Boolean).join("\n") }],
      };
    }
  );
}

export function registerCompleteTaskTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_complete_task",
    "Mark a task as Done by name. Searches the Tasks database for a matching task and updates its status to 'Done'. Returns the task details. Use when finishing work — faster than find_entry + update_entry.",
    {
      search: z.string().describe("Task name to search for (partial match). Pick the most relevant match."),
      limit: z.number().optional().default(5).describe("Max matches to return for user confirmation (default: 5)"),
    },
    async ({ search, limit }) => {
      const db = getDbConfig(config, "tasks");
      const titleField = "Tasks";

      const result = await notion.queryDataSource(db.data_source_id, {
        page_size: Math.min(limit, 100),
        filter: { property: titleField, title: { contains: search } },
        sorts: [{ property: "Action Date", direction: "ascending" }],
      });

      if (result.results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No tasks found matching "${search}". Try a different search term.` }],
        };
      }

      const lines: string[] = [];
      lines.push(`## Found ${result.results.length} tasks matching "${search}"`);
      lines.push("");

      for (const page of result.results) {
        const title = (page.properties[titleField] as any)?.title?.map((t: any) => t.plain_text).join("") || "Untitled";
        const status = (page.properties["Status"] as any)?.status?.name || "Unknown";
        const id = (page.properties["ID"] as any)?.unique_id
          ? `${(page.properties["ID"] as any).unique_id.prefix}-${(page.properties["ID"] as any).unique_id.number}`
          : "";

        if (status === "Done") {
          lines.push(`### ${title} (${id}) — already Done ✓`);
          lines.push("");
          continue;
        }

        await notion.updatePage(page.id, {
          "Status": { status: { name: "Done" } },
        });

        lines.push(`### ${title} (${id}) → marked Done ✓`);
        lines.push(`- **Page ID:** ${page.id}`);
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

export function registerLogTransactionTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_log_transaction",
    "Log a financial transaction. Creates a Financial Log entry with amount, category, and capital engine. Simplified interface — no schema lookup needed.",
    {
      name: z.string().describe("Transaction name (e.g., 'Client Payment - Acme', 'Lunch')"),
      date: z.string().describe("Date in YYYY-MM-DD format"),
      amount: z.number().describe("Transaction amount (positive for income, negative for expenses, or use transaction_type)"),
      transaction_type: z.enum(["income", "expense"]).describe("Whether this is income or expense"),
      category: z.string().describe("Category (e.g., 'Business Revenue', 'Food & Dining', 'Client Payment', 'Investment Income', 'Rent/Mortgage')"),
      capital_engine: z.enum(["E", "S", "B", "I", "Personal"]).optional().describe("Cashflow quadrant: E (Employment), S (Self-employment), B (Business), I (Investment), Personal"),
      notes: z.string().optional().describe("Optional notes"),
      project_ids: z.array(z.string()).optional().describe("Array of project page IDs to link"),
    },
    async ({ name, date, amount, transaction_type, category, capital_engine, notes, project_ids }) => {
      const db = getDbConfig(config, "financial_log");
      const adjustedAmount = transaction_type === "expense" ? -Math.abs(amount) : Math.abs(amount);

      const notionProps: Record<string, unknown> = {
        "Name": { title: [{ text: { content: name } }] },
        "Date": { date: { start: date } },
        "Amount": { number: adjustedAmount },
        "Category": { select: { name: category } },
        "Transaction Type": { select: { name: transaction_type === "income" ? "Income" : "Expense" } },
      };
      if (capital_engine) notionProps["Capital Engine"] = { select: { name: capital_engine } };
      if (notes) notionProps["Notes"] = { rich_text: [{ type: "text", text: { content: notes } }] };
      if (project_ids && project_ids.length > 0) notionProps["Projects"] = { relation: project_ids.map(id => ({ id })) };

      const body: Record<string, unknown> = {
        parent: { data_source_id: db.data_source_id },
        properties: notionProps,
      };

      const result = await notion.createPage(body as any);

      return {
        content: [{ type: "text" as const, text: [
          `## Transaction Logged: ${name}`,
          `- **Amount:** ${Math.abs(adjustedAmount)} (${transaction_type})`,
          `- **Category:** ${category}`,
          `- **Date:** ${date}`,
          `- **Page ID:** ${result.id}`,
          result.url ? `- **URL:** ${result.url}` : "",
          "",
        ].filter(Boolean).join("\n") }],
      };
    }
  );
}

export function registerJournalEntryTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_journal_entry",
    "Create a journal entry in any journal type. Supports subjective (emotions/internal), relational (people/interactions), and systemic (patterns/insights) journals. Accepts full markdown content as page body.",
    {
      journal_type: JOURNAL_TYPE.describe("Which journal to write to: subjective (internal state), relational (people interactions), systemic (patterns/insights), diet (nutrition), financial (transactions — use lifeos_log_transaction for simpler entries)"),
      title: z.string().optional().describe("Entry title (auto-generated from date if omitted)"),
      date: z.string().describe("Date in YYYY-MM-DD format or ISO datetime"),
      content: z.string().describe("Journal content in markdown. Stored as page body."),
      project_ids: z.array(z.string()).optional().describe("Array of project page IDs to link (for systemic journal)"),
    },
    async ({ journal_type, title, date, content, project_ids }) => {
      const dbMap: Record<string, string> = {
        subjective: "subjective_journal",
        relational: "relational_journal",
        systemic: "systemic_journal",
        diet: "diet_log",
        financial: "financial_log",
      };

      const dbKey = dbMap[journal_type];
      const db = getDbConfig(config, dbKey);
      const entryTitle = title || `${journal_type} — ${date}`;

      const contentFields: Record<string, string> = {
        subjective: "Psychograph",
        relational: "Summary",
        systemic: "AI Generated Report",
        diet: "Nutrition",
        financial: "Notes",
      };

      const notionProps: Record<string, unknown> = {
        "Name": { title: [{ text: { content: entryTitle } }] },
        "Date": { date: { start: date.includes("T") ? date : `${date}T00:00:00+05:30` } },
        [contentFields[journal_type]]: { rich_text: [{ type: "text", text: { content } }] },
      };

      if (journal_type === "systemic" && project_ids && project_ids.length > 0) {
        notionProps["Projects"] = { relation: project_ids.map(id => ({ id })) };
      }

      const children = markdownToNotionChildren(content);
      const body: Record<string, unknown> = {
        parent: { data_source_id: db.data_source_id },
        properties: notionProps,
      };
      if (children.length > 0) {
        body.children = children;
      }

      const result = await notion.createPage(body as any);

      return {
        content: [{ type: "text" as const, text: [
          `## Journal Entry Created: ${entryTitle}`,
          `- **Journal:** ${db.name}`,
          `- **Date:** ${date}`,
          `- **Content:** ${content.length} chars → ${children.length} blocks`,
          `- **Page ID:** ${result.id}`,
          result.url ? `- **URL:** ${result.url}` : "",
          "",
        ].filter(Boolean).join("\n") }],
      };
    }
  );
}
