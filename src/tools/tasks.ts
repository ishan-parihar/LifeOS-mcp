import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { transformTask, tasksToMarkdown } from "../transformers/tasks.js";

export function registerTasksTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_tasks",
    "Retrieve tasks with status, priority, overdue detection, and sprint filtering. Use with: lifeos_daily_briefing (for today's task context), lifeos_projects (for project-level grouping), lifeos_trajectory (to prioritize tasks based on activity target gaps).",
    {
      status: z
        .string()
        .optional()
        .describe("Filter by status: Active, Focus, Up Next, Waiting, Paused, Done, Cancelled, Archived, Delegated"),
      priority_min: z
        .string()
        .optional()
        .describe("Minimum priority filter (e.g., '⭐⭐⭐' or 'P1 - Critical')"),
      overdue_only: z
        .boolean()
        .optional()
        .describe("Show only overdue tasks"),
      search: z
        .string()
        .optional()
        .describe("Search task names and descriptions"),
      limit: z
        .number()
        .optional()
        .describe("Max tasks to return (default: 50)"),
    },
    async ({ status, priority_min, overdue_only, search, limit = 50 }) => {
      const db = getDbConfig(config, "tasks");
      const body: Record<string, unknown> = {
        page_size: Math.min(limit, 100),
        sorts: [{ property: "Action Date", direction: "ascending" }],
      };

      if (status) {
        body.filter = {
          property: "Status",
          status: { equals: status },
        };
      }

      const result = await notion.queryDataSource(db.data_source_id, body);

      let entries = result.results.map(transformTask);

      if (overdue_only) {
        entries = entries.filter((e) => e.isOverdue);
      }
      if (priority_min) {
        const starCount = (priority_min.match(/⭐/g) || []).length;
        entries = entries.filter((e) => {
          const eStars = (e.priority.match(/⭐/g) || []).length;
          return eStars >= starCount || e.priority.includes("P1") || e.priority.includes("P2");
        });
      }
      if (search) {
        const q = search.toLowerCase();
        entries = entries.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q)
        );
      }

      entries.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return 0;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: tasksToMarkdown(entries, "Tasks"),
          },
        ],
      };
    }
  );
}
