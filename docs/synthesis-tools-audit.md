# LifeOS Synthesis Tools — Comprehensive Audit Report

**Date:** 2026-04-03
**Scope:** All synthesis-level tools across 23 Notion databases
**Version:** LifeOS MCP Server v0.5.0

---

## a. Executive Summary

The LifeOS MCP server implements **23 databases** across 5 agent domains (productivity, journaling, strategic, content, temporal) and provides **13 synthesis tools** that combine data from multiple sources. The architecture is layered (index.ts:46-79):

- **Layer 1:** Data Access (query tools — single-DB)
- **Layer 2:** Synthesis (productivity report, daily briefing)
- **Layer 3:** Temporal Analysis (temporal analysis, trajectory, weekday patterns)
- **Layer 4-5:** Write/Update tools

**Key Findings:**

1. **Heavy Productivity Bias:** 7 of 13 synthesis tools focus exclusively on activity_log + tasks + activity_types. The productivity domain is well-served; all others are under-synthesized.

2. **Zero Cross-Domain Correlation:** No tool correlates data across fundamentally different domains (e.g., Finance ↔ Productivity, Health ↔ Performance, Relationships ↔ Project Outcomes). Each domain operates in isolation.

3. **Temporal Hierarchy Underutilized:** The days/weeks/months/quarters/years hierarchy (5 databases) is queried by exactly **one** synthesis tool (temporal_analysis for months, optional). Weeks, quarters, and years are never used as synthesis anchors.

4. **Diet/Health Domain Completely Isolated:** `diet_log` has zero synthesis coverage. It's only readable as raw entries via `lifeos_diet_log`.

5. **Content/Campaign Domain Has No Synthesis:** `content_pipeline` and `campaigns` are query-only. No tool correlates content performance with OKR progress, project health, or financial outcomes.

6. **Strategic Risk/Oppportunity Data Unused in Synthesis:** `directives_risk_log` and `opportunities_strengths` are only queried as relation counts in `project_health`. They are never synthesized as standalone analytical inputs.

7. **Journal Synthesis is Surface-Level:** `lifeos_journal_synthesis` performs only keyword tokenization on titles (journal-synthesis.ts:50). It ignores psychograph content, relational patterns, and systemic insights.

8. **Reports Database is Write-Only:** The `reports` DB receives data but is never queried by any synthesis tool.

**Overall Efficacy Rating: 4/10** — Strong within productivity, negligible elsewhere.

---

## b. Database Coverage Matrix

| Database | Category | productivity_report | daily_briefing | temporal_analysis | trajectory | weekday_patterns | journal_synthesis | project_health | okrs_progress | alignment | planning_ops | people_ops | finance_ops | context_card |
|----------|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **activity_log** | productivity | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ~ |
| **tasks** | productivity | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ~ |
| **activity_types** | productivity | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **projects** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ~ |
| **quarterly_goals** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **annual_goals** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **days** | temporal | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **weeks** | temporal | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **months** | temporal | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **quarters** | temporal | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **years** | temporal | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **subjective_journal** | journaling | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **relational_journal** | journaling | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ~ |
| **systemic_journal** | journaling | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **financial_log** | journaling | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ~ |
| **diet_log** | journaling | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **directives_risk_log** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **opportunities_strengths** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **people** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ~ |
| **campaigns** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ~ |
| **content_pipeline** | strategic | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **reports** | productivity | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ |
| **notes_management** | productivity | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Legend:** ✓ = Directly queried for analysis | ~ = Referenced indirectly (relation count, config, or context) | ✗ = Not used

---

## c. Per-Tool Analysis

### 1. lifeos_productivity_report

**File:** `src/tools/productivity.ts:14-97`
**Purpose:** Weekly/monthly productivity analysis with time allocation and task completion metrics.

**Databases Queried:**
- `activity_log` (line 32-42) — all entries in date range
- `tasks` (line 44-48) — all tasks (no date filter)
- `activity_types` (line 56-58) — target definitions

**Databases Ignored (Should Include):**
- `projects` — Activity entries link to projects; synthesis should show which projects consumed the most time
- `weeks` — The report is weekly/monthly but never uses the Week DB's pre-aggregated data
- `months` — Same; could leverage month-level summaries
- `financial_log` — No correlation between time spent and money earned/spent
- `diet_log` — No health-productivity correlation
- `journaling` (all 3) — No mood/state correlation with productivity

**Efficacy: Medium (6/10)**
- Does what it claims well
- Missing: project-level breakdown, health context, financial context
- The task query (line 44-48) fetches ALL tasks with no date filter — this is a bug. A "weekly report" should only count tasks completed/active in that period.

**Recommendation:** Add project-level time breakdown, filter tasks by date range, optionally include health/finance context.

---

### 2. lifeos_daily_briefing

**File:** `src/tools/daily-briefing.ts:15-335`
**Purpose:** Comprehensive daily snapshot with tasks, activities, patterns, journals, finance, and overdue alerts.

**Databases Queried:**
- `tasks` (line 34-41) — active tasks
- `activity_log` (line 67-80, 127-137) — recent activities + profile data
- `activity_types` (line 196-198, 299-301) — targets
- `subjective_journal` (line 228-232) — recent entries
- `relational_journal` (line 228-232) — recent entries
- `systemic_journal` (line 228-232) — recent entries
- `financial_log` (line 249-253) — recent transactions

**Databases Ignored (Should Include):**
- `projects` — Tasks link to projects; briefing should surface project context
- `diet_log` — What did I eat today? Critical for health-aware planning
- `directives_risk_log` — Any critical risks that need today's attention?
- `opportunities_strengths` — Any activated opportunities to leverage today?
- `campaigns` — Any campaign deadlines or content due today?
- `days` — The briefing is about a specific day but doesn't use the Days DB
- `weeks` — Could provide week-level context (what week am I in, what's the week's focus)

**Efficacy: High (7.5/10)**
- Best cross-DB coverage of any tool (7 databases)
- Good: anomaly detection, suggested plans, today vs targets
- Missing: health data, project context, strategic risks

**Recommendation:** Add diet_log for the day, project context for active tasks, critical risk alerts.

---

### 3. lifeos_temporal_analysis

**File:** `src/tools/temporal-analysis.ts:102-222`
**Purpose:** Activity pattern analysis with baseline comparison, deviation detection, and trend analysis.

**Databases Queried:**
- `activity_log` (line 122, 130, 136) — current + baseline periods
- `activity_types` (line 123, 126) — targets
- `months` (line 199-211) — optional financial synthesis via `include_financial` flag

**Databases Ignored (Should Include):**
- `weeks` — Weekly aggregation is computed in-code (line 144-160) but the Weeks DB already has pre-computed `activity_breakdown`, `category_summary`, `total_income`, `total_expenses`
- `tasks` — No task completion trend analysis
- `financial_log` — The `include_financial` flag only pulls Months DB summaries, not raw financial data for trend analysis
- `diet_log` — No health trend analysis
- `journaling` — No mood/state trend correlation with activity patterns

**Efficacy: Medium (6/10)**
- Strong statistical analysis (baseline, deviation, trend, projection)
- The month synthesis is good but opt-in (`include_financial=false` by default)
- Re-implements weekly aggregation that already exists in Weeks DB
- Missing: task trends, health trends, journal sentiment trends

**Recommendation:** Use Weeks DB for pre-aggregated data, add task completion trends, make financial inclusion default for month scope.

---

### 4. lifeos_trajectory

**File:** `src/tools/trajectory.ts:128-208`
**Purpose:** Target compliance analysis with habit compliance and 30-day projections.

**Databases Queried:**
- `activity_log` (line 146-147, 154, 169) — current + baseline
- `activity_types` (line 147, 150) — targets

**Databases Ignored (Should Include):**
- `tasks` — Task completion trajectory is completely missing
- `projects` — No project progress trajectory
- `quarterly_goals` — No OKR progress trajectory
- `diet_log` — No diet compliance trajectory
- `financial_log` — No financial trajectory (income/expense trends)

**Efficacy: Medium-Low (5/10)**
- Good: per-activity trend analysis, habit compliance bars, 30-day projections
- Narrow: Only covers activity time allocation. No task, project, or financial trajectories.
- Hardcoded key activities (line 101): `["Work", "Recreation", "Sleep", "Workout"]` — should be dynamic from targets

**Recommendation:** Add task completion trajectory, OKR progress projection, and financial trend trajectory.

---

### 5. lifeos_weekday_patterns

**File:** `src/tools/weekday-patterns.ts:15-139`
**Purpose:** Historical activity patterns per weekday with consistency scores and anomaly detection.

**Databases Queried:**
- `activity_log` (line 32-45, 81-88) — historical + today's activities
- `activity_types` (line 111-113) — targets for day plan

**Databases Ignored (Should Include):**
- `tasks` — No weekday task pattern analysis (which days have most overdue? most completions?)
- `financial_log` — No weekday spending patterns
- `diet_log` — No weekday eating patterns
- `journaling` — No weekday mood/state patterns

**Efficacy: Medium-Low (5/10)**
- Good: consistency scores, anomaly detection, suggested day plans
- Narrow: Only activity timing. No behavioral, financial, or health patterns by weekday.

**Recommendation:** Add spending-by-weekday, mood-by-weekday, task-completion-by-weekday analysis.

---

### 6. lifeos_journal_synthesis

**File:** `src/tools/journal-synthesis.ts:10-67`
**Purpose:** Consolidate themes across journals with keyword counts.

**Databases Queried:**
- `subjective_journal` (line 34-44)
- `relational_journal` (line 34-44)
- `systemic_journal` (line 34-44)

**Databases Ignored (Should Include):**
- `projects` — Journals link to projects; synthesis should show which projects generate the most reflection
- `directives_risk_log` — Systemic journals link to DRL; should surface emerging risks from journal themes
- `opportunities_strengths` — Same for opportunities
- `people` — Relational journals link to people; should surface relationship patterns
- `activity_log` — Correlate journal sentiment/mood with activity patterns

**Efficacy: Low (3/10)**
- Critically weak implementation: Only tokenizes **titles** (line 50: `title.toLowerCase().split(/[^a-z0-9]+/)`), not actual journal content
- No NLP, no sentiment analysis, no theme extraction from psychograph or journal body
- Simple word frequency counts on 4-gram+ tokens from titles — this is not synthesis, it's a word counter
- The `limit` parameter (default 50) restricts entries, meaning many journal entries are never analyzed

**Recommendation:** Full rewrite needed. Should analyze psychograph content (not just titles), perform sentiment analysis, detect recurring themes across journal types, correlate with projects/people, and surface actionable insights.

---

### 7. lifeos_project_health

**File:** `src/tools/project-health.ts:7-51`
**Purpose:** Project health synthesis with overdue tasks, risks/opps, progress, and deadline proximity.

**Databases Queried:**
- `projects` (line 21-27) — all projects

**Databases Ignored (Should Include):**
- `tasks` — Claims to show overdue tasks but only reads relation counts from projects, never queries tasks DB directly
- `activity_log` — No time-spent-on-project analysis
- `directives_risk_log` — Only reads relation count, never queries risk details
- `opportunities_strengths` — Only reads relation count, never queries opportunity details
- `campaigns` — No campaign-project linkage analysis
- `quarterly_goals` — No OKR-project alignment in health view
- `people` — No team/stakeholder health analysis

**Efficacy: Low-Medium (4/10)**
- Good: deadline proximity, risk/opp presence indicators
- Weak: Only reads relation **counts** (lines 36-37: `extractRelationCount`), never queries the actual risk/opp content
- Missing: actual task status for the project, time investment, campaign coverage

**Recommendation:** Query actual risk/opportunity details, include task completion rates per project, add time-investment analysis from activity_log.

---

### 8. lifeos_okrs_progress

**File:** `src/tools/okrs-progress.ts:7-48`
**Purpose:** OKR progress synthesis with KR rollups, health, blocked items, and project coverage.

**Databases Queried:**
- `quarterly_goals` (line 20-24) — all quarterly goals

**Databases Ignored (Should Include):**
- `projects` — Only reads relation count (line 32), never queries actual project status/progress
- `annual_goals` — No annual goal alignment context
- `tasks` — No task completion rate per OKR
- `activity_log` — No time investment per OKR
- `campaigns` — No campaign-OKR alignment

**Efficacy: Low-Medium (4/10)**
- Good: shows KRs, health, project counts
- Weak: `blocked` detection (line 33) is only `proj === 0 ? "⚠️ No projects linked" : ""` — this is a proxy, not actual blocked detection
- No progress trend, no KR completion analysis, no project health aggregation

**Recommendation:** Query linked projects for actual status, compute task completion rates per OKR, add progress trends.

---

### 9. lifeos_alignment

**File:** `src/tools/alignment.ts:10-119`
**Purpose:** Cross-domain alignment reports (3 actions).

**Databases Queried (by action):**

**action=okr_campaign_coverage (line 27-55):**
- `quarterly_goals` (line 27-28)
- `projects` (line 43-44)

**action=project_people_stakeholders (line 58-69):**
- `projects` (line 59-60)

**action=project_activity_targets (line 72-114):**
- `projects` (line 76-77, for resolution)
- `activity_log` (line 86-90)
- `activity_types` (line 91)

**Databases Ignored:**
- `campaigns` — The `okr_campaign_coverage` action reads campaign **counts** from projects (line 49: `extractRelationCount(p, "Campaign Calendar")`) but never queries the campaigns DB
- `people` — `project_people_stakeholders` only reads person **counts**, never queries the people DB for actual stakeholder details
- `tasks` — No task alignment per project
- `financial_log` — No budget alignment per project
- `directives_risk_log` — No risk alignment

**Efficacy: Medium (5/10)**
- Good: cross-domain intent (OKR↔Projects↔Campaigns, Projects↔People, Projects↔Activities)
- Weak: Reads relation counts instead of actual data (lines 49, 66)
- The `okr_campaign_coverage` action fetches ALL projects for EVERY goal (line 43-44) — O(n*m) and doesn't filter by relation
- `project_activity_targets` has useful concept but compares project hours to daily targets (line 112), which is semantically mismatched

**Recommendation:** Query actual campaign details, actual person profiles, add financial alignment per project, fix the relation filtering.

---

### 10. lifeos_planning_ops

**File:** `src/tools/planning-ops.ts:11-145`
**Purpose:** Planning operations (3 actions: morning_planner, weekly_review, habit_compliance).

**Databases Queried:**
- `tasks` (line 29-30, 126-127) — for morning planner and weekly review
- `activity_log` (line 79-89) — for weekly review and habit compliance
- `activity_types` (line 110-111) — for habit compliance targets

**Databases Ignored:**
- `projects` — Tasks link to projects; planner should surface project context
- `calendar/day/week DBs` — Morning planner should leverage Days/Weeks structure
- `journaling` — No journal-based planning input
- `financial_log` — No budget-aware planning

**Efficacy: Medium-Low (4.5/10)**
- Good: task scoring for morning planner (line 35-48), overdue detection
- Weak: Weekly review only shows time allocation + overdue tasks — no project progress, no financial summary, no journal reflection
- `habit_compliance` action re-implements the same logic as `trajectory` but with less detail

**Recommendation:** Enrich morning planner with project context, add journal reflection to weekly review, integrate financial constraints.

---

### 11. lifeos_people_ops

**File:** `src/tools/people-ops.ts:10-138`
**Purpose:** People operations (3 actions: cadence_review, queue_followups, log_interaction).

**Databases Queried:**
- `people` (line 34-35, 90-91) — all people
- `relational_journal` (line 76-77, for write only)
- `tasks` (line 121, for write only)

**Databases Ignored:**
- `relational_journal` (read) — Never queries past interactions to enrich cadence review
- `projects` — People link to projects; should show which projects each person is involved in
- `campaigns` — People may be campaign stakeholders
- `activity_log` — No analysis of time spent on relationship activities

**Efficacy: Medium (5.5/10)**
- Good: cadence tracking, follow-up queueing with dry-run
- Weak: cadence review only uses people DB fields; never enriches with relational_journal history
- No relationship health scoring (only overdue-by-days)
- Missing: project involvement context, interaction history trends

**Recommendation:** Enrich cadence review with relational_journal history, add project involvement context, compute relationship health scores.

---

### 12. lifeos_finance_ops

**File:** `src/tools/finance-ops.ts:10-187`
**Purpose:** Finance operations (4 actions: month_close, cashflow_anomalies, cashflow_summary, receivables_payables).

**Databases Queried:**
- `financial_log` (line 47-55, 113-121, 142) — all financial entries
- `tasks` (line 165-175, for write only) — creates receivable/payable tasks

**Databases Ignored:**
- `projects` — Financial entries link to projects; no project-level financial analysis
- `months` — Has pre-computed financial summaries that could be leveraged
- `weeks` — Weekly financial summaries available but unused
- `campaigns` — No campaign ROI analysis
- `content_pipeline` — No content monetization analysis
- `quarterly_goals` — No financial goal tracking

**Efficacy: Medium (5/10)**
- Good: anomaly detection with z-scores, category breakdown, receivables/payables detection
- Weak: Only operates on financial_log; no cross-domain financial synthesis
- `receivables_payables` uses regex on titles/notes (line 151-152) — brittle
- No project-level P&L, no campaign ROI, no budget vs actual

**Recommendation:** Add project-level financial analysis, campaign ROI, budget vs actual comparison, leverage Months/Weeks pre-computed data.

---

### 13. lifeos_context_card

**File:** `src/tools/context-card.ts:238-272`
**Purpose:** Agent-scoped configuration cards (no Notion queries).

**Databases Queried:** None (reads from config only, line 241: `_notion: unknown`)

**Efficacy: N/A** — This is a routing/config tool, not a synthesis tool. Included for completeness.

---

## d. Cross-DB Synthesis Gaps

### High-Value Missing Syntheses

| Gap | Databases | Value | Complexity |
|-----|-----------|-------|------------|
| **Health → Performance** | diet_log + activity_log + tasks | High | Low |
| **Finance → Productivity** | financial_log + activity_log + tasks | High | Medium |
| **Relationships → Project Outcomes** | people + projects + relational_journal | High | Medium |
| **Content ROI** | content_pipeline + campaigns + financial_log | High | Medium |
| **Risk-Aware Planning** | directives_risk_log + tasks + projects | High | Low |
| **Mood → Productivity** | subjective_journal + activity_log + tasks | High | Medium |
| **OKR → Financial Impact** | quarterly_goals + financial_log + projects | High | Medium |
| **Weekly Holistic Review** | weeks + activity_log + tasks + financial_log + journals | High | Medium |
| **Quarterly Retrospective** | quarters + quarterly_goals + projects + financial_log + journals | High | High |
| **Annual Synthesis** | years + annual_goals + quarters + all journals + financial_log | Critical | High |
| **Project Financial Health** | projects + financial_log + activity_log + tasks | High | Low |
| **Campaign Effectiveness** | campaigns + content_pipeline + activity_log + financial_log | Medium | Medium |
| **People → Productivity Impact** | people + activity_log + tasks + projects | Medium | Medium |
| **Diet → Mood Correlation** | diet_log + subjective_journal | Medium | Low |
| **Activity → Sleep Quality** | activity_log (Workout, Recreation, Sleep) | Medium | Low |

### Specific Gap Examples

1. **No Health-Productivity Link:** You track diet and activities separately but never correlate them. Does poor nutrition correlate with low Work hours? Does Workout compliance predict next-day productivity?

2. **No Financial-Time ROI:** You track time spent and money earned/spent but never compute: "How much revenue per hour of Work?" or "What's the cost of Recreation time?"

3. **No Strategic Risk Integration:** Risks exist in `directives_risk_log` but no tool surfaces them in daily briefings, planning, or project health beyond a count.

4. **No Content Performance Synthesis:** Content has reach/clicks/engagement metrics but no tool correlates content output with campaign goals, project progress, or financial outcomes.

5. **No Temporal Hierarchy Synthesis:** Days aggregate into Weeks into Months into Quarters into Years — but no tool rolls up insights across this hierarchy.

---

## e. Recommendations (Prioritized)

### P0 — Critical (Fix Now)

1. **Fix `lifeos_productivity_report` task query** (`productivity.ts:44-48`): Add date filter to task query. Currently fetches ALL tasks regardless of period.

2. **Fix `lifeos_journal_synthesis`** (`journal-synthesis.ts:50`): Currently only tokenizes titles. Must analyze actual journal content (psychograph, relational notes, systemic notes).

3. **Fix `lifeos_project_health` risk/opp queries** (`project-health.ts:36-37`): Query actual risk/opportunity content, not just relation counts.

4. **Fix `lifeos_alignment` relation filtering** (`alignment.ts:43-44`): Currently fetches ALL projects for every goal. Should filter by actual relations.

### P1 — High Priority (Next Sprint)

5. **Add `lifeos_health_productivity` tool**: Correlate diet_log + activity_log + subjective_journal. Answer: "How does nutrition affect my productivity?"

6. **Add `lifeos_financial_productivity` tool**: Correlate financial_log + activity_log. Compute revenue/hour, expense patterns by activity type.

7. **Add `lifeos_weekly_review` synthesis tool**: Combine Weeks DB + activity_log + tasks + financial_log + journals into a single weekly retrospective.

8. **Enrich `lifeos_daily_briefing`**: Add diet_log for the day, critical risk alerts, project context for active tasks.

9. **Add `lifeos_quarterly_retrospective` tool**: Roll up quarterly data from quarters + quarterly_goals + projects + financial_log + journals.

### P2 — Medium Priority

10. **Add `lifeos_content_roi` tool**: Correlate content_pipeline metrics + campaigns + financial_log.

11. **Enrich `lifeos_trajectory`**: Add task completion trajectory and financial trend trajectory.

12. **Enrich `lifeos_people_ops`**: Add relational_journal history enrichment and project involvement context.

13. **Add `lifeos_project_financial_health` tool**: Per-project P&L from financial_log + time investment from activity_log.

14. **Add `lifeos_annual_synthesis` tool**: Year-level rollup across all domains.

### P3 — Architecture Improvements

15. **Create synthesis pipeline framework**: Instead of each tool re-implementing data fetching, create a shared synthesis engine that:
    - Fetches from multiple DBs in parallel
    - Applies configurable analysis functions
    - Returns structured + markdown output
    - Supports incremental/cached analysis

16. **Add temporal hierarchy awareness**: Create a `resolveTemporalContext(date)` function that returns the containing day, week, month, quarter, and year — so all synthesis tools can anchor to the right temporal granularity.

17. **Add cross-domain correlation engine**: A generic tool that computes correlations between any two measurable domains (e.g., "correlate diet_log entries with activity_log duration by date").

---

## f. Architecture Recommendations

### Current Architecture Issues

1. **Monolithic Tool Functions:** Each synthesis tool is a single large function that:
   - Fetches data from multiple DBs sequentially (not parallel)
   - Computes analysis inline
   - Formats to markdown inline
   
   This makes them hard to test, extend, or compose.

2. **No Shared Analysis Primitives:** Statistical functions (computeBaseline, computeTrend, computeDeviation) exist in `temporal.ts` but are only used by temporal tools. They should be in a shared `src/lib/analysis/` directory.

3. **No Caching/Incremental Analysis:** Every tool call re-fetches all data from Notion. For synthesis that combines 5+ databases, this is slow and rate-limited.

4. **No Structured Output:** All tools return markdown strings. This makes it impossible for downstream tools to consume synthesis results programmatically.

### Recommended Architecture

```
src/
  tools/
    synthesis/           # New directory for synthesis tools
      health-productivity.ts
      financial-productivity.ts
      weekly-review.ts
      quarterly-retrospective.ts
      content-roi.ts
      project-financial.ts
      annual-synthesis.ts
      risk-aware-planning.ts
    enhanced/            # Enhanced versions of existing tools
      daily-briefing-v2.ts
      project-health-v2.ts
      journal-synthesis-v2.ts
  lib/
    analysis/            # Shared analysis primitives
      statistics.ts      # computeBaseline, computeTrend, computeDeviation
      correlation.ts     # cross-domain correlation engine
      temporal.ts        # resolveTemporalContext, rollUpPeriod
      synthesis-engine.ts # Multi-DB fetcher + analysis pipeline
    fetchers/            # Parallel data fetchers
      multi-db-fetcher.ts # Fetch from N databases in parallel
      temporal-fetcher.ts # Fetch day/week/month/quarter/year context
    formatters/
      markdown.ts        # Shared markdown formatting
      structured.ts      # JSON output for programmatic consumption
```

### Synthesis Engine Design

```typescript
interface SynthesisContext {
  dateFrom: string;
  dateTo: string;
  temporalContext: {
    day: DayEntry | null;
    week: WeekEntry | null;
    month: MonthEntry | null;
    quarter: QuarterEntry | null;
    year: YearEntry | null;
  };
  data: {
    activities: ActivityEntry[];
    tasks: TaskEntry[];
    finances: FinancialEntry[];
    journals: JournalEntry[];
    projects: ProjectEntry[];
    // ... extensible
  };
}

interface SynthesisResult {
  structured: Record<string, unknown>;  // For programmatic consumption
  markdown: string;                      // For human reading
  insights: Insight[];                   // Actionable findings
  alerts: Alert[];                       // Items needing attention
}

async function runSynthesis(
  context: SynthesisContext,
  analyzers: Analyzer[]
): Promise<SynthesisResult>
```

### Priority Implementation Order

1. **Week 1:** Fix P0 bugs (4 items), create shared analysis library
2. **Week 2:** Build synthesis engine framework + parallel fetcher
3. **Week 3:** Implement health-productivity + financial-productivity synthesis
4. **Week 4:** Implement weekly review + enhanced daily briefing
5. **Week 5:** Implement quarterly retrospective + annual synthesis
6. **Week 6:** Add structured output support + caching layer

---

## Appendix: Database Summary

| # | Database | Agent Domain | Properties | Used in Synthesis |
|---|----------|-------------|------------|:---:|
| 1 | activity_log | productivity | 13 | 7/13 tools |
| 2 | tasks | productivity | 11 | 5/13 tools |
| 3 | activity_types | productivity | 3 | 6/13 tools |
| 4 | projects | strategic | 14 | 3/13 tools |
| 5 | quarterly_goals | strategic | 14 | 2/13 tools |
| 6 | annual_goals | strategic | 13 | 0/13 tools |
| 7 | days | temporal | 14 | 0/13 tools |
| 8 | weeks | temporal | 17 | 0/13 tools |
| 9 | months | temporal | 20 | 1/13 tools (optional) |
| 10 | quarters | temporal | 13 | 0/13 tools |
| 11 | years | temporal | 5 | 0/13 tools |
| 12 | subjective_journal | journaling | 5 | 2/13 tools |
| 13 | relational_journal | journaling | 6 | 3/13 tools |
| 14 | systemic_journal | journaling | 8 | 2/13 tools |
| 15 | financial_log | journaling | 12 | 2/13 tools |
| 16 | diet_log | journaling | 5 | 0/13 tools |
| 17 | directives_risk_log | strategic | 11 | 1/13 tools (count only) |
| 18 | opportunities_strengths | strategic | 8 | 1/13 tools (count only) |
| 19 | people | strategic | 22 | 2/13 tools |
| 20 | campaigns | strategic | 17 | 1/13 tools (count only) |
| 21 | content_pipeline | strategic | 18 | 0/13 tools |
| 22 | reports | productivity | 3 | 0/13 tools |
| 23 | notes_management | productivity | 4 | 0/13 tools |

**Coverage Summary:**
- 6 databases (26%) covered by 2+ synthesis tools
- 7 databases (30%) covered by 1 synthesis tool
- 10 databases (43%) covered by 0 synthesis tools
- 0 databases receive full deep analysis (most are surface-level counts)
