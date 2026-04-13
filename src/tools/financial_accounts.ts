import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifeOSConfig, getDbConfig } from "../config.js";
import { NotionClient } from "../notion/client.js";
import { extractTitle, extractString, extractNumber } from "../transformers/shared.js";

const ASSET_TYPES = ["Checking", "Savings", "Investment", "Brokerage", "Crypto", "Cash"];
const LIABILITY_TYPES = ["Credit Card", "Loan", "Mortgage"];

export function registerFinancialAccountsTool(
  server: McpServer,
  config: LifeOSConfig,
  notion: NotionClient
) {
  server.tool(
    "lifeos_financial_accounts",
    "Query financial accounts — balance sheet overview, account balances by type, institution grouping, and net worth summary. Use to check current financial positions across all accounts.",
    {
      account_type: z.string().optional().describe("Filter by account type: Checking/Savings/Credit Card/Investment/Brokerage/Crypto/Cash/Loan/Mortgage"),
      active_only: z.boolean().optional().describe("Show only active accounts. Default: true"),
      include_details: z.boolean().optional().describe("Include institution, interest rate, and balance date. Default: false"),
    },
    async ({ account_type, active_only = true, include_details = false }) => {
      let db;
      try {
        db = getDbConfig(config, "financial_accounts");
      } catch {
        return {
          content: [{ type: "text" as const, text: "Error: financial_accounts database is not configured in lifeos.config.json. Please add the financial_accounts database configuration before using this tool." }],
        };
      }

      const body: Record<string, unknown> = {
        page_size: 100,
        sorts: [{ property: db.properties["title"], direction: "ascending" }],
      };

      if (account_type) {
        body.filter = {
          property: db.properties["account_type"],
          select: { equals: account_type },
        };
      }

      const result = await notion.queryDataSource(db.data_source_id, body);

      interface AccountEntry {
        name: string;
        type: string;
        balance: number;
        currency: string;
        institution: string;
        interestRate: number | null;
        balanceAsOf: string;
        isActive: boolean;
      }

      const accounts: AccountEntry[] = [];
      for (const p of result.results) {
        const isActive = (p.properties[db.properties["is_active"]] as any)?.checkbox === true;
        if (active_only && !isActive) continue;

        accounts.push({
          name: extractTitle(p),
          type: extractString(p, db.properties["account_type"]),
          balance: extractNumber(p, db.properties["balance_current"]) ?? 0,
          currency: extractString(p, db.properties["currency"]) || "₹",
          institution: extractString(p, db.properties["institution"]),
          interestRate: extractNumber(p, db.properties["interest_rate"]),
          balanceAsOf: extractString(p, db.properties["balance_as_of"]),
          isActive,
        });
      }

      const assets = accounts.filter((a) => ASSET_TYPES.includes(a.type));
      const liabilities = accounts.filter((a) => LIABILITY_TYPES.includes(a.type));
      const other = accounts.filter((a) => !ASSET_TYPES.includes(a.type) && !LIABILITY_TYPES.includes(a.type));

      const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
      const netWorth = totalAssets + totalLiabilities;

      const lines: string[] = [];

      lines.push("## Financial Accounts — Balance Sheet");
      lines.push("");
      lines.push(`**Total Accounts:** ${accounts.length} Active | **Net Worth:** ${formatCurrency(netWorth, accounts[0]?.currency || "₹")}`);
      lines.push("");

      if (assets.length > 0) {
        lines.push(`### Assets (${formatCurrency(totalAssets, assets[0].currency)})`);
        lines.push("");
        for (const a of assets) {
          lines.push(formatAccountLine(a, include_details));
        }
        lines.push("");
      }

      if (liabilities.length > 0) {
        lines.push(`### Liabilities (${formatCurrency(totalLiabilities, liabilities[0].currency)})`);
        lines.push("");
        for (const a of liabilities) {
          lines.push(formatAccountLine(a, include_details));
        }
        lines.push("");
      }

      if (other.length > 0) {
        lines.push(`### Other (${other.length} accounts)`);
        lines.push("");
        for (const a of other) {
          lines.push(formatAccountLine(a, include_details));
        }
        lines.push("");
      }

      const byType = new Map<string, AccountEntry[]>();
      for (const a of accounts) {
        if (!byType.has(a.type)) byType.set(a.type, []);
        byType.get(a.type)!.push(a);
      }

      if (byType.size > 0) {
        lines.push("### Summary by Type");
        lines.push("");
        for (const [type, entries] of byType) {
          const typeTotal = entries.reduce((sum, e) => sum + e.balance, 0);
          const count = entries.length;
          const label = count === 1 ? "account" : "accounts";
          lines.push(`- **${type}:** ${formatCurrency(typeTotal, entries[0].currency)} (${count} ${label})`);
        }
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}

function formatCurrency(value: number, currency: string): string {
  const symbol = currency || "₹";
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}

function formatAccountLine(account: { name: string; balance: number; currency: string; balanceAsOf: string; institution: string; interestRate: number | null }, includeDetails: boolean): string {
  const balanceStr = formatCurrency(account.balance, account.currency);
  let line = `- **${account.name}** — ${balanceStr}`;

  if (includeDetails) {
    const details: string[] = [];
    if (account.institution) details.push(account.institution);
    if (account.interestRate !== null) details.push(`${account.interestRate}% interest`);
    if (account.balanceAsOf) details.push(`as of ${account.balanceAsOf.split("T")[0]}`);
    if (details.length > 0) {
      line += ` (${details.join(", ")})`;
    }
  } else if (account.balanceAsOf) {
    line += ` (as of ${account.balanceAsOf.split("T")[0]})`;
  }

  return line;
}
