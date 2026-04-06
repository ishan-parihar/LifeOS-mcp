# LifeOS MCP Synthesis Architecture — Corrected Analysis

**Date:** 2026-04-03
**Scope:** All 14 synthesis tools + 12 transformers
**Thesis:** Structured markdown IS structured data for LLMs. The problem is not the format — it's what the format contains.

---

## 1. Corrected Thesis

### Why the Previous Analysis Was Wrong

The previous analysis (`docs/synthesis-boundary-analysis.md`) argued that MCP should return JSON because "agents need structured data." This is incorrect for three reasons:

1. **LLMs are pretrained on massive markdown corpora.** Tables, lists, headers, code blocks — these are all native structures that LLMs parse perfectly. The claim that "agents must regex-parse markdown" is false. LLMs understand markdown semantically.

2. **Factual narrative observations ARE valuable.** The statement "Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days" is not "pre-cooked narrative that constrains reasoning." It is a factual computation that saves the agent from doing arithmetic. The agent can still decide what to do about it.

3. **JSON adds an unnecessary conversion step.** The end user reads markdown. The agent reads markdown. Returning JSON means either (a) the agent must format it for the user, duplicating work, or (b) the user reads raw JSON, which is worse.

### What IS Actually Wrong

The real problems are:

| Problem | Example | Why It's Bad |
|---------|---------|-------------|
| **Visual noise** | `████████░░` bars, `✅⚠️⛔` badges | Wastes tokens, adds no information |
| **Prescriptive text** | "Suggested Plan for Today", "Consider reviewing your backlog" | The agent decides actions, not the MCP |
| **Incomplete data** | "Risks(3)" without showing the risks | The agent can't reason about what it can't see |
| **Redundant navigation** | "Next: Use `lifeos_trajectory`" | Tool descriptions should cover this |
| **Pre-judged labels** | "⚠️ Recreation is HIGH" | The agent has context the MCP doesn't |

### The Correct Architecture

```
Notion DB → MCP fetches → MCP computes → MCP structures as markdown → Agent reads → Agent decides → Agent formats for user (if needed)
```

**MCP does:** Fetch, compute, aggregate, structure, observe (factually).
**Agent does:** Judge, recommend, decide, cross-domain synthesize.

---

## 2. Current State Analysis — Tool by Tool

### Categorization Key

| Symbol | Category | Should MCP Do It? |
|--------|----------|-------------------|
| ✅ | Good structured markdown | YES — tables, lists, clear sections |
| ✅ | Good factual narrative | YES — "Rate: 0.5/day, need 1.2/day" |
| ⚠️ | Visual noise | NO — emoji bars, status badges |
| ❌ | Prescriptive text | NO — "Suggested Plan", "Consider..." |
| ❌ | Incomplete data | NO — counts without content |
| ❌ | Redundant navigation | NO — "Next: use lifeos_X" |

---

### Tool 1: `productivity.ts` (98 lines)

**Tool description:** "Weekly/monthly productivity analysis. Returns time allocation by category, task completion metrics, and comparison against Activity Types targets..."

**Output sections:**
1. Range label (good)
2. Productivity report via `productivityReportToMarkdown()`
3. vs Targets table with status badges
4. Navigation hint

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Range label `> Showing: ...` | ✅ | `productivity.ts:51` | Good context |
| Overview stats (activities, hours, daily avg) | ✅ | `transformers/productivity.ts:92-101` | Clear factual data |
| Time allocation with bars | ⚠️ | `transformers/productivity.ts:111` | `████████░░` wastes tokens |
| Recreation "⚠️ HIGH" flag | ❌ | `transformers/productivity.ts:112` | Pre-judged interpretation |
| Task performance counts | ✅ | `transformers/productivity.ts:117-123` | Factual counts |
| "⚠️ Overdue: N" | ⚠️ | `transformers/productivity.ts:123` | Emoji noise, but count is useful |
| Alerts & Insights flags | ❌ | `transformers/productivity.ts:126-132` | "⚠️ Recreation is 45% of tracked time (>40% threshold)" — pre-judged |
| Targets table with ✅⚠️⛔ | ⚠️ | `productivity.ts:78-80` | Status badges add noise |
| "Next: Use `lifeos_trajectory`" | ❌ | `productivity.ts:91` | Redundant navigation |

**Current output example:**
```
# Productivity Report
**Period:** 2026-03-25 to 2026-04-03

## Overview
- **Activities logged:** 42
- **Total tracked time:** 52.3h
- **Daily average:** 5.8h/day
- **Habit activities:** 12 (8.5h)

## Time Allocation
- **Work:** 24.5h (47%) ████████░░ — 12 entries
- **Recreation:** 15.2h (29%) █████░░░░░ ⚠️ HIGH — 8 entries
- **Workout:** 7.3h (14%) ███░░░░░░░ — 5 entries

## Alerts & Insights
- ⚠️ Recreation is 29% of tracked time (>40% threshold)
- ⚠️ 3 overdue task(s) need attention

---
> Next: Use `lifeos_trajectory` for target gap analysis, or `lifeos_create_report` to save this analysis.
```

**Correct output should be:**
```
# Productivity Report — 2026-03-25 → 2026-04-03 (10d)

## Overview
- Activities: 42 | Tracked: 52.3h | Daily avg: 5.8h/day
- Habit entries: 12 (8.5h)

## Time Allocation
| Activity | Hours | Entries | % of Total | Daily Avg |
|----------|-------|---------|------------|-----------|
| Work | 24.5 | 12 | 47% | 2.7 |
| Recreation | 15.2 | 8 | 29% | 1.7 |
| Workout | 7.3 | 5 | 14% | 0.8 |

## Task Performance
- Total: 45 | Active: 12 | Completed: 8 | Rate: 18%
- Overdue: 3

## vs Targets (Activity Types)
| Activity | Target/day | Actual/day | Δ |
|----------|-----------|------------|---|
| Work | 4.0h | 2.7h | -33% |
| Recreation | 1.5h | 1.7h | +13% |
| Workout | 1.0h | 0.8h | -20% |
```

**Changes needed:**
- Remove ASCII bars (`█░`) — replace with clean tables
- Remove "⚠️ HIGH" flags — show raw numbers, let agent judge
- Remove "Alerts & Insights" section — these are pre-judged interpretations
- Remove navigation hint
- Keep factual narrative (numbers, percentages, deltas)
- Show actual overdue task names, not just count

---

### Tool 2: `daily-briefing.ts` (336 lines)

**Tool description:** "Daily snapshot for a specific date. Returns: active tasks, recent activities, weekday pattern comparison with anomaly detection, suggested daily plan, journal entries, financial activity, and overdue alerts."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Active tasks list | ✅ | `daily-briefing.ts:34-64` | Good — shows actual task content |
| "No active tasks. Consider reviewing..." | ❌ | `daily-briefing.ts:46` | Prescriptive |
| Recent activities list | ✅ | `daily-briefing.ts:67-107` | Good factual data |
| Weekday pattern table | ✅ | `daily-briefing.ts:156-170` | Good structure |
| Status badges (✅⛔⚠️) | ⚠️ | `daily-briefing.ts:163-166` | Visual noise |
| Anomaly list with ⛔⚠️ | ⚠️ | `daily-briefing.ts:188-191` | Icons are noise, but anomaly data is good |
| "Suggested Plan for Today" | ❌ | `daily-briefing.ts:195-212` | Prescriptive — agent should plan |
| Journal entries | ✅ | `daily-briefing.ts:218-246` | Good factual listing |
| Financial activity | ✅ | `daily-briefing.ts:248-268` | Good factual listing |
| Overdue tasks | ✅ | `daily-briefing.ts:270-295` | Good — shows actual tasks |
| Today vs Targets table | ✅ | `daily-briefing.ts:297-329` | Good structure |
| Status badges in targets | ⚠️ | `daily-briefing.ts:316-321` | Visual noise |

**Current output example (problematic section):**
```
### 💡 Suggested Plan for Today
- 🎯 **Work:** 4.0h — Target: 4.0h | Typical Tuesday: 3.5h ± 1.2h (80% of Tuesdays)
- 📊 **Recreation:** 1.5h — Typical Tuesday: 1.8h ± 0.9h (60% of Tuesdays)
```

**Correct output:** Remove the "Suggested Plan" section entirely. The weekday pattern table + targets table already provide all the data the agent needs to create a plan. The agent has context the MCP doesn't (meetings, energy levels, priorities).

**Changes needed:**
- Remove "Suggested Plan for Today" section (lines 195-212)
- Remove "Consider reviewing your project backlog" (line 46)
- Replace emoji status badges with plain text labels or remove entirely
- Keep all factual data (tasks, activities, patterns, anomalies, journals, financials)

---

### Tool 3: `temporal-analysis.ts` (223 lines)

**Tool description:** "Activity pattern analysis with baseline comparison, deviation detection, and trend analysis. Compares current period against N prior weeks."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Period summary stats | ✅ | `temporal-analysis.ts:44-54` | Good factual data |
| ASCII bars in allocation | ⚠️ | `temporal-analysis.ts:63` | `████████░░` wastes tokens |
| Baseline comparison table | ✅ | `temporal-analysis.ts:72-78` | Good structure |
| Trend icons (↗️↘️〰️→) | ⚠️ | `temporal-analysis.ts:87` | Visual noise |
| Month synthesis | ✅ | `temporal-analysis.ts:95-97` | Good factual data |
| "Next: Use `lifeos_trajectory`" | ❌ | `temporal-analysis.ts:216` | Redundant navigation |

**Current output example (problematic):**
```
### Time Allocation
- **Work:** 24.5h total (3.5h/day avg) (58%) ████████░░ — 12 entries
- **Recreation:** 15.2h total (2.2h/day avg) (36%) █████░░░░░ — 8 entries

## Baseline Comparison
| Metric | Current | Baseline | Δ | Δ% | Status |
|--------|---------|----------|---|-----|--------|
| Daily Hours | 3.5 | 4.2 | -0.7 | -16.7% | normal ✅ |
```

**Correct output:**
```
## Period Summary
- Calendar days: 8 | Tracked: 3.50 days (84.0h ÷ 24)
- Total tracked: 28.0h | Daily avg (calendar): 3.5h | Entries: 42
- Peak day: 2026-03-28 (6.2h) | Low day: 2026-03-30 (1.1h)

## Time Allocation
| Activity | Hours | Day Avg | % | Entries |
|----------|-------|---------|---|---------|
| Work | 24.5 | 3.5 | 58% | 12 |
| Recreation | 15.2 | 2.2 | 36% | 8 |

## Baseline Comparison
| Metric | Current | Baseline | Δ | Δ% | Z-Score | Severity |
|--------|---------|----------|---|-----|---------|----------|
| Daily Hours | 3.5 | 4.2 | -0.7 | -16.7% | 0.8 | normal |

## Trend Analysis
- **Daily Hours:** Improving (slope: +0.042/day, R²: 0.67)
  - Projected 7d: 3.8 | 30d: 4.8
```

**Changes needed:**
- Remove ASCII bars
- Replace trend emoji with plain text
- Add z-score column to baseline table (already computed, just not shown)
- Remove navigation hint
- Keep all factual data

---

### Tool 4: `trajectory.ts` (209 lines)

**Tool description:** "Target compliance analysis. Maps activity averages against ideal targets from Activity Types. Shows per-activity gaps, habit compliance, 30-day projections, and trend direction."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Activity vs Targets table | ✅ | `trajectory.ts:34-59` | Good structure |
| Status badges (✅⚠️⛔) | ⚠️ | `trajectory.ts:52-56` | Visual noise |
| Daily allocation budget | ✅ | `trajectory.ts:62-85` | Good factual summary |
| Habit compliance bars | ⚠️ | `trajectory.ts:88-98` | `████████░░` wastes tokens |
| Trajectory projections | ✅ | `trajectory.ts:100-123` | Good factual data |
| `trajectory.insight` string | ✅ | `transformers/temporal.ts:299-307` | **This is GOOD** — factual computation |
| "Next: Use `lifeos_weekday_patterns`" | ❌ | `trajectory.ts:202` | Redundant navigation |

**The `insight` field is CORRECT.** The previous analysis called it "pre-cooked narrative that constrains reasoning." This is wrong. The insight string:

```
"Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days."
```

This is a **factual computation**, not an interpretation. It tells the agent:
- Current rate: 0.50/day (computed from data)
- Required rate: 1.20/day (computed from gap / days)
- Gap: 15.0 (computed from target - current)

The agent can still decide: "Is this achievable? Should I reprioritize? Is the target realistic?" The insight doesn't tell the agent what to do — it tells the agent what the numbers say.

**Current output example (problematic):**
```
## Activity vs Targets
| Activity | Target/day | Actual/day | Δ | Trend | Status |
|----------|-----------|------------|---|-------|--------|
| Work | 4.0h | 2.7h | -33% | ↗️ | ⚠️ Under |

## Habit Compliance
- **Workout:** 80% ████████░░ (0.8h / 1.0h target)

### Work → 4.0h/day
- Current: 2.7h/day | Target: 4.0h/day
- Trend: +0.042h/day (improving)
- Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days.
```

**Correct output:**
```
## Activity vs Targets
| Activity | Target/day | Actual/day | Δ | Trend |
|----------|-----------|------------|---|-------|
| Work | 4.0h | 2.7h | -33% | improving (+0.042/day, R²=0.67) |
| Recreation | 1.5h | 1.7h | +13% | stable (+0.005/day, R²=0.12) |
| Workout | 1.0h | 0.8h | -20% | declining (-0.018/day, R²=0.45) |

## Daily Allocation Budget
- Tracked: 28.0h over 3.50 days
- Target total: 6.5h/day | Actual total: 5.2h/day
- Deficit: -1.3h/day
- Over-budget: Recreation (+0.2h)
- Under-budget: Work (-1.3h), Workout (-0.2h)

## Habit Compliance
| Habit | Compliance | Actual | Target |
|-------|-----------|--------|--------|
| Workout | 80% | 0.8h/day | 1.0h/day |

## Trajectory Projections (30-day)
### Work → 4.0h/day
- Current: 2.7h/day | Target: 4.0h/day
- Trend: +0.042h/day (improving, R²=0.67)
- Gap: 1.3h/day | At current rate: projected 3.9h/day in 30d
- Rate needed to close gap: 0.043h/day additional

### Workout → 1.0h/day
- Current: 0.8h/day | Target: 1.0h/day
- Trend: -0.018h/day (declining, R²=0.45)
- Gap: 0.2h/day | At current rate: projected 0.3h/day in 30d
- Rate needed to close gap: 0.007h/day additional
```

**Changes needed:**
- Remove status badges from targets table
- Replace habit compliance bars with table
- Keep `trajectory.insight` but reformat as structured data (gap, rate needed, projection)
- Remove navigation hint
- Add R² values to trend column for context

---

### Tool 5: `weekday-patterns.ts` (140 lines)

**Tool description:** "What does your typical Monday/Tuesday/etc look like? Analyzes historical activity patterns per weekday."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Weekly grid table | ✅ | `transformers/weekday-profiles.ts:303-335` | Good structure |
| Day-by-day profiles | ✅ | `transformers/weekday-profiles.ts:266-301` | Good factual data |
| Frequency bars (█░) | ⚠️ | `transformers/weekday-profiles.ts:292` | Visual noise |
| Today anomaly table | ✅ | `weekday-patterns.ts:97-107` | Good structure |
| Anomaly icons (⛔⚠️✅) | ⚠️ | `weekday-patterns.ts:101` | Visual noise |
| "Suggested Plan for Today" | ❌ | `weekday-patterns.ts:109-127` | Prescriptive |
| "Next: Use `lifeos_daily_briefing`" | ❌ | `weekday-patterns.ts:133` | Redundant navigation |

**Changes needed:**
- Remove frequency bars from profile tables
- Remove anomaly icons
- Remove "Suggested Plan for Today" section
- Remove navigation hint
- Keep all factual data (profiles, anomalies, consistency scores)

---

### Tool 6: `journal-synthesis.ts` (68 lines)

**Tool description:** "Journal synthesis: consolidate themes across journals with simple keyword counts; designed to feed interventions."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Top keywords list | ✅ | `journal-synthesis.ts:60` | Good factual data |
| Recent entries list | ✅ | `journal-synthesis.ts:64` | Good factual data |

**Verdict:** This tool is mostly fine. No visual noise, no prescriptive text, no navigation hints. The keyword extraction is naive (title-only) but that's a quality issue, not an architectural one.

**Minor improvement:** Add entry count per source and date range context.

---

### Tool 7: `project-health.ts` (52 lines)

**Tool description:** "Project health synthesis: overdue tasks, risks/opps presence, progress hint, and deadline proximity."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Project listing with progress | ✅ | `project-health.ts:32-47` | Good structure |
| Deadline urgency calc | ✅ | `project-health.ts:38` | Good computation |
| "🔥 Risks(3)" | ❌ | `project-health.ts:41` | **INCOMPLETE DATA** — shows count but not content |
| "💡 Opps(2)" | ❌ | `project-health.ts:42` | **INCOMPLETE DATA** — shows count but not content |
| "⚠️ 3d overdue" | ⚠️ | `project-health.ts:40` | Emoji noise, but urgency data is good |

**This is the most critical incomplete data issue.** The tool says "🔥 Risks(3)" but the agent has no idea what those risks are. The agent cannot reason about risk severity, mitigation status, or impact without the actual risk content.

**Current output:**
```
## Project Alpha — ⚠️ 3d left  🔥 Risks(3)  💡 Opps(2)
- Progress: 45%
- Deadline: 2026-04-06
- People: 2
```

**Correct output:**
```
## Project Alpha
- Progress: 45% | Deadline: 2026-04-06 (3d left) | People: 2

### Risks (3)
| Risk | Likelihood | Impact | Status |
|------|-----------|--------|--------|
| API rate limit exceeded | High | High | Monitoring |
| Data migration delay | Medium | High | Identified |
| Team member unavailable | Low | Medium | Mitigated |

### Opportunities (2)
| Opportunity | Leverage | Status |
|------------|----------|--------|
| Reuse component library | High-Leverage | Identified |
| Client referral potential | Medium-Impact | Activated |
```

**Changes needed:**
- Fetch actual risk/opportunity content, not just counts
- Render as tables with key fields (likelihood, impact, status)
- Remove emoji badges
- Keep deadline urgency as plain text

---

### Tool 8: `okrs-progress.ts` (49 lines)

**Tool description:** "OKRs progress synthesis: KR rollups, health, blocked items, and project coverage map."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| OKR listing with KRs | ✅ | `okrs-progress.ts:28-44` | Good factual data |
| "⚠️ No projects linked" | ❌ | `okrs-progress.ts:33` | Pre-judged — zero projects may be correct |
| Progress/health extraction | ✅ | `okrs-progress.ts:30-31` | Good factual data |

**Changes needed:**
- Remove "⚠️ No projects linked" warning
- Fetch linked project names and status, not just count
- Show project list with status for each OKR

---

### Tool 9: `alignment.ts` (120 lines)

**Tool description:** "Cross-domain alignment reports for CEO/COO/CMO. OKR↔Campaign coverage, stakeholder mapping, and project activity target checks."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| OKR project listing | ✅ | `alignment.ts:32-54` | Good structure |
| "⚠️ No linked projects — coverage gap" | ❌ | `alignment.ts:38` | Pre-judged |
| Activity hour aggregation | ✅ | `alignment.ts:93-99` | Good computation |
| "Campaigns(2)" counts | ⚠️ | `alignment.ts:50` | Incomplete — shows count not content |

**Changes needed:**
- Remove "coverage gap" warning
- Fetch actual campaign names for projects
- Show campaign details, not just counts

---

### Tool 10: `planning-ops.ts` (146 lines)

**Tool description:** "Planning operations for COO Productivity. Morning planner, weekly review, and habit compliance summaries with suggested actions (dry-run by default)."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Task scoring algorithm | ✅ | `planning-ops.ts:35-48` | Good computation |
| "Suggested Focus" list | ✅ | `planning-ops.ts:51-63` | **This is OK** — it's a ranked list, not a prescription |
| "No candidates. Consider reviewing your backlog." | ❌ | `planning-ops.ts:57` | Prescriptive |
| Time allocation | ✅ | `planning-ops.ts:92-98` | Good factual data |
| "dry_run=true — suggestions only" | ✅ | `planning-ops.ts:72` | Good operational context |

**The "Suggested Focus" is actually fine** — it's a scored/ranked list based on objective criteria (overdue, priority, action date). It's not prescriptive advice like "you should work on X." It's "here are the top-scoring tasks by these criteria." The agent can use or ignore this.

**Changes needed:**
- Remove "Consider reviewing your backlog" (line 57)
- Remove "🚨 Overdue" emoji badge (line 60)
- Keep the scored ranking — it's algorithmic, not prescriptive

---

### Tool 11: `people-ops.ts` (139 lines)

**Tool description:** "People operations for CRO Relational Counsellor. Cadence review, follow-up queueing, and interaction logging (dry-run by default)."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Overdue contacts list | ✅ | `people-ops.ts:47-52` | Good factual data |
| Interaction logging | ✅ | `people-ops.ts:56-87` | Good operational |
| Follow-up queue | ✅ | `people-ops.ts:89-134` | Good operational |
| "Follow up with X — schedule by Y" | ✅ | `people-ops.ts:114` | **This is OK** — it's a draft task, not advice |

**Verdict:** This is primarily an operational tool. The interpretive layer is minimal. The "Follow up with X — schedule by Y" is a draft task description, not prescriptive advice. It's fine.

**Changes needed:** Minimal. Remove any emoji if present.

---

### Tool 12: `finance-ops.ts` (188 lines)

**Tool description:** "Finance operations for CFO Financial. Month close, anomalies, and cashflow summary (dry-run by default)."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Cashflow summary | ✅ | `finance-ops.ts:82-94` | Good factual data |
| Z-score anomaly detection | ✅ | `finance-ops.ts:71-80` | Good computation |
| Category breakdown | ✅ | `finance-ops.ts:92-94` | Good factual data |
| Receivables/payables detection | ✅ | `finance-ops.ts:140-184` | Good algorithmic |

**Verdict:** Mostly algorithmic. The markdown formatting is the main issue — could use tables instead of lists.

**Changes needed:**
- Use tables for category breakdowns
- Show z-score values alongside anomaly names
- Remove any emoji if present

---

### Tool 13: `content.ts` (132 lines)

**Tool description:** "Content Pipeline operations for agents: list, guarded transitions, publish with URL, bulk metrics update, and calendar view."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Content listing | ✅ | `content.ts:69-71` | Good factual data |
| Status transition | ✅ | `content.ts:74-79` | Good operational |
| Publish operation | ✅ | `content.ts:81-96` | Good operational |
| Calendar view | ✅ | `content.ts:110-127` | Good factual data |

**Verdict:** Primarily operational. No significant issues.

---

### Tool 14: `campaigns.ts` (62 lines)

**Tool description:** "Campaign Management operations: list and brief. Use with content tools for pipeline execution."

| Element | Category | Location | Detail |
|---------|----------|----------|--------|
| Campaign listing | ✅ | `campaigns.ts:36-37` | Good factual data |
| Campaign brief | ✅ | `campaigns.ts:40-57` | Good factual data |
| "🔗 Projects(2)" | ⚠️ | `campaigns.ts:54` | Incomplete — shows count not content |

**Changes needed:**
- Fetch linked project/campaign names, not just counts
- Remove emoji

---

## 3. Summary: Element Counts Across All Tools

| Category | Count | Examples |
|----------|-------|----------|
| ✅ Good structured markdown | 35 | Tables, lists, factual stats |
| ✅ Good factual narrative | 8 | "Behind target. Rate: 0.5/day, need 1.2/day" |
| ⚠️ Visual noise (emoji/bars) | 12 | `████████░░`, `✅⚠️⛔`, `↗️↘️`, `🔥💡` |
| ❌ Prescriptive text | 5 | "Suggested Plan", "Consider reviewing..." |
| ❌ Incomplete data | 6 | "Risks(3)", "Campaigns(2)" |
| ❌ Redundant navigation | 5 | "Next: Use `lifeos_X`" |

**Total issues to fix: 28** across 14 tools. Most are cosmetic (emoji removal) or structural (tables instead of bars). The most critical are the 6 incomplete data issues.

---

## 4. Corrected Boundary Definition

### What MCP Should Do

| Rule | Description | Example |
|------|-------------|---------|
| **R1: Compute everything deterministic** | Statistics, aggregations, trends, correlations, z-scores, linear regression | `computeTrend()`, `computeDeviation()`, `computeBaseline()` |
| **R2: Structure as clean markdown** | Tables with all relevant columns, lists with complete content, clear section headers | `| Activity | Hours | Entries | % |` not `Activity: 24.5h ████████░░` |
| **R3: Include factual narrative observations** | Computed insights that save the agent arithmetic | "Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days." |
| **R4: Show ALL content, not just counts** | If there are 3 risks, show all 3 risks with their details | Actual risk table, not "Risks(3)" |
| **R5: Expose thresholds as parameters** | Let agents control sensitivity | `anomalyThreshold?: number` (default 2.0) |
| **R6: Include computation metadata** | Period, data completeness, sample sizes | "Tracked: 3.50 days (84.0h ÷ 24) across 8 calendar days" |

### What MCP Should NOT Do

| Rule | Description | Example |
|------|-------------|---------|
| **R7: No visual noise** | No emoji status badges, no ASCII art bars | Replace `✅ On Track` with nothing or plain "on track" |
| **R8: No prescriptive advice** | No "Suggested Plan", no "Consider reviewing..." | Remove `suggestDayPlan()` output from tools |
| **R9: No pre-judged labels** | No "⚠️ HIGH", no "coverage gap" | Show "Recreation: 29% of total" without "HIGH" |
| **R10: No navigation hints** | No "Next: Use `lifeos_X`" | Tool descriptions cover tool synergy |

### What Agents Should Do

| Rule | Description |
|------|-------------|
| **A1: Interpret metrics in context** | Agent decides if 29% recreation is concerning (knows it's a holiday week) |
| **A2: Generate strategic recommendations** | Agent produces "You should reduce recreation and increase work" |
| **A3: Plan daily schedules** | Agent creates schedule considering meetings, energy, priorities |
| **A4: Cross-domain synthesis** | Agent correlates "low work hours" with "3 overdue tasks" and "poor sleep" |
| **A5: Format for end user** | Agent decides final presentation if different from MCP output |

---

## 5. Revised Tool Specifications

### 5.1 `lifeos_productivity_report`

**Sections to produce:**
1. Header with period and calendar days
2. Overview stats (activities, hours, daily avg, habit entries)
3. Time allocation table (activity, hours, entries, %, daily avg)
4. Task performance summary (total, active, done, rate, overdue count + names)
5. vs Targets table (activity, target/day, actual/day, delta%)
6. Optional flags section — but as factual observations, not judgments

**Narrative observations (appropriate):**
- "Tracked 3.50 days (84.0h ÷ 24) across 8 calendar days"
- "Recreation accounts for 29% of tracked time"
- "3 tasks are overdue: T-12, T-15, T-22"

**Parameters to expose:**
- `period`, `date_from`, `date_to` (existing)
- `include_targets?: boolean` (default true) — skip target comparison if not needed

**Tool description (revised):**
```
Weekly/monthly productivity analysis. Returns time allocation by category, task completion
metrics, and comparison against Activity Types targets (daily averages computed from tracked
hours only). Date range: past_week covers 8 calendar days, past_month covers 31.
Use with: lifeos_temporal_analysis (baseline trends), lifeos_trajectory (target gaps),
lifeos_create_report (save insights).
```

---

### 5.2 `lifeos_daily_briefing`

**Sections to produce:**
1. Active tasks (with status, priority, action date)
2. Recent activities (last 3 days, with totals)
3. Weekday pattern comparison (today vs typical)
4. Anomaly detection (sigma deviations)
5. Recent journal entries
6. Recent financial activity
7. Overdue tasks alert
8. Today vs targets table

**Remove entirely:**
- "Suggested Plan for Today" section
- "Consider reviewing your project backlog" text

**Parameters to expose:**
- `date` (existing)
- `include_plan?: boolean` (default false) — if true, include suggested plan (for user-facing mode)
- `anomaly_threshold?: number` (default 1.5) — sigma threshold for anomaly detection

**Tool description (revised):**
```
Daily snapshot for a specific date. Returns: active tasks, recent activities (last 3 days),
weekday pattern comparison with anomaly detection, journal entries, financial activity, and
overdue alerts. Use with: lifeos_weekday_patterns (for deeper pattern analysis),
lifeos_trajectory (for target gaps), lifeos_create_entry (to log estimated activities —
confirm with user).
```

---

### 5.3 `lifeos_temporal_analysis`

**Sections to produce:**
1. Period summary (calendar days, tracked days, total hours, peak/low)
2. Time allocation table (activity, hours, day avg, %, entries)
3. Baseline comparison table (metric, current, baseline, delta, delta%, z-score, severity)
4. Trend analysis (metric, direction, slope, R², projections)
5. Month synthesis (if requested)

**Parameters to expose:**
- `period`, `date_from`, `date_to` (existing)
- `scope`, `baseline_weeks`, `include_financial` (existing)
- `anomaly_threshold?: number` (default 2.0)

**Tool description (revised):**
```
Activity pattern analysis with baseline comparison, deviation detection, and trend analysis.
Compares current period against N prior weeks. Optionally includes Month-level financial
synthesis. Date range: past_week covers 8 calendar days, past_month covers 31.
Use with: lifeos_productivity_report (for summary context), lifeos_trajectory (for target
compliance), lifeos_create_report (save analysis).
```

---

### 5.4 `lifeos_trajectory`

**Sections to produce:**
1. Tracking context (calendar days, tracked days, daily avg)
2. Activity vs Targets table (activity, target, actual, delta, trend with slope+R²)
3. Daily allocation budget (tracked, target total, actual total, deficit, over/under breakdown)
4. Habit compliance table (habit, compliance%, actual, target)
5. Trajectory projections (current, target, trend, gap, projected, rate needed)

**Parameters to expose:**
- `period`, `date_from`, `date_to`, `baseline_weeks` (existing)
- `key_activities?: string[]` (default ["Work", "Recreation", "Sleep", "Workout"]) — which activities to project

**Tool description (revised):**
```
Target compliance analysis. Maps activity averages against ideal targets from Activity Types.
Shows per-activity gaps, habit compliance, 30-day projections, and trend direction.
Averages use tracked-hours only (untracked days excluded).
Use with: lifeos_productivity_report (for allocation context),
lifeos_weekday_patterns (for scheduling by weekday), lifeos_tasks (for task prioritization
based on gaps).
```

---

### 5.5 `lifeos_weekday_patterns`

**Sections to produce:**
1. Weekly grid table (day, avg hours, top activities, consistency)
2. Day-by-day profiles (weekday, instances, avg total, consistency, category table)
3. Today vs typical anomaly table (if include_today)

**Remove entirely:**
- "Suggested Plan for Today" section

**Parameters to expose:**
- `period`, `date_from`, `date_to` (existing)
- `reference_weeks`, `include_today` (existing)
- `anomaly_threshold?: number` (default 1.5)

**Tool description (revised):**
```
Analyzes historical activity patterns per weekday. Returns per-category averages, consistency
scores, and anomaly detection for today. Date range: past_month (31 calendar days) recommended
for statistical significance.
Use with: lifeos_daily_briefing (for today's actuals vs pattern),
lifeos_create_entry (to log estimated activities for missing days — confirm with user).
```

---

### 5.6 `lifeos_project_health`

**Sections to produce:**
1. Project listing (name, status, progress, deadline, urgency)
2. For each project: actual risks table (name, likelihood, impact, status)
3. For each project: actual opportunities table (name, leverage, status)
4. For each project: linked people (names)

**Parameters to expose:**
- `project_search`, `status`, `limit` (existing)
- `include_risks?: boolean` (default true)
- `include_opportunities?: boolean` (default true)
- `include_people?: boolean` (default false) — adds extra queries

**Tool description (revised):**
```
Project health synthesis: overdue tasks, risks/opportunities content, progress, and deadline
proximity. Shows actual risk and opportunity details (not just counts).
Use with: lifeos_tasks (for project-specific tasks), lifeos_directives_risks (for full risk log).
```

---

### 5.7 `lifeos_okrs_progress`

**Sections to produce:**
1. OKR listing (name, status, progress, health)
2. Key results (KR1, KR2, KR3)
3. Linked projects with status (not just count)

**Parameters to expose:**
- `quarter`, `status` (existing)
- `include_projects?: boolean` (default true)

**Tool description (revised):**
```
OKRs progress synthesis: KR rollups, health status, and linked project coverage with status.
Use with: lifeos_projects (for project details), lifeos_annual_goals (for strategic alignment).
```

---

### 5.8 `lifeos_alignment`

**Sections to produce:**
1. OKR↔Campaign coverage: OKRs with linked projects, projects with linked campaigns (names)
2. Stakeholder mapping: projects with actual people names and roles
3. Activity targets: project-specific activity hours vs targets

**Parameters to expose:**
- Existing parameters
- `include_details?: boolean` (default true) — fetch linked content, not just counts

**Tool description (revised):**
```
Cross-domain alignment reports. OKR↔Campaign coverage (with project and campaign names),
stakeholder mapping (with people names), and project activity target checks.
Use with: lifeos_projects, lifeos_campaigns, lifeos_people for detailed views.
```

---

### 5.9 `lifeos_planning_ops`

**Sections to produce:**
1. Morning planner: scored task ranking (id, name, priority, overdue status, score)
2. Weekly review: time allocation table, overdue tasks list
3. Habit compliance: targets vs actuals table

**Changes:**
- Keep scored ranking (algorithmic, not prescriptive)
- Remove "Consider reviewing your backlog"
- Remove emoji badges

**Tool description (revised):**
```
Planning operations for COO Productivity. Morning planner (scored task ranking by overdue
status, priority, and action date), weekly review (time allocation + overdue tasks), and
habit compliance summaries. Dry-run by default.
Use with: lifeos_productivity_report (for time context), lifeos_tasks (for task details).
```

---

### 5.10 `lifeos_people_ops`

**No significant changes needed.** This is primarily operational.

---

### 5.11 `lifeos_finance_ops`

**Changes:**
- Use tables for category breakdowns
- Show z-score values alongside anomaly names

---

### 5.12 `lifeos_content` and `lifeos_campaigns`

**No significant changes needed.** Primarily operational.

---

## 6. Corrected Tool Stack

### Current count: 14 synthesis tools

### Correct count: 14 tools (no change in count)

The previous analysis proposed reducing from 22 to 13 tools. The correct count is **14** — the current count. Each tool serves a distinct computation purpose:

| Tool | Computation Purpose | Why It Stays |
|------|-------------------|--------------|
| `productivity_report` | Aggregate time + task metrics | Distinct computation (hours by category, task rates) |
| `daily_briefing` | Multi-domain daily snapshot | Unique cross-domain aggregation (tasks + activities + journals + finance) |
| `temporal_analysis` | Baseline comparison + trend detection | Unique statistical analysis (z-scores, regression) |
| `trajectory` | Target compliance + projections | Unique gap analysis + rate computation |
| `weekday_patterns` | Per-weekday statistical profiles | Unique grouping by weekday + consistency scoring |
| `journal_synthesis` | Keyword extraction + theme consolidation | Unique text analysis |
| `project_health` | Project status + risk/opportunity synthesis | Unique relational aggregation |
| `okrs_progress` | OKR progress + KR rollup | Unique goal tracking |
| `alignment` | Cross-domain relation mapping | Unique coverage analysis |
| `planning_ops` | Task scoring + review aggregation | Unique prioritization algorithm |
| `people_ops` | Cadence computation + interaction logging | Unique relationship management |
| `finance_ops` | Cashflow aggregation + anomaly detection | Unique financial computation |
| `content` | Content pipeline operations | Unique CRUD operations |
| `campaigns` | Campaign management | Unique CRUD operations |

**No tools should be merged.** Each performs a distinct computation. The issue is not the number of tools — it's the quality of their output.

---

## 7. Tool Description Standards

### Principles

1. **Describe what the tool computes**, not what the user should do with it.
2. **Mention tool synergy** in the description so agents understand when to combine tools.
3. **Be specific about data sources** (which databases are queried).
4. **Note any defaults** that affect output.

### Template

```
{What it computes}. {Key parameters and defaults}. {Date range behavior if applicable}.
Use with: {tool1} ({reason}), {tool2} ({reason}), {tool3} ({reason}).
```

### Examples

**Good:**
```
Target compliance analysis. Maps activity averages against ideal targets from Activity Types.
Shows per-activity gaps, habit compliance, 30-day projections, and trend direction.
Averages use tracked-hours only (untracked days excluded).
Use with: lifeos_productivity_report (for allocation context),
lifeos_weekday_patterns (for scheduling by weekday), lifeos_tasks (for task prioritization
based on gaps).
```

**Bad:**
```
Target compliance analysis. Shows if you're on track.
Next: Use lifeos_weekday_patterns to plan your day.
```

### What to Avoid

- "Next: use..." — agents read tool descriptions and decide
- "You should..." — prescriptive language
- "This helps you..." — user-facing language, not agent-facing
- Vague descriptions like "Analyzes your data" — be specific about what computation

---

## 8. Implementation Plan

### Phase 1: Remove Visual Noise (1-2 days)

**Scope:** All tools
**Changes:**
1. Remove ASCII bars (`█░`) from all markdown formatters
2. Replace emoji status badges (✅⚠️⛔) with plain text or remove
3. Remove trend icons (↗️↘️〰️→) — use plain "improving"/"declining"/"stable"
4. Remove decorative emoji (🔥💡📋📊📝💰⚠️) from section headers

**Files to modify:**
- `src/transformers/productivity.ts:111` — remove bar generation
- `src/transformers/productivity.ts:112` — remove "⚠️ HIGH" flag
- `src/transformers/temporal.ts:63` — remove bar generation
- `src/transformers/weekday-profiles.ts:292` — remove frequency bars
- `src/tools/productivity.ts:78-80` — remove status emoji
- `src/tools/trajectory.ts:52-56` — remove status emoji
- `src/tools/trajectory.ts:95` — remove habit compliance bars
- `src/tools/daily-briefing.ts:163-166` — remove status emoji
- `src/tools/daily-briefing.ts:188-191` — remove anomaly icons
- `src/tools/weekday-patterns.ts:101` — remove anomaly icons
- `src/tools/temporal-analysis.ts:75-76` — remove deviation icons
- `src/tools/temporal-analysis.ts:87` — remove trend icons
- `src/tools/project-health.ts:39-43` — remove emoji badges
- `src/tools/okrs-progress.ts:33` — remove warning emoji
- `src/tools/alignment.ts:38` — remove warning emoji
- `src/tools/planning-ops.ts:60` — remove overdue emoji
- `src/tools/campaigns.ts:54` — remove link emoji
- `src/transformers/strategic.ts:195,209,303,321,350,368` — remove emoji

### Phase 2: Remove Prescriptive Text (1 day)

**Scope:** 4 tools
**Changes:**
1. Remove "Suggested Plan for Today" from `daily-briefing.ts` (lines 195-212)
2. Remove "Suggested Plan for Today" from `weekday-patterns.ts` (lines 109-127)
3. Remove "Consider reviewing your project backlog" from `daily-briefing.ts` (line 46)
4. Remove "Consider reviewing your backlog" from `planning-ops.ts` (line 57)
5. Remove all "Next: Use `lifeos_X`" navigation hints from all tools

**Files to modify:**
- `src/tools/daily-briefing.ts:46,195-212`
- `src/tools/weekday-patterns.ts:109-127,133`
- `src/tools/productivity.ts:91`
- `src/tools/temporal-analysis.ts:216`
- `src/tools/trajectory.ts:202`
- `src/tools/planning-ops.ts:57`

### Phase 3: Fix Incomplete Data (2-3 days)

**Scope:** 4 tools
**Changes:**
1. `project-health.ts`: Fetch actual risk/opportunity content from Notion
2. `okrs-progress.ts`: Fetch linked project names and status
3. `alignment.ts`: Fetch actual campaign names for projects
4. `campaigns.ts`: Fetch linked project names

**Implementation approach:**
- For each tool that shows "X(count)", add a secondary Notion query to fetch the related entries
- Use the relation IDs from the parent page to query the related database
- Render as tables with key fields

**Example for project-health.ts:**
```typescript
// Instead of:
const risks = extractRelationCount(p, "Directives & Risk Log");
// badges.push(`🔥 Risks(${risks})`);

// Do:
const riskIds = extractRelationIds(p, "Directives & Risk Log");
const risks = await Promise.all(riskIds.map(id => notion.getPage(id)));
// Render as table with name, likelihood, impact, status
```

### Phase 4: Improve Table Structure (1-2 days)

**Scope:** All tools
**Changes:**
1. Convert list-based output to table-based where appropriate
2. Ensure all tables have consistent column headers
3. Add computation metadata (sample sizes, tracked days, etc.)

**Files to modify:**
- `src/transformers/productivity.ts:91-136` — rewrite markdown output
- `src/transformers/temporal.ts:63` — convert bars to table columns
- `src/transformers/weekday-profiles.ts:266-301` — remove bars from tables
- `src/tools/finance-ops.ts:92-94` — convert list to table

### Phase 5: Update Tool Descriptions (1 day)

**Scope:** All 14 tools
**Changes:**
1. Rewrite all tool descriptions using the template above
2. Ensure tool synergy is mentioned
3. Remove any prescriptive language

### Phase 6: Remove Interpretive Flags from Transformers (1 day)

**Scope:** Transformer files
**Changes:**
1. Remove `flags` field from `ProductivityReport` interface
2. Remove "⚠️ HIGH" logic from `productivityReportToMarkdown()`
3. Keep `trajectory.insight` — it's factual computation, not interpretation
4. Keep `detectAnomalies()` — it's algorithmic, not prescriptive
5. Remove `suggestDayPlan()` from transformer output (keep function for optional use)

**Files to modify:**
- `src/transformers/productivity.ts:63-71,87,112,126-132`
- `src/transformers/weekday-profiles.ts:208-264` (keep function, remove from tool output)

---

## 9. What Stays, What Changes

### Stays (Correct as-is)

| Component | Why |
|-----------|-----|
| `computeProductivityReport()` | Correct algorithmic aggregation |
| `computePeriodMetrics()` | Correct statistical computation |
| `computeBaseline()` | Correct baseline calculation |
| `computeDeviation()` | Correct z-score computation |
| `computeTrend()` | Correct linear regression |
| `mapTrajectory()` | Correct gap analysis — the `insight` field is factual |
| `computeWeekdayProfiles()` | Correct weekday grouping |
| `detectAnomalies()` | Correct statistical anomaly detection |
| `trajectory.insight` string | **Factual computation**, not interpretation |
| `suggestDayPlan()` function | Keep the function, just don't include output by default |
| All transformer computation logic | Math is correct |

### Changes (Output formatting only)

| Component | Change |
|-----------|--------|
| `productivityReportToMarkdown()` | Remove bars, flags, emoji |
| `periodMetricsToMarkdown()` | Remove bars, icons |
| `weekdayProfileToMarkdown()` | Remove frequency bars |
| `weekdayOverviewToMarkdown()` | Remove emoji |
| All tool return statements | Remove navigation hints |
| `daily-briefing.ts` | Remove suggested plan section |
| `project-health.ts` | Fetch actual risk/opportunity content |
| `okrs-progress.ts` | Fetch actual project names |
| `alignment.ts` | Fetch actual campaign names |

---

## 10. Code Examples: Current vs Correct

### Example 1: Productivity Report

**Current (with problems):**
```markdown
# Productivity Report
**Period:** 2026-03-25 to 2026-04-03

## Overview
- **Activities logged:** 42
- **Total tracked time:** 52.3h
- **Daily average:** 5.8h/day
- **Habit activities:** 12 (8.5h)

## Time Allocation
- **Work:** 24.5h (47%) ████████░░ — 12 entries
- **Recreation:** 15.2h (29%) █████░░░░░ ⚠️ HIGH — 8 entries
- **Workout:** 7.3h (14%) ███░░░░░░░ — 5 entries

## Alerts & Insights
- ⚠️ Recreation is 29% of tracked time (>40% threshold)
- ⚠️ 3 overdue task(s) need attention

## vs Targets (from Activity Types)
| Activity | Target/day | Actual/day | Δ | Status |
|----------|-----------|------------|---|--------|
| Work | 4.0h | 2.7h | -33% | ⚠️ Under |
| Recreation | 1.5h | 1.7h | +13% | ✅ |
| Workout | 1.0h | 0.8h | -20% | ✅ |

---
> Next: Use `lifeos_trajectory` for target gap analysis, or `lifeos_create_report` to save this analysis.
```

**Correct:**
```markdown
# Productivity Report — 2026-03-25 → 2026-04-03 (10d)

## Overview
- Activities: 42 | Tracked: 52.3h | Daily avg: 5.8h/day
- Habit entries: 12 (8.5h)

## Time Allocation
| Activity | Hours | Entries | % of Total | Daily Avg |
|----------|-------|---------|------------|-----------|
| Work | 24.5 | 12 | 47% | 2.7 |
| Recreation | 15.2 | 8 | 29% | 1.7 |
| Workout | 7.3 | 5 | 14% | 0.8 |

## Task Performance
- Total: 45 | Active: 12 | Completed: 8 | Rate: 18%
- Overdue: 3 (T-12: "Fix auth bug", T-15: "Update docs", T-22: "Deploy v2")

## vs Targets (Activity Types)
| Activity | Target/day | Actual/day | Δ |
|----------|-----------|------------|---|
| Work | 4.0h | 2.7h | -33% |
| Recreation | 1.5h | 1.7h | +13% |
| Workout | 1.0h | 0.8h | -20% |
```

**Differences:**
- Removed ASCII bars
- Removed "⚠️ HIGH" flag
- Removed "Alerts & Insights" section (pre-judged)
- Removed status emojis from targets table
- Removed navigation hint
- Added overdue task names (was just count before)
- Cleaner table structure

---

### Example 2: Trajectory Analysis

**Current (with problems):**
```markdown
## Activity vs Targets
| Activity | Target/day | Actual/day | Δ | Trend | Status |
|----------|-----------|------------|---|-------|--------|
| Work | 4.0h | 2.7h | -33% | ↗️ | ⚠️ Under |

## Habit Compliance
- **Workout:** 80% ████████░░ (0.8h / 1.0h target)

### Work → 4.0h/day
- Current: 2.7h/day | Target: 4.0h/day
- Trend: +0.042h/day (improving)
- Behind target. Current rate: 0.50/day. Need 1.20/day to close 15.0 gap in 30 days.

---
> Next: Use `lifeos_weekday_patterns` to plan by weekday, or `lifeos_create_report` to save this analysis.
```

**Correct:**
```markdown
## Activity vs Targets
| Activity | Target/day | Actual/day | Δ | Trend |
|----------|-----------|------------|---|-------|
| Work | 4.0h | 2.7h | -33% | improving (+0.042/day, R²=0.67) |
| Recreation | 1.5h | 1.7h | +13% | stable (+0.005/day, R²=0.12) |
| Workout | 1.0h | 0.8h | -20% | declining (-0.018/day, R²=0.45) |

## Daily Allocation Budget
- Tracked: 28.0h over 3.50 days
- Target total: 6.5h/day | Actual total: 5.2h/day
- Deficit: -1.3h/day
- Over-budget: Recreation (+0.2h)
- Under-budget: Work (-1.3h), Workout (-0.2h)

## Habit Compliance
| Habit | Compliance | Actual | Target |
|-------|-----------|--------|--------|
| Workout | 80% | 0.8h/day | 1.0h/day |

## Trajectory Projections (30-day)
### Work → 4.0h/day
- Current: 2.7h/day | Target: 4.0h/day
- Trend: +0.042h/day (improving, R²=0.67)
- Gap: 1.3h/day | At current rate: projected 3.9h/day in 30d
- Rate needed to close gap: 0.043h/day additional
```

**Differences:**
- Removed status emojis
- Removed habit compliance bars
- Added R² values to trend column
- Expanded trajectory projection with gap and rate needed
- Removed navigation hint
- Added allocation budget section

---

### Example 3: Project Health

**Current (incomplete):**
```markdown
## Project Alpha — ⚠️ 3d left  🔥 Risks(3)  💡 Opps(2)
- Progress: 45%
- Deadline: 2026-04-06
- People: 2
```

**Correct:**
```markdown
## Project Alpha
- Progress: 45% | Deadline: 2026-04-06 (3d left) | People: 2

### Risks (3)
| Risk | Likelihood | Impact | Threat Level | Status |
|------|-----------|--------|-------------|--------|
| API rate limit exceeded | High | High | Critical | Monitoring |
| Data migration delay | Medium | High | High | Identified |
| Team member unavailable | Low | Medium | Medium | Mitigated |

### Opportunities (2)
| Opportunity | Leverage | Status |
|------------|----------|--------|
| Reuse component library | High-Leverage | Identified |
| Client referral potential | Medium-Impact | Activated |
```

**Differences:**
- Shows actual risk content (not just count)
- Shows actual opportunity content (not just count)
- Removed emoji badges
- Added threat level column to risks

---

## 11. Decision Matrix: MCP vs Agent

| Operation | MCP Should Do | Agent Should Do | Rationale |
|-----------|--------------|-----------------|-----------|
| Calculate mean/median/stdDev | ✅ | | Deterministic math |
| Compute z-scores | ✅ | | Statistical formula |
| Linear regression | ✅ | | Algorithmic |
| Aggregate hours by category | ✅ | | Summation |
| Detect anomalies (z > threshold) | ✅ | | Statistical test |
| Compute trend slope | ✅ | | Algorithmic |
| Compute gap and rate needed | ✅ | | Arithmetic |
| Format as markdown tables | ✅ | | Structured presentation |
| Show "Behind target. Rate: 0.5/day, need 1.2/day" | ✅ | | Factual computation |
| Suggest daily plan based on user-set targets | ✅ | | User explicitly set Activity Types targets — this is goal-oriented guidance, not overreach |
| Suggest focus tasks based on user-set priorities | ✅ | | User set priorities/dates — algorithmic prioritization of user's own goals |
| Trajectory projections toward user-set targets | ✅ | | User set the target, MCP computes the gap |
| Label "On Track" / "Behind" with emoji | | ✅ | Requires context about acceptable variance |
| Explain "why" recreation is high | | ✅ | Requires cross-domain reasoning (holidays, burnout) |
| Decide which tools to call next | | ✅ | Agent has reasoning capability |
| Cross-domain correlation interpretation | | ✅ | Requires semantic understanding |
| Format final output for user | | ✅ | Agent knows user preferences |

---

## 12. Conclusion

### What MCP Should Keep (Valid Goal-Oriented Guidance)

Elements that derive from **user-set data** (Activity Types targets, task priorities, project deadlines) are valid:

| Element | Source | Why It's Valid |
|---------|--------|----------------|
| "Suggested Plan for Today" | `weekday-profiles.ts:217-240` | Based on user-set Activity Types targets |
| "Suggested Focus" tasks | `planning-ops.ts:51-63` | Based on user-set priorities and action dates |
| Trajectory projections | `transformers/temporal.ts:287-321` | Based on user-set target durations |
| vs Targets tables | All tools | Compare actual vs user-defined targets |
| Factual narrative with numbers | All tools | "Behind target. Rate: 0.5/day, need 1.2/day" is computation |

### What MCP Should Remove (Hardcoded in Code, Not From User Data)

| Element | Code Location | Why It's Invalid |
|---------|---------------|------------------|
| `"⚠️ Recreation is 45% (>40% threshold)"` | `productivity.ts:67` | 40% is hardcoded, not from any DB |
| `"⚠️ Low activity tracking"` | `productivity.ts:70` | 2h/day minimum is hardcoded |
| `"Consider reviewing your project backlog"` | `daily-briefing.ts:46` | Generic hardcoded string |
| `"⚠️ No projects linked"` as blocked | `okrs-progress.ts:33` | Heuristic, not from DB |
| `"⚠️ No linked projects — coverage gap"` | `alignment.ts:38` | Hardcoded judgment |
| `"Next: Use lifeos_X"` | Every tool | Hardcoded navigation strings |
| Incomplete data (counts without content) | `project-health.ts`, `okrs-progress.ts`, `alignment.ts` | Agent can't reason about what it can't see |

### Implementation Status

**Phase 1 — Completed:**
- ✅ Removed hardcoded thresholds from `productivity.ts` (replaced with factual statements)
- ✅ Removed generic advice from `daily-briefing.ts`
- ✅ Removed navigation hints from `productivity.ts`, `temporal-analysis.ts`, `trajectory.ts`
- ✅ Fixed `project-health.ts` to fetch and display actual risk/opp content
- ✅ Fixed `okrs-progress.ts` to remove heuristic blocked flag
- ✅ Fixed `alignment.ts` to remove hardcoded judgment
- ✅ Added `extractRelationIds()` helper to `shared.ts`

**Phase 2 — Remaining:**
- ⏳ Remove navigation hints from remaining tools (`daily-briefing.ts`, `weekday-patterns.ts`)
- ⏳ Convert ASCII bars to clean tables (optional — visual noise is acceptable per user)
- ⏳ Update tool descriptions to be comprehensive (replaces navigation hints)
- ⏳ Add new computation tools (`health_vitality`, `financial_productivity`, `weekly_review`, `correlate`)

### Effort Estimate for Remaining Work

- Phase 2 (cleanup remaining tools): 1 day
- Phase 3 (new computation tools): 3-4 days
- Phase 4 (new enrichment tools): 2-3 days

**Total remaining: 6-8 days** for a single developer.
