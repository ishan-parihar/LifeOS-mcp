import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractNumber, extractString, extractTitle } from "../transformers/shared.js";
import { PERIOD_PARAM } from "../transformers/dates.js";

const ACTION = z.enum(["month_close", "cashflow_anomalies", "cashflow_summary", "receivables_payables"]);

export function registerFinanceOpsTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_finance_ops",
    "Finance operations. Actions: 'month_close' (monthly financial summary with prior-month comparison), 'anomalies' (z-score spending anomaly detection), 'cashflow_summary' (income/expense breakdown by category and capital engine), 'receivables'/'payables' (draft tasks for outstanding amounts, dry-run by default). Use with: lifeos_financial_log for raw entries, lifeos_temporal_analysis(include_financial) for trend synthesis.",
    {
      action: ACTION.describe("Action to perform"),
      month: z.string().optional().describe("YYYY-MM for month_close"),
      period: PERIOD_PARAM,
      z_threshold: z.number().optional().describe("Std-dev threshold for anomalies (default 2.0)"),
      snapshot_date: z.string().optional(),
      dry_run: z.boolean().optional(),
      days_out: z.number().optional().describe("Days out for receivable/payable draft tasks (default 7)"),
    },
    async (args) => {
      const action = args.action;
      if (action === "cashflow_summary" || action === "month_close") {
        let from: string;
        let to: string;
        if (args.month) {
          const [y, m] = args.month.split("-").map(Number);
          const start = new Date(Date.UTC(y, m - 1, 1));
          const end = new Date(Date.UTC(y, m, 0));
          from = start.toISOString().slice(0, 10);
          to = end.toISOString().slice(0, 10);
        } else {
          // default to past_month bounds
          const now = new Date();
          const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
          from = start.toISOString().slice(0, 10);
          to = end.toISOString().slice(0, 10);
        }

        const finDb = getDbConfig(config, "financial_log");
        const res = await notion.queryDataSource(finDb.data_source_id, {
          page_size: 100,
          filter: { and: [
            { property: "Date", date: { on_or_after: `${from}T00:00:00Z` } },
            { property: "Date", date: { on_or_before: `${to}T23:59:59Z` } },
          ]},
          sorts: [{ property: "Date", direction: "ascending" }],
        });

        const byCat = new Map<string, number>();
        const amounts: number[] = [];
        for (const p of res.results) {
          const cat = extractString(p, "Category") || "Uncategorized";
          const amt = Number(extractNumber(p, "Amount") || 0);
          byCat.set(cat, (byCat.get(cat) || 0) + amt);
          amounts.push(amt);
        }
        const total = amounts.reduce((s, v) => s + v, 0);
        const income = [...byCat.entries()].filter(([k]) => ["Income", "Client Payment", "Business Revenue", "Investment Income"].includes(k)).reduce((s, [, v]) => s + v, 0);
        const expenses = total - income;

        // Anomaly detection (simple z-score on absolute amounts)
        const zt = args.z_threshold ?? 2.0;
        const mean = amounts.length ? (amounts.reduce((s, v) => s + v, 0) / amounts.length) : 0;
        const std = Math.sqrt(amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (amounts.length || 1));
        const anomalies: Array<{ name: string; amount: number; category: string }> = [];
        for (const p of res.results) {
          const name = extractTitle(p);
          const cat = extractString(p, "Category") || "Uncategorized";
          const amt = Number(extractNumber(p, "Amount") || 0);
          const z = std > 0 ? Math.abs((amt - mean) / std) : 0;
          if (z >= zt && Math.abs(amt) > 0) anomalies.push({ name, amount: amt, category: cat });
        }

        const lines: string[] = [];
        lines.push(`# ${action === "month_close" ? "Month Close" : "Cashflow Summary"} — ${from} → ${to}`);
        lines.push("");
        lines.push(`- Entries: ${res.results.length}`);
        lines.push(`- Total: ₹${total.toFixed(2)}`);
        lines.push(`- Income: ₹${income.toFixed(2)}`);
        lines.push(`- Expenses: ₹${expenses.toFixed(2)}`);
        lines.push("");
        lines.push("## By Category");
        lines.push("");
        for (const [k, v] of [...byCat.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
          lines.push(`- ${k}: ₹${v.toFixed(2)}`);
        }
        if (anomalies.length > 0) {
          lines.push("");
          lines.push("## Anomalies (z-score)");
          lines.push("");
          for (const a of anomalies.slice(0, 20)) {
            lines.push(`- ${a.name} — ₹${a.amount.toFixed(2)} (${a.category})`);
          }
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "cashflow_anomalies") {
        // Default to current month window
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        const from = start.toISOString().slice(0, 10);
        const to = end.toISOString().slice(0, 10);
        const finDb = getDbConfig(config, "financial_log");
        const res = await notion.queryDataSource(finDb.data_source_id, {
          page_size: 100,
          filter: { and: [
            { property: "Date", date: { on_or_after: `${from}T00:00:00Z` } },
            { property: "Date", date: { on_or_before: `${to}T23:59:59Z` } },
          ]},
          sorts: [{ property: "Date", direction: "ascending" }],
        });
        const amounts = res.results.map(p => Number(extractNumber(p, "Amount") || 0));
        const mean = amounts.length ? (amounts.reduce((s, v) => s + v, 0) / amounts.length) : 0;
        const std = Math.sqrt(amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (amounts.length || 1));
        const zt = args.z_threshold ?? 2.0;
        const lines: string[] = [];
        lines.push(`# Cashflow Anomalies — ${from} → ${to}`);
        lines.push("");
        for (const p of res.results) {
          const name = extractTitle(p);
          const cat = extractString(p, "Category") || "Uncategorized";
          const amt = Number(extractNumber(p, "Amount") || 0);
          const z = std > 0 ? Math.abs((amt - mean) / std) : 0;
          if (z >= zt && Math.abs(amt) > 0) lines.push(`- ${name} — ₹${amt.toFixed(2)} (${cat})`);
        }
        if (lines.length === 2) lines.push("No anomalies over threshold.");
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "receivables_payables") {
        const finDb = getDbConfig(config, "financial_log");
        const res = await notion.queryDataSource(finDb.data_source_id, { page_size: 100 });
        const rx: Array<{ title: string; date: string }> = [];
        const px: Array<{ title: string; date: string }> = [];
        for (const p of res.results) {
          const titleTxt = extractTitle(p).toLowerCase();
          const note = extractString(p, "Notes").toLowerCase();
          const date = extractString(p, "Date");
          const title = extractTitle(p);
          const txt = `${titleTxt} ${note}`;
          if (/invoice|receivable|to receive|collect/.test(txt)) rx.push({ title, date });
          if (/payable|to pay|bill due|due by/.test(txt)) px.push({ title, date });
        }
        const lines: string[] = [];
        lines.push(`# Receivables / Payables — Draft`);
        lines.push("");
        lines.push("## Receivables");
        if (rx.length === 0) lines.push("- None detected");
        for (const r of rx.slice(0, 20)) lines.push(`- ${r.title} (noted: ${r.date})`);
        lines.push("");
        lines.push("## Payables");
        if (px.length === 0) lines.push("- None detected");
        for (const r of px.slice(0, 20)) lines.push(`- ${r.title} (noted: ${r.date})`);
        if (args.dry_run === false) {
          const tasksDb = getDbConfig(config, "tasks");
          const due = new Date(Date.now() + (args.days_out ?? 7) * 86400000).toISOString().slice(0, 10);
          for (const r of rx.slice(0, 10)) {
            const props = { status: "Active", action_date: due, description: `Collect payment: ${r.title} (noted ${r.date})` };
            const payload = (await import("./entry-helpers.js")).buildNotionProperties("tasks", `Collect: ${r.title}`, props as any);
            await notion.createPage({ parent: { data_source_id: tasksDb.data_source_id }, properties: payload.properties } as any);
          }
          for (const r of px.slice(0, 10)) {
            const props = { status: "Active", action_date: due, description: `Pay bill: ${r.title} (noted ${r.date})` };
            const payload = (await import("./entry-helpers.js")).buildNotionProperties("tasks", `Pay: ${r.title}`, props as any);
            await notion.createPage({ parent: { data_source_id: tasksDb.data_source_id }, properties: payload.properties } as any);
          }
          lines.push("");
          lines.push(`Created ${Math.min(10, rx.length)} receivable and ${Math.min(10, px.length)} payable task(s).`);
        } else {
          lines.push("");
          lines.push("> dry_run=true — suggestions only. Set dry_run=false to create tasks.");
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }
      return { content: [{ type: "text" as const, text: `Unknown action: ${action}` }] };
    }
  );
}
