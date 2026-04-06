import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractDate, extractNumber, extractRelationCount } from "../transformers/shared.js";
import { transformActivity } from "../transformers/activity.js";
import { transformTask } from "../transformers/tasks.js";

export function registerQuarterlyRetrospectiveTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_quarterly_retrospective",
    "Quarterly strategic retrospective: OKR results, project outcomes, financial summary, risk evolution, and strategic reflections. Covers full quarter with year trajectory context. Use with: lifeos_okrs_progress (detailed OKR data), lifeos_monthly_synthesis (month-level breakdown), lifeos_alignment (cross-domain alignment).",
    {
      quarter: z.string().optional().describe("Quarter to review (Q1, Q2, Q3, Q4 or YYYY-Q#). Defaults to current quarter."),
      year: z.string().optional().describe("Year (YYYY). Defaults to current year."),
    },
    async ({ quarter, year }) => {
      const now = new Date();
      const targetYear = year ? parseInt(year) : now.getFullYear();
      const targetQuarter = quarter || `Q${Math.floor(now.getMonth() / 3) + 1}`;
      const quarterNum = parseInt(targetQuarter.replace("Q", ""));

      // Calculate quarter boundaries
      const quarterStartMonth = (quarterNum - 1) * 3;
      const quarterStart = `${targetYear}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`;
      const quarterEndMonth = quarterStartMonth + 2;
      const lastDay = new Date(targetYear, quarterEndMonth + 1, 0).getDate();
      const quarterEnd = `${targetYear}-${String(quarterEndMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const lines: string[] = [];
      lines.push(`# Quarterly Retrospective — ${targetQuarter} ${targetYear}`);
      lines.push(`> Period: ${quarterStart} → ${quarterEnd}`);
      lines.push("");

      // Fetch all data
      const qDb = getDbConfig(config, "quarterly_goals");
      const qResult = await notion.queryDataSource(qDb.data_source_id, { page_size: 20 });

      const annualDb = getDbConfig(config, "annual_goals");
      const annualResult = await notion.queryDataSource(annualDb.data_source_id, { page_size: 10 });

      const projDb = getDbConfig(config, "projects");
      const projResult = await notion.queryDataSource(projDb.data_source_id, { page_size: 50 });

      const actDb = getDbConfig(config, "activity_log");
      const actResult = await notion.queryDataSource(actDb.data_source_id, {
        page_size: 500,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: quarterStart } },
            { property: "Date", date: { on_or_before: `${quarterEnd}T23:59:59Z` } },
          ],
        },
      });
      const activities = actResult.results.map(transformActivity);

      const finDb = getDbConfig(config, "financial_log");
      const finResult = await notion.queryDataSource(finDb.data_source_id, {
        page_size: 500,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: quarterStart } },
            { property: "Date", date: { on_or_before: `${quarterEnd}T23:59:59Z` } },
          ],
        },
      });

      const taskDb = getDbConfig(config, "tasks");
      const taskResult = await notion.queryDataSource(taskDb.data_source_id, { page_size: 500 });
      const tasks = taskResult.results.map(transformTask);

      const riskDb = getDbConfig(config, "directives_risk_log");
      const riskResult = await notion.queryDataSource(riskDb.data_source_id, { page_size: 50 });

      const oppDb = getDbConfig(config, "opportunities_strengths");
      const oppResult = await notion.queryDataSource(oppDb.data_source_id, { page_size: 50 });

      const systemicDb = getDbConfig(config, "systemic_journal");
      const systemicResult = await notion.queryDataSource(systemicDb.data_source_id, {
        page_size: 20,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: quarterStart } },
            { property: "Date", date: { on_or_before: `${quarterEnd}T23:59:59Z` } },
          ],
        },
      });

      const campaignDb = getDbConfig(config, "campaigns");
      const campaignResult = await notion.queryDataSource(campaignDb.data_source_id, { page_size: 20 });

      // 1. OKR Results
      lines.push("## OKR Results");
      lines.push("");

      if (qResult.results.length > 0) {
        lines.push("| Goal | Status | Key Results | Progress |");
        lines.push("|------|--------|-------------|----------|");
        for (const q of qResult.results) {
          const name = extractTitle(q);
          const status = extractString(q, "Status");
          const kr1 = extractString(q, "Key Result 1");
          const kr2 = extractString(q, "Key Result 2");
          const kr3 = extractString(q, "Key Result 3");
          const krCount = [kr1, kr2, kr3].filter(Boolean).length;
          const progress = extractNumber(q, "Progress");
          lines.push(`| ${name} | ${status} | ${krCount}/3 | ${progress ?? "—"}% |`);
        }
        lines.push("");
      } else {
        lines.push("No quarterly goals found.");
        lines.push("");
      }

      // Annual goal alignment
      if (annualResult.results.length > 0) {
        lines.push("### Annual Goal Alignment");
        lines.push("");
        for (const g of annualResult.results) {
          const name = extractTitle(g);
          const status = extractString(g, "Status");
          const intent = extractString(g, "Strategic Intent");
          lines.push(`- **${name}** [${status}]${intent ? ` — ${intent.substring(0, 100)}` : ""}`);
        }
        lines.push("");
      }

      // 2. Project Outcomes
      lines.push("## Project Outcomes");
      lines.push("");

      const activeProjects = projResult.results.filter(p => extractString(p, "Status") === "Active");
      const doneProjects = projResult.results.filter(p => extractString(p, "Status") === "Done");

      lines.push(`- **Active:** ${activeProjects.length}`);
      lines.push(`- **Completed:** ${doneProjects.length}`);
      lines.push(`- **Total:** ${projResult.results.length}`);
      lines.push("");

      if (activeProjects.length > 0) {
        lines.push("### Active Projects");
        lines.push("");
        lines.push("| Project | Progress | Deadline | People |");
        lines.push("|---------|----------|----------|--------|");
        for (const p of activeProjects.slice(0, 10)) {
          const name = extractTitle(p);
          const progress = extractString(p, "Progress");
          const deadline = extractDate(p, "Deadline");
          const people = extractRelationCount(p, "People");
          const deadlineStr = deadline ? deadline.split("T")[0] : "—";
          lines.push(`| ${name} | ${progress || "—"}% | ${deadlineStr} | ${people} |`);
        }
        lines.push("");
      }

      if (doneProjects.length > 0) {
        lines.push("### Completed Projects");
        lines.push("");
        for (const p of doneProjects.slice(0, 5)) {
          const name = extractTitle(p);
          const progress = extractString(p, "Progress");
          lines.push(`- ✅ **${name}** (${progress || "100"}%)`);
        }
        lines.push("");
      }

      // 3. Financial Summary
      lines.push("## Financial Summary");
      lines.push("");

      const revenueCategories = ["Business Revenue", "Client Payment", "Investment Income", "Income"];
      let totalRevenue = 0;
      let totalExpenses = 0;
      const revenueByCategory = new Map<string, number>();
      const expensesByCategory = new Map<string, number>();

      for (const p of finResult.results) {
        const amount = extractNumber(p, "Amount") ?? 0;
        const category = extractString(p, "Category");
        if (revenueCategories.includes(category)) {
          totalRevenue += amount;
          revenueByCategory.set(category, (revenueByCategory.get(category) || 0) + amount);
        } else {
          totalExpenses += amount;
          expensesByCategory.set(category, (expensesByCategory.get(category) || 0) + amount);
        }
      }

      lines.push(`| Category | Amount |`);
      lines.push("|----------|--------|");
      lines.push(`| Revenue | ₹${totalRevenue.toLocaleString()} |`);
      lines.push(`| Expenses | ₹${totalExpenses.toLocaleString()} |`);
      lines.push(`| Net Income | ₹${(totalRevenue - totalExpenses).toLocaleString()} |`);
      lines.push(`| Transactions | ${finResult.results.length} |`);
      lines.push("");

      if (revenueByCategory.size > 0) {
        lines.push("### Revenue Breakdown");
        lines.push("");
        lines.push("| Category | Amount | % |");
        lines.push("|----------|--------|---|");
        const sorted = [...revenueByCategory.entries()].sort((a, b) => b[1] - a[1]);
        for (const [cat, amount] of sorted) {
          const pct = totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(0) : "0";
          lines.push(`| ${cat} | ₹${amount.toLocaleString()} | ${pct}% |`);
        }
        lines.push("");
      }

      // 4. Activity Summary
      lines.push("## Activity Summary");
      lines.push("");

      const totalHours = activities.reduce((s, a) => s + (a.durationHours ?? 0), 0);
      const categoryHours = new Map<string, number>();
      for (const a of activities) {
        const cat = a.activityType || "Uncategorized";
        categoryHours.set(cat, (categoryHours.get(cat) || 0) + (a.durationHours ?? 0));
      }

      lines.push(`- **Total tracked:** ${totalHours.toFixed(1)}h (${activities.length} entries)`);
      lines.push("");

      if (categoryHours.size > 0) {
        lines.push("| Category | Hours | % |");
        lines.push("|----------|-------|---|");
        const sorted = [...categoryHours.entries()].sort((a, b) => b[1] - a[1]);
        for (const [cat, hours] of sorted) {
          const pct = totalHours > 0 ? ((hours / totalHours) * 100).toFixed(0) : "0";
          lines.push(`| ${cat} | ${hours.toFixed(1)}h | ${pct}% |`);
        }
        lines.push("");
      }

      // 5. Task Summary
      lines.push("## Task Summary");
      lines.push("");

      const completedTasks = tasks.filter(t => t.status === "Done");
      const activeTasks = tasks.filter(t => ["Active", "Focus", "Up Next"].includes(t.status));
      const overdueTasks = activeTasks.filter(t => t.isOverdue);

      lines.push(`- **Completed:** ${completedTasks.length}`);
      lines.push(`- **Active:** ${activeTasks.length}`);
      lines.push(`- **Overdue:** ${overdueTasks.length}`);
      lines.push(`- **Completion rate:** ${tasks.length > 0 ? ((completedTasks.length / tasks.length) * 100).toFixed(0) : 0}%`);
      lines.push("");

      // 6. Risk Evolution
      lines.push("## Risk & Opportunity Landscape");
      lines.push("");

      const activeRisks = riskResult.results.filter(p => {
        const status = extractString(p, "Status");
        return ["Identified", "Monitoring"].includes(status);
      });

      const mitigatedRisks = riskResult.results.filter(p => {
        const status = extractString(p, "Status");
        return ["Mitigated", "Resolved"].includes(status);
      });

      const activatedOpps = oppResult.results.filter(p => {
        const status = extractString(p, "Status");
        return ["Activated", "Leveraged"].includes(status);
      });

      lines.push(`| Category | Count |`);
      lines.push("|----------|-------|");
      lines.push(`| Active Risks | ${activeRisks.length} |`);
      lines.push(`| Mitigated/Resolved Risks | ${mitigatedRisks.length} |`);
      lines.push(`| Activated Opportunities | ${activatedOpps.length} |`);
      lines.push(`| Total Opportunities | ${oppResult.results.length} |`);
      lines.push("");

      if (activeRisks.length > 0) {
        lines.push("### Active Risks");
        lines.push("");
        lines.push("| Risk | Likelihood | Impact | Threat Level |");
        lines.push("|------|-----------|--------|-------------|");
        for (const r of activeRisks.slice(0, 5)) {
          const name = extractTitle(r);
          const likelihood = extractString(r, "Likelihood");
          const impact = extractString(r, "Impact");
          const threat = extractString(r, "Threat Level");
          lines.push(`| ${name} | ${likelihood} | ${impact} | ${threat} |`);
        }
        lines.push("");
      }

      // 7. Campaign Summary
      if (campaignResult.results.length > 0) {
        lines.push("## Campaign Activity");
        lines.push("");
        lines.push("| Campaign | Status | Platforms | Content Types |");
        lines.push("|----------|--------|-----------|---------------|");
        for (const c of campaignResult.results.slice(0, 5)) {
          const name = extractTitle(c);
          const status = extractString(c, "Status");
          const platforms = extractString(c, "Platforms");
          const contentTypes = extractString(c, "Content Types");
          lines.push(`| ${name} | ${status} | ${platforms} | ${contentTypes} |`);
        }
        lines.push("");
      }

      // 8. Strategic Reflections
      if (systemicResult.results.length > 0) {
        lines.push("## Strategic Reflections");
        lines.push("");
        for (const p of systemicResult.results.slice(0, 5)) {
          const name = extractTitle(p);
          const date = extractDate(p, "Date");
          const impact = extractString(p, "Impact");
          const dateStr = date ? date.split("T")[0] : "No date";
          lines.push(`- **[${dateStr}]** ${name}${impact ? ` [${impact}]` : ""}`);
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
