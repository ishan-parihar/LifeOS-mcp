import { NotionPage } from "../notion/types.js";
import { extractTitle, extractString, extractNumber } from "./shared.js";

export interface MonthSynthesis {
  month: string;
  monthNumber: number;
  year: number;
  monthRange: string;
  status: string;

  // Financial (full 26-property spectrum)
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  endingNetWorth: number;
  netWorthChange: number;

  // Narrative fields
  accountsSnapshot: string;
  capitalAllocationInsight: string;
  cashflowNarrative: string;
  significantEvents: string;
  keyLearnings: string;
  categorySummary: string;

  // Counts
  daysLinked: number;
  financialEntries: number;
}

export function synthesizeMonth(page: NotionPage): MonthSynthesis {
  return {
    month: extractTitle(page),
    monthNumber: extractNumber(page, "Month Number") ?? 0,
    year: extractNumber(page, "Year") ?? 0,
    monthRange: extractString(page, "Month Range"),
    status: extractString(page, "Status"),

    totalIncome: extractNumber(page, "Total Income") ?? 0,
    totalExpenses: extractNumber(page, "Total Expenses") ?? 0,
    netCashflow: extractNumber(page, "Net Cashflow") ?? 0,
    endingNetWorth: extractNumber(page, "Ending Net Worth") ?? 0,
    netWorthChange: extractNumber(page, "Net Worth Change") ?? 0,

    accountsSnapshot: extractString(page, "Accounts Snapshot"),
    capitalAllocationInsight: extractString(page, "Capital Allocation Insight"),
    cashflowNarrative: extractString(page, "Cashflow Narrative"),
    significantEvents: extractString(page, "Significant Events"),
    keyLearnings: extractString(page, "Key Learnings"),
    categorySummary: extractString(page, "Category Summary"),

    daysLinked: (page.properties["Days"] as any)?.relation?.length ?? 0,
    financialEntries: (page.properties["Financial Log"] as any)?.relation?.length ?? 0,
  };
}

export function monthSynthesisToMarkdown(synthesis: MonthSynthesis): string {
  const lines: string[] = [];

  lines.push(`# ${synthesis.month} — ${synthesis.status}`);
  lines.push(`**Period:** ${synthesis.monthRange || `Month ${synthesis.monthNumber}, ${synthesis.year}`}`);
  lines.push("");

  // Financial Overview
  lines.push("## Financial Overview");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Income | ₹${synthesis.totalIncome.toLocaleString()} |`);
  lines.push(`| Total Expenses | ₹${synthesis.totalExpenses.toLocaleString()} |`);
  lines.push(`| Net Cashflow | ₹${synthesis.netCashflow.toLocaleString()} |`);
  lines.push(`| Net Worth Change | ₹${synthesis.netWorthChange.toLocaleString()} |`);
  lines.push(`| Ending Net Worth | ₹${synthesis.endingNetWorth.toLocaleString()} |`);
  lines.push("");

  // Category breakdown
  if (synthesis.categorySummary) {
    lines.push("## Expense Breakdown");
    lines.push("");
    lines.push(synthesis.categorySummary);
    lines.push("");
  }

  // Accounts
  if (synthesis.accountsSnapshot) {
    lines.push("## Accounts Snapshot");
    lines.push("");
    lines.push(synthesis.accountsSnapshot);
    lines.push("");
  }

  // Capital allocation
  if (synthesis.capitalAllocationInsight) {
    lines.push("## Capital Allocation");
    lines.push("");
    lines.push(synthesis.capitalAllocationInsight);
    lines.push("");
  }

  // Cashflow narrative
  if (synthesis.cashflowNarrative) {
    lines.push("## Cashflow Narrative");
    lines.push("");
    lines.push(synthesis.cashflowNarrative);
    lines.push("");
  }

  // Significant events
  if (synthesis.significantEvents) {
    lines.push("## Significant Events");
    lines.push("");
    lines.push(synthesis.significantEvents);
    lines.push("");
  }

  // Key learnings
  if (synthesis.keyLearnings) {
    lines.push("## Key Learnings");
    lines.push("");
    lines.push(synthesis.keyLearnings);
    lines.push("");
  }

  // Stats
  lines.push("## Data Coverage");
  lines.push("");
  lines.push(`- Days linked: ${synthesis.daysLinked}`);
  lines.push(`- Financial entries: ${synthesis.financialEntries}`);
  lines.push("");

  return lines.join("\n");
}

export function monthsComparisonToMarkdown(months: MonthSynthesis[]): string {
  if (months.length === 0) return "No month data available.";

  const lines: string[] = [];
  lines.push("# Month-over-Month Comparison");
  lines.push("");

  lines.push("| Month | Income | Expenses | Cashflow | NW Change | NW End |");
  lines.push("|-------|--------|----------|----------|-----------|--------|");

  for (const m of months.sort((a, b) => a.year * 100 + a.monthNumber - (b.year * 100 + b.monthNumber))) {
    lines.push(
      `| ${m.month.substring(0, 7)} | ₹${m.totalIncome.toLocaleString()} | ₹${m.totalExpenses.toLocaleString()} | ₹${m.netCashflow.toLocaleString()} | ₹${m.netWorthChange.toLocaleString()} | ₹${m.endingNetWorth.toLocaleString()} |`
    );
  }
  lines.push("");

  // Trends
  if (months.length >= 2) {
    const sorted = [...months].sort((a, b) => a.year * 100 + a.monthNumber - (b.year * 100 + b.monthNumber));
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];

    const incomeChange = prev.totalIncome > 0 ? ((latest.totalIncome - prev.totalIncome) / prev.totalIncome * 100) : 0;
    const expenseChange = prev.totalExpenses > 0 ? ((latest.totalExpenses - prev.totalExpenses) / prev.totalExpenses * 100) : 0;
    const nwChange = prev.endingNetWorth > 0 ? ((latest.endingNetWorth - prev.endingNetWorth) / prev.endingNetWorth * 100) : 0;

    lines.push("## Month-over-Month Trends");
    lines.push("");
    lines.push(`- Income: ${incomeChange >= 0 ? "+" : ""}${incomeChange.toFixed(1)}%`);
    lines.push(`- Expenses: ${expenseChange >= 0 ? "+" : ""}${expenseChange.toFixed(1)}%`);
    lines.push(`- Net Worth: ${nwChange >= 0 ? "+" : ""}${nwChange.toFixed(1)}%`);
    lines.push("");
  }

  return lines.join("\n");
}
