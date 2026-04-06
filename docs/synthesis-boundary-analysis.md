# LifeOS MCP Synthesis Architecture Analysis

**Date:** 2026-04-03
**Scope:** All 14 synthesis tools + 12 transformers
**Question:** What is the proper boundary between MCP tool responsibilities and AI agent responsibilities for synthesis?

---

## 1. Current State Analysis

### Categorization Framework

| Category | Definition | Should MCP Do It? |
|----------|-----------|-------------------|
| **Algorithmic/Computational** | Statistics, correlations, aggregations, calculations, trend detection, anomaly detection, z-scores, linear regression | YES — deterministic, reproducible, formula-driven |
| **Interpretive/Semantic** | Insights, recommendations, narrative explanations, cross-domain pattern recognition, strategic advice, "what this means" | NO — requires broader context, reasoning, value judgment |
| **Formatting** | Markdown tables, emoji status indicators, narrative text, visual bars (█░) | PARTIALLY — as optional output, not the primary return |

### Tool-by-Tool Analysis

#### 1. `productivity.ts` (98 lines)

**What it does:**
- Fetches activities + tasks from Notion (lines 32-48)
- Calls `computeProductivityReport()` — algorithmic aggregation (line 50)
- Converts to markdown via `productivityReportToMarkdown()` (line 52)
- Fetches Activity Types and computes target comparison with status badges (lines 55-89)
- Appends navigation hint (line 91)

| Component | Category | Location |
|-----------|----------|----------|
| `computeProductivityReport()` | ✅ Algorithmic | `transformers/productivity.ts:21-89` |
| `productivityReportToMarkdown()` | ⚠️ Formatting | `transformers/productivity.ts:91-136` |
| Recreation "⚠️ HIGH" flag | ❌ Interpretive | `transformers/productivity.ts:67,112` |
| Target status emojis (✅/⚠️/⛔) | ⚠️ Formatting | `tools/productivity.ts:78-80` |
| "Next: Use `lifeos_trajectory`" | ❌ Interpretive | `tools/productivity.ts:91` |

**Problem:** The `flags` field in `ProductivityReport` (line 87) embeds interpretive text like `"⚠️ Recreation is 45% of tracked time (>40% threshold)"` — this is a judgment call that pre-empts the agent's reasoning.

---

#### 2. `daily-briefing.ts` (336 lines)

**What it does:**
- Queries tasks, activities, journals, financials (lines 34-268)
- Computes weekday profiles and anomaly detection (lines 126-216)
- Generates suggested day plan (lines 195-212)
- Compares today vs targets with status badges (lines 298-329)

| Component | Category | Location |
|-----------|----------|----------|
| Active task listing | ⚠️ Formatting | `tools/daily-briefing.ts:34-64` |
| Recent activity listing | ⚠️ Formatting | `tools/daily-briefing.ts:67-107` |
| `computeWeekdayProfiles()` | ✅ Algorithmic | `transformers/weekday-profiles.ts:53-150` |
| `detectAnomalies()` | ✅ Algorithmic | `transformers/weekday-profiles.ts:152-206` |
| `suggestDayPlan()` | ❌ Interpretive | `transformers/weekday-profiles.ts:208-264` |
| Status badges (✅ On Track, ⛔ Not Started) | ⚠️ Formatting | `tools/daily-briefing.ts:163-166,316-321` |
| "No active tasks. Consider reviewing..." | ❌ Interpretive | `tools/daily-briefing.ts:46` |

**Problem:** The tool generates a "Suggested Plan for Today" (line 200-208) with specific hour allocations. This is strategic advice that should come from the agent, which has broader context (meetings, energy levels, priorities).

---

#### 3. `temporal-analysis.ts` (223 lines)

**What it does:**
- Fetches current + baseline period activities (lines 118-160)
- Computes baselines, deviations, trends (lines 162-194)
- Optional month synthesis (lines 197-212)
- Renders everything to markdown with emoji icons (lines 36-99)

| Component | Category | Location |
|-----------|----------|----------|
| `computePeriodMetrics()` | ✅ Algorithmic | `transformers/temporal.ts:68-156` |
| `computeBaseline()` | ✅ Algorithmic | `transformers/temporal.ts:170-193` |
| `computeDeviation()` | ✅ Algorithmic | `transformers/temporal.ts:205-220` |
| `computeTrend()` | ✅ Algorithmic | `transformers/temporal.ts:237-272` |
| `synthesizeMonth()` | ✅ Algorithmic | `transformers/month-synthesis.ts:31-55` |
| `periodMetricsToMarkdown()` | ⚠️ Formatting | `tools/temporal-analysis.ts:29-100` |
| Trend icons (↗️↘️〰️→) | ⚠️ Formatting | `tools/temporal-analysis.ts:87` |
| "Next: Use `lifeos_trajectory`" | ❌ Interpretive | `tools/temporal-analysis.ts:216` |

**Verdict:** The computational core is solid. The markdown rendering is the problem — it forces a specific visual presentation and loses the structured data.

---

#### 4. `trajectory.ts` (209 lines)

**What it does:**
- Computes activity vs target gaps (lines 45-59)
- Calculates daily allocation budget (lines 65-85)
- Habit compliance bars (lines 88-98)
- 30-day trajectory projections with narrative insights (lines 100-123)

| Component | Category | Location |
|-----------|----------|----------|
| `computePeriodMetrics()` | ✅ Algorithmic | `transformers/temporal.ts:68-156` |
| `computeTrend()` | ✅ Algorithmic | `transformers/temporal.ts:237-272` |
| `mapTrajectory()` | ✅ Algorithmic + ❌ Interpretive | `transformers/temporal.ts:287-321` |
| Status labels (✅ On Track, ⚠️ Under) | ⚠️ Formatting | `tools/trajectory.ts:52-56` |
| `trajectory.insight` string | ❌ Interpretive | `transformers/temporal.ts:299-307` |

**Critical problem:** `mapTrajectory()` returns an `insight` string (line 319) like `"Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days."` — this is pre-cooked narrative that constrains how the agent can reason about the data.

---

#### 5. `weekday-patterns.ts` (140 lines)

**What it does:**
- Computes weekday profiles (line 48)
- Renders overview grid + individual profiles (lines 51-73)
- Today anomaly detection (lines 76-107)
- Suggested day plan (lines 109-127)

| Component | Category | Location |
|-----------|----------|----------|
| `computeWeekdayProfiles()` | ✅ Algorithmic | `transformers/weekday-profiles.ts:53-150` |
| `detectAnomalies()` | ✅ Algorithmic | `transformers/weekday-profiles.ts:152-206` |
| `suggestDayPlan()` | ❌ Interpretive | `transformers/weekday-profiles.ts:208-264` |
| `weekdayProfileToMarkdown()` | ⚠️ Formatting | `transformers/weekday-profiles.ts:266-301` |
| Frequency bars (█░) | ⚠️ Formatting | `transformers/weekday-profiles.ts:292` |

---

#### 6. `journal-synthesis.ts` (68 lines)

**What it does:**
- Queries journal entries (lines 32-44)
- Naive keyword extraction from titles (lines 49-51)
- Returns top keywords + recent entries as markdown (lines 54-65)

| Component | Category | Location |
|-----------|----------|----------|
| Keyword tokenization | ✅ Algorithmic | `tools/journal-synthesis.ts:50` |
| Top keyword ranking | ✅ Algorithmic | `tools/journal-synthesis.ts:54` |
| Entry listing | ⚠️ Formatting | `tools/journal-synthesis.ts:64` |

**Verdict:** Minimal tool. The keyword extraction is too naive (title-only, no content analysis). But the core issue is it returns only markdown, not structured keyword data.

---

#### 7. `project-health.ts` (52 lines)

**What it does:**
- Lists projects with relation counts (lines 21-48)
- Computes deadline urgency (line 38)
- Adds emoji badges (lines 39-43)

| Component | Category | Location |
|-----------|----------|----------|
| Deadline urgency calc | ✅ Algorithmic | `tools/project-health.ts:38` |
| Relation counts | ✅ Algorithmic | `tools/project-health.ts:35-37` |
| Emoji badges (⚠️🔥💡) | ⚠️ Formatting | `tools/project-health.ts:39-43` |

**Critical problem:** Only shows relation COUNTS, not actual risk/opportunity content. The tool says "🔥 Risks(3)" but doesn't tell you what those risks are. This is incomplete data, not just formatting.

---

#### 8. `okrs-progress.ts` (49 lines)

**What it does:**
- Lists quarterly goals with progress, health, relation counts (lines 20-46)
- Flags "⚠️ No projects linked" as blocked (line 33)

| Component | Category | Location |
|-----------|----------|----------|
| Progress/health extraction | ✅ Algorithmic | `tools/okrs-progress.ts:30-31` |
| "No projects linked" warning | ❌ Interpretive | `tools/okrs-progress.ts:33` |

**Problem:** Same as project-health — shows counts, not content. The "blocked" detection is a proxy heuristic (0 projects ≠ actually blocked).

---

#### 9. `alignment.ts` (120 lines)

**What it does:**
- Three actions: OKR↔Campaign coverage, stakeholder mapping, activity targets
- Lists projects with campaign counts (lines 44-53)
- Filters projects by relation (lines 86-99)
- Sums hours by activity type (lines 93-99)

| Component | Category | Location |
|-----------|----------|----------|
| OKR project listing | ⚠️ Formatting | `tools/alignment.ts:32-54` |
| Activity hour aggregation | ✅ Algorithmic | `tools/alignment.ts:93-99` |
| "⚠️ No linked projects — coverage gap" | ❌ Interpretive | `tools/alignment.ts:38` |

---

#### 10. `planning-ops.ts` (146 lines)

**What it does:**
- Morning planner: scores and ranks tasks (lines 27-74)
- Weekly review: time allocation + overdue tasks (lines 77-140)
- Habit compliance: targets vs actuals (lines 108-123)

| Component | Category | Location |
|-----------|----------|----------|
| Task scoring algorithm | ✅ Algorithmic | `tools/planning-ops.ts:35-48` |
| Time aggregation | ✅ Algorithmic | `tools/planning-ops.ts:92-98` |
| "Suggested Focus" list | ❌ Interpretive | `tools/planning-ops.ts:51-63` |
| "Consider reviewing your backlog" | ❌ Interpretive | `tools/planning-ops.ts:57` |

---

#### 11. `people-ops.ts` (139 lines)

**What it does:**
- Cadence review: computes overdue contacts (lines 34-53)
- Log interaction: creates relational journal entries (lines 56-87)
- Queue followups: creates tasks for overdue contacts (lines 89-134)

| Component | Category | Location |
|-----------|----------|----------|
| Overdue calculation | ✅ Algorithmic | `tools/people-ops.ts:42-46` |
| Write operations (dry-run) | ✅ Operational | `tools/people-ops.ts:70-133` |

**Verdict:** This is primarily an operational tool (CRUD with computation). The interpretive layer is minimal.

---

#### 12. `finance-ops.ts` (188 lines)

**What it does:**
- Cashflow summary: aggregates by category, computes income/expenses (lines 29-103)
- Anomaly detection: z-score on amounts (lines 71-80)
- Receivables/payables: keyword matching (lines 140-184)

| Component | Category | Location |
|-----------|----------|----------|
| Category aggregation | ✅ Algorithmic | `tools/finance-ops.ts:57-68` |
| Z-score anomaly detection | ✅ Algorithmic | `tools/finance-ops.ts:71-80` |
| Keyword-based receivable detection | ✅ Algorithmic | `tools/finance-ops.ts:151-152` |

**Verdict:** Mostly algorithmic. The markdown formatting is the main issue.

---

#### 13. `content.ts` (132 lines)

**What it does:**
- CRUD operations: list, transition, publish, update metrics, calendar
- Transforms entries to markdown (line 70)

| Component | Category | Location |
|-----------|----------|----------|
| Status transition validation | ✅ Algorithmic | `tools/content.ts:19-22` |
| Entry listing | ⚠️ Formatting | `tools/content.ts:69-71` |

**Verdict:** Primarily operational. Formatting issue only.

---

#### 14. `campaigns.ts` (62 lines)

**What it does:**
- List campaigns with markdown formatting (lines 28-38)
- Brief: single campaign details (lines 39-58)

| Component | Category | Location |
|-----------|----------|----------|
| Campaign transformation | ✅ Algorithmic | `tools/campaigns.ts:36` |
| Markdown rendering | ⚠️ Formatting | `tools/campaigns.ts:37` |

---

## 2. Problem Identification

### P0: Structured Data Loss

**Every tool returns only `content: [{ type: "text", text: markdown }]`.**

The MCP converts rich computed data (maps, objects, arrays with numeric metrics) into a flat markdown string. The agent receives text and must re-parse it to extract numbers.

```
// What the MCP computes:
{
  categoryBreakdown: Map { "Work" => { hours: 24.5, count: 12, pctOfTotal: 58 } },
  dailyAverage: 3.5,
  completionRate: 80,
  deviations: [{ metric: "Daily Hours", zScore: 1.2, severity: "normal" }]
}

// What the agent receives:
"- **Work:** 24.5h (58%) ████████░░ — 12 entries\n- Daily average: 3.5h/day"
```

The agent must regex-parse the markdown to get the numbers back. This is lossy, fragile, and wasteful.

### P1: Pre-Judged Interpretations

Tools embed status labels and judgments that constrain agent reasoning:

| Tool | Pre-Judged Output | Why It's Wrong |
|------|-------------------|----------------|
| `productivity.ts:67` | `"⚠️ Recreation is 45% of tracked time (>40% threshold)"` | The agent may know recreation was intentionally high (vacation week) |
| `trajectory.ts:52-56` | `"✅ On Track"`, `"⛔ Way Under"` | 20% threshold is arbitrary; agent has context about acceptable variance |
| `daily-briefing.ts:163-166` | `"✅ On Track"`, `"⛔ Anomaly"` | Sigma thresholds are statistical, not prescriptive |
| `okrs-progress.ts:33` | `"⚠️ No projects linked"` | Zero projects may be correct (exploratory OKR) |
| `transformers/temporal.ts:299-307` | `"Behind target. Need 1.20/day to close gap."` | Narrative pre-empts agent's strategic reasoning |

### P2: Suggested Actions Without Context

Tools generate action recommendations that may conflict with the agent's broader knowledge:

| Tool | Suggestion | Problem |
|------|-----------|---------|
| `daily-briefing.ts:200-208` | "Suggested Plan for Today" with hour allocations | Agent knows about meetings, energy levels, priorities |
| `planning-ops.ts:51-63` | "Suggested Focus" task list | Agent knows about dependencies, external deadlines |
| `people-ops.ts:113` | "Follow up with X — schedule by Y" | Agent knows relationship context, recent interactions |

### P3: Incomplete Data Queries

Some tools show counts instead of content:

| Tool | Issue | Location |
|------|-------|----------|
| `project-health.ts` | Shows "Risks(3)" but not what the risks are | Line 37 |
| `okrs-progress.ts` | Shows "Projects linked: 2" but not project status | Line 37 |
| `alignment.ts` | Lists all projects, doesn't filter by actual relation | Line 45 |

### P4: Navigation Hints as Prescriptive Text

Every tool ends with "Next: Use `lifeos_X`" hints. These are useful but:
- They're baked into the text response
- They can't be conditionally shown based on what the agent already knows
- They suggest a linear workflow that may not match the agent's reasoning

---

## 3. Correct Boundary Definition

### Rules for What MCP Should Do

| Rule | Description | Examples |
|------|-------------|----------|
| **R1: Compute, Don't Judge** | MCP computes metrics, statistics, correlations. It does NOT label them as "good" or "bad". | Compute z-score → return `{ zScore: 2.3 }`. Don't return `"⛔ Anomaly"` |
| **R2: Return Structured Data** | Primary output is JSON with typed fields. Markdown is optional/secondary. | Return `{ dailyAverage: 3.5, categoryBreakdown: [...] }` |
| **R3: Provide Raw + Computed** | Return both raw data (for agent reasoning) and computed metrics (for efficiency). | Return activities array AND aggregated totals |
| **R4: Expose Thresholds as Parameters** | Don't hardcode judgment thresholds. Make them configurable. | `anomalyThreshold?: number` instead of hardcoded 2.0σ |
| **R5: No Prescriptive Advice** | Don't suggest actions, plans, or next steps. | Remove "Suggested Plan for Today" |
| **R6: No Narrative Insights** | Don't generate prose interpretations of data. | Remove `"Behind target. Need 1.20/day..."` |

### Rules for What MCP Should NOT Do

| Rule | Description | Examples |
|------|-------------|----------|
| **R7: No Status Emojis** | Don't embed ✅⚠️⛔ in data. Let the agent decide visual presentation. | Replace `"✅ On Track"` with `{ status: "on_track", deltaPct: 5 }` |
| **R8: No Markdown Tables as Primary Output** | Tables are for human display, not machine consumption. | Return arrays of objects, not pipe-delimited strings |
| **R9: No Cross-Domain Reasoning** | Don't correlate health → productivity unless it's a pure statistical correlation. | Return correlation coefficient, not "Low energy days correlate with skipped breakfast" |
| **R10: No "Next Steps"** | Don't prescribe tool usage. Agent decides based on its reasoning. | Remove "Next: Use `lifeos_trajectory`" |

### Rules for What the Agent Should Do

| Rule | Description |
|------|-------------|
| **A1: Interpret Metrics** | Agent decides what "zScore: 2.3" means in context |
| **A2: Generate Insights** | Agent produces narrative explanations combining multiple data sources |
| **A3: Recommend Actions** | Agent suggests next steps based on full context (calendar, energy, priorities) |
| **A4: Format for User** | Agent decides how to present data to the human (markdown, tables, prose) |
| **A5: Cross-Domain Synthesis** | Agent correlates "recreation is high" with "it's a holiday week" from calendar |

---

## 4. Revised Architecture

### Layer 1: Data Fetching (Unchanged)
- `lifeos_query` — Universal DB query
- Domain-specific read tools (activity_log, tasks, etc.)

### Layer 2: Computation (Enhanced — Structured Output)
All synthesis tools return **structured JSON** with a `data` field containing computed metrics and a `raw` field containing source data.

### Layer 3: Agent Reasoning (New — happens in the agent, not MCP)
The agent receives structured data and performs semantic synthesis.

### Proposed Tool Output Structure

```typescript
interface SynthesisResponse<T> {
  // Structured data for agent consumption (primary)
  data: T;
  
  // Raw source data for agent re-reasoning
  raw?: Record<string, unknown[]>;
  
  // Optional human-readable summary (secondary, can be disabled)
  summary?: string;
  
  // Metadata about the analysis
  meta: {
    period: { from: string; to: string };
    dataCompleteness: number; // 0-1, what % of expected data was available
    computationTime: number; // ms
  };
}
```

### Example: Revised `lifeos_productivity_report`

**Current approach:**
```typescript
// Returns: { content: [{ type: "text", text: "# Productivity Report\n- **Work:** 24.5h (58%)..." }] }
```

**Revised approach:**
```typescript
interface ProductivityData {
  period: { from: string; to: string; calendarDays: number };
  totals: {
    activities: number;
    hours: number;
    dailyAverage: number;
    trackedDays: number;
  };
  categories: Array<{
    name: string;
    hours: number;
    count: number;
    pctOfTotal: number;
    dailyAverage: number;
  }>;
  tasks: {
    total: number;
    active: number;
    done: number;
    overdue: number;
    completionRate: number;
  };
  habits: {
    compliance: number; // 0-100
    target: number;
  };
  targets?: Array<{
    name: string;
    targetDuration: number;
    actualDaily: number;
    delta: number;
    deltaPct: number;
  }>;
}

// Tool returns:
{
  content: [
    { type: "text", text: JSON.stringify({ data: ProductivityData, meta: {...} }) },
    { type: "resource", mimeType: "application/json", uri: "lifeos://productivity/data" }
  ]
}
```

The agent receives the structured `ProductivityData` and decides:
- Whether recreation at 45% is concerning (knows it's a holiday week)
- Whether to flag overdue tasks (knows about external blockers)
- How to present this to the user (markdown, summary, detailed)

---

## 5. Output Format Specification

### Standard Response Envelope

```typescript
interface LifeOSResponse<T> {
  // Primary: structured data for programmatic consumption
  data: T;
  
  // Optional: human-readable markdown (generated by transformer)
  // Agent can choose to include or ignore this
  markdown?: string;
  
  // Metadata
  meta: {
    tool: string;
    period?: { from: string; to: string };
    dataCompleteness: number;
    warnings: string[]; // Non-interpretive warnings (e.g., "3 days missing data")
  };
}
```

### Category-Specific Data Types

#### Activity/Time Data
```typescript
interface ActivityMetrics {
  totalHours: number;
  dailyAverage: number;
  trackedDays: number;
  calendarDays: number;
  categories: CategoryMetric[];
  dailyTimeSeries: DailyPoint[];
  weeklyTimeSeries: WeeklyPoint[];
}

interface CategoryMetric {
  name: string;
  hours: number;
  count: number;
  pctOfTotal: number;
  dailyAverage: number;
  trend?: { slope: number; r2: number; direction: "up" | "down" | "stable" };
}

interface DailyPoint {
  date: string;
  hours: number;
  categoryBreakdown: Record<string, number>;
}
```

#### Statistical Analysis
```typescript
interface StatisticalResult {
  metric: string;
  current: number;
  baseline: {
    mean: number;
    median: number;
    stdDev: number;
    p25: number;
    p75: number;
    samples: number;
  };
  deviation: {
    absolute: number;
    pct: number;
    zScore: number;
    direction: "above" | "below" | "within";
  };
  trend?: {
    slope: number;
    r2: number;
    classification: "improving" | "declining" | "stable" | "volatile";
    projection7d: number;
    projection30d: number;
  };
}
```

#### Target Compliance
```typescript
interface TargetCompliance {
  target: {
    name: string;
    duration: number;
    frequency: string;
    isHabit: boolean;
  };
  actual: {
    dailyAverage: number;
    totalHours: number;
    complianceDays: number;
  };
  gap: {
    absolute: number;
    pct: number;
    direction: "over" | "under" | "on_target";
  };
  trajectory?: {
    projected30d: number;
    rateNeeded: number;
  };
}
```

---

## 6. Implementation Plan

### Phase 1: Add Structured Output (Backward Compatible)

**Goal:** Add `data` field to existing tools without breaking current behavior.

**Changes per tool:**
1. Compute structured data object (reuse existing computation logic)
2. Return BOTH markdown (for backward compatibility) AND structured JSON
3. Add `format` parameter: `"markdown"` (default) | `"json"` | `"both"`

```typescript
// Example change to productivity.ts
server.tool(
  "lifeos_productivity_report",
  "...",
  {
    period: PERIOD_PARAM,
    date_from: DATE_FROM_PARAM,
    date_to: DATE_TO_PARAM,
    format: z.enum(["markdown", "json", "both"]).default("markdown")
      .describe("Output format. 'json' returns structured data, 'markdown' returns human-readable text, 'both' returns both."),
  },
  async ({ period, date_from, date_to, format }) => {
    // ... existing computation ...
    const report = computeProductivityReport(activities, tasks, from, to);
    
    const structured = {
      data: {
        period: { from, to, calendarDays: days },
        totals: { activities: activities.length, hours: report.totalHours, dailyAverage: report.dailyAverage },
        categories: [...report.categoryBreakdown.entries()].map(([name, d]) => ({
          name, hours: d.hours, count: d.count, pctOfTotal: d.hours / report.totalHours * 100
        })),
        tasks: { total: report.tasksTotal, active: report.tasksActive, done: report.tasksDone, overdue: report.tasksOverdue, completionRate: report.completionRate },
      },
      meta: { tool: "productivity_report", dataCompleteness: 1.0, warnings: [] }
    };

    if (format === "json") {
      return { content: [{ type: "text", text: JSON.stringify(structured, null, 2) }] };
    }
    
    const markdown = productivityReportToMarkdown(report);
    if (format === "both") {
      return { content: [
        { type: "text", text: markdown },
        { type: "resource", mimeType: "application/json", uri: "lifeos://data", text: JSON.stringify(structured) }
      ]};
    }
    
    return { content: [{ type: "text", text: markdown }] };
  }
);
```

### Phase 2: Remove Interpretive Content

**Changes to transformers:**

1. **`productivity.ts`:** Remove `flags` field from `ProductivityReport`. Remove "⚠️ HIGH" from markdown.
2. **`temporal.ts`:** Remove `insight` string from `TrajectoryMapping`. Return raw numbers only.
3. **`weekday-profiles.ts`:** Remove `suggestDayPlan()` function entirely. Keep `detectAnomalies()` (algorithmic).
4. **`tools/daily-briefing.ts`:** Remove "Suggested Plan" section. Remove "Consider reviewing your backlog" text.
5. **All tools:** Remove "Next: Use `lifeos_X`" navigation hints.

### Phase 3: Remove Emoji/Status Formatting from Data Layer

**Changes:**
1. Status computations return enums, not strings: `{ status: "on_track" }` not `"✅ On Track"`
2. Markdown formatting functions remain but are clearly separated from data computation
3. Add `includeFormatting?: boolean` parameter to control emoji/table rendering

### Phase 4: Fix Incomplete Data Queries

1. **`project-health.ts`:** Fetch actual risk/opportunity content, not just counts
2. **`okrs-progress.ts`:** Fetch linked project status, not just counts
3. **`alignment.ts`:** Filter projects by actual relation IDs

### Phase 5: Standardize Response Envelope

1. Create `src/lib/response.ts` with `LifeOSResponse<T>` type
2. Wrap all tool outputs in the standard envelope
3. Add `meta` field with tool name, period, data completeness, warnings

---

## 7. Summary: Current vs Correct Approach

### Current (Wrong)
```
Notion DB → MCP fetches → MCP computes → MCP interprets → MCP formats → Agent receives markdown → Agent re-parses markdown
```

### Correct
```
Notion DB → MCP fetches → MCP computes → MCP returns structured JSON → Agent interprets → Agent formats for user
```

### Key Differences

| Aspect | Current | Correct |
|--------|---------|---------|
| Output format | Markdown string | Structured JSON |
| Status labels | `"✅ On Track"` | `{ status: "on_track", deltaPct: 5 }` |
| Insights | `"Recreation is HIGH"` | `{ recreationPct: 45 }` |
| Suggestions | `"Suggested Plan: Work 4h, Workout 1h"` | `{ targets: [...], actuals: [...] }` |
| Navigation | `"Next: Use lifeos_trajectory"` | Agent decides based on reasoning |
| Anomalies | `"⛔ Anomaly"` | `{ zScore: 2.5, severity: "significant" }` |
| Projections | `"Behind target. Need 1.2/day"` | `{ projected30d: 12.5, target: 30, gap: 17.5 }` |

---

## 8. Concrete Code Examples

### Before: `trajectory.ts` (current)

```typescript
// Line 52-56: Pre-judged status
let status: string;
if (absDeltaPct <= 20) status = "✅ On Track";
else if (absDeltaPct <= 50) status = delta > 0 ? "⚠️ Over" : "⚠️ Under";
else status = delta > 0 ? "⛔ Way Over" : "⛔ Way Under";

// Line 115: Narrative insight
projectionLines.push(`- ${trajectory.insight}`);
// trajectory.insight = "Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days."
```

### After: `trajectory.ts` (correct)

```typescript
// Structured target compliance
const compliance: TargetCompliance = {
  target: { name, duration: target.targetDuration, frequency: target.targetFrequency, isHabit: target.isHabit },
  actual: { dailyAverage: current, totalHours: current * currentMetrics.trackedDays, complianceDays: currentMetrics.trackedDays },
  gap: { absolute: delta, pct: deltaPct, direction: absDeltaPct <= 20 ? "on_target" : delta > 0 ? "over" : "under" },
  trajectory: trend ? {
    projected30d: trend.projection30d,
    rateNeeded: (target.targetDuration - current) / 30,
  } : undefined,
};

// Agent receives this and decides:
// - Is 15% under target acceptable given current circumstances?
// - Should I alert the user or is this normal variance?
// - How does this compare to other priorities?
```

### Before: `daily-briefing.ts` (current)

```typescript
// Line 200-208: Prescriptive suggestions
const suggestions = suggestDayPlan(todayProfile, targets);
for (const s of suggestions) {
  const tag = s.fromTarget ? "🎯" : "📊";
  lines.push(`- ${tag} **${s.category}:** ${s.suggestedHours}h — ${s.reasoning}`);
}
```

### After: `daily-briefing.ts` (correct)

```typescript
// Return structured profile + targets, let agent plan
const structured = {
  data: {
    date: targetDate,
    weekdayProfile: todayProfile ? {
      weekday: WEEKDAY_NAMES[targetDow],
      typicalHours: todayProfile.totalHours.mean,
      consistency: todayProfile.consistency,
      categoryStats: [...todayProfile.categories.entries()].map(([name, stats]) => ({
        name, mean: stats.mean, stdDev: stats.stdDev, frequency: stats.frequency,
      })),
    } : null,
    todayActuals: [...todayHours.entries()].map(([name, hours]) => ({ name, hours })),
    targets: [...targets.entries()].map(([name, t]) => ({
      name, targetDuration: t.targetDuration, isHabit: t.isHabit,
    })),
    anomalies: notableAnomalies.map(a => ({
      category: a.category, expected: a.expectedMean, actual: a.actual,
      deviationSigma: a.deviationSigma, severity: a.severity,
    })),
  },
  meta: { tool: "daily_briefing", dataCompleteness: 0.85, warnings: ["2 days missing from weekday profile"] },
};
```

---

## 9. Decision Matrix

| Operation | MCP Should Do | Agent Should Do | Rationale |
|-----------|--------------|-----------------|-----------|
| Calculate mean/median/stdDev | ✅ | | Deterministic math |
| Compute z-scores | ✅ | | Statistical formula |
| Linear regression | ✅ | | Algorithmic |
| Correlation coefficients | ✅ | | Statistical formula |
| Aggregate hours by category | ✅ | | Summation |
| Detect anomalies (z > threshold) | ✅ | | Statistical test |
| Compute trend slope | ✅ | | Algorithmic |
| Label "On Track" / "Behind" | | ✅ | Requires context about acceptable variance |
| Suggest daily plan | | ✅ | Requires knowledge of meetings, energy, priorities |
| Recommend task prioritization | | ✅ | Requires understanding of dependencies, deadlines |
| Explain "why" recreation is high | | ✅ | Requires cross-domain reasoning (holidays, burnout) |
| Generate narrative summary | | ✅ | Requires language generation and judgment |
| Format for human readability | | ✅ | Agent knows user preferences |
| Decide which tools to call next | | ✅ | Agent has reasoning capability |
| Cross-domain correlation interpretation | | ✅ | Requires semantic understanding |

---

## 10. Conclusion

The core thesis is **correct**: MCP should provide structured, computed data; the agent should perform semantic synthesis.

**Current state:** Tools compute well but then immediately convert to markdown with embedded interpretations, losing the structured data and pre-judging results.

**Required changes:**
1. Return structured JSON as primary output (Phase 1)
2. Remove interpretive text, status labels, and suggestions (Phase 2)
3. Separate formatting from computation (Phase 3)
4. Fix incomplete data queries (Phase 4)
5. Standardize response envelope (Phase 5)

**What stays the same:** All computation logic in transformers (`computePeriodMetrics`, `computeBaseline`, `computeDeviation`, `computeTrend`, `detectAnomalies`, `computeWeekdayProfiles`) is correct and should be preserved. The problem is not the computation — it's the presentation layer that consumes the computation and throws away the structure.

**What changes:** Every tool's return value. Instead of `content: [{ type: "text", text: markdown }]`, tools should return `content: [{ type: "text", text: JSON.stringify({ data, meta }) }]` with markdown as an optional secondary output.
