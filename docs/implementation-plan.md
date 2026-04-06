# LifeOS MCP — Implementation Plan

**Date:** 2026-04-03
**Status:** Phase 1 Complete, Phase 2 Ready
**Version:** 1.0

---

## What Was Done (Phase 1 — Completed)

### 1. Removed Hardcoded Thresholds
**File:** `src/transformers/productivity.ts`
- Removed hardcoded `40%` recreation threshold judgment
- Removed hardcoded `2h/day` minimum activity threshold
- Changed from `"⚠️ Recreation is 45% (>40% threshold)"` → `"Recreation is 45% of tracked time"`
- Changed from `"⚠️ Low activity tracking"` → `"Low activity tracking"`
- Changed from `"⚠️ X overdue task(s) need attention"` → `"X overdue task(s)"`
- Removed ASCII bars (`█░`) and `"⚠️ HIGH"` flags from time allocation output

### 2. Removed Generic Advice
**File:** `src/tools/daily-briefing.ts`
- Changed `"No active tasks. Consider reviewing your project backlog."` → `"No active tasks."`

### 3. Removed Navigation Hints
**Files:** `src/tools/productivity.ts`, `src/tools/temporal-analysis.ts`, `src/tools/trajectory.ts`
- Removed `"Next: Use lifeos_X"` suffixes from all three tools

### 4. Fixed Incomplete Data — Project Health
**File:** `src/tools/project-health.ts`
- Now fetches actual risk content (name, status, likelihood, impact, threat level) instead of just showing `"Risks(3)"`
- Now fetches actual opportunity content (name, status, leverage score) instead of just showing `"Opps(2)"`
- Removed emoji badges (`🔥`, `💡`, `⚠️`)
- Shows deadline urgency in text format (`"12d left"`, `"3d overdue"`) instead of emoji badges

### 5. Fixed Incomplete Data — OKRs Progress
**File:** `src/tools/okrs-progress.ts`
- Removed heuristic `"⚠️ No projects linked"` blocked flag
- Zero projects may be correct (exploratory OKRs) — not a blocked state

### 6. Fixed Incomplete Data — Alignment
**File:** `src/tools/alignment.ts`
- Removed hardcoded `"⚠️ No linked projects — coverage gap"` judgment

### 7. Added Helper Function
**File:** `src/transformers/shared.ts`
- Added `extractRelationIds()` to extract relation page IDs for content fetching

### Build Status
✅ `npm run build` compiles cleanly with no TypeScript errors.

---

## What Needs to Be Done (Phase 2 — Ready to Implement)

### Task 1: Remove Remaining Navigation Hints
**Files:** `src/tools/daily-briefing.ts`, `src/tools/weekday-patterns.ts`

Check if these tools have navigation hints and remove them. Tool descriptions should cover tool synergy instead.

**Estimated effort:** 30 minutes

---

### Task 2: Update Tool Descriptions
**Files:** All synthesis tool registrations in `src/tools/*.ts`

Tool descriptions must be comprehensive so agents understand when and how to use each tool, and what complementary tools exist. This replaces the removed "Next steps" hints.

**Template:**
```
lifeos_TOOL_NAME — [What it does in one sentence]. [Key outputs]. [Parameters]. Use with: lifeos_X (for Y context), lifeos_Z (for W analysis).
```

**Priority tools to update:**
1. `productivity.ts` — Add `recreationThreshold` param note if added
2. `daily-briefing.ts` — Mention all sections it covers
3. `temporal-analysis.ts` — Mention `include_financial` and `scope` params
4. `trajectory.ts` — Mention it uses Activity Types targets
5. `project-health.ts` — Mention it now shows actual risk/opp content
6. `alignment.ts` — Document all 3 actions

**Estimated effort:** 2 hours

---

### Task 3: Add New Computation Tools

#### 3a. `health_vitality` — Health Score Computation
**File:** `src/tools/health-vitality.ts` (NEW)
**DBs:** `diet_log`, `activity_log`, `subjective_journal`, `activity_types`
**Purpose:** Compute daily/weekly health score from nutrition, sleep, exercise, mood data.
**Output:** Structured markdown with component scores, 7-day trends, notable patterns.
**Parameters:** `period`, `date`, `includeTrends?: boolean`

**Estimated effort:** 4 hours

#### 3b. `financial_productivity` — ROI Computation
**File:** `src/tools/financial-productivity.ts` (NEW)
**DBs:** `financial_log`, `activity_log`, `projects`, `activity_types`
**Purpose:** Compute revenue/hour, expense patterns, project-level P&L.
**Output:** Structured markdown with revenue analysis, expense breakdown, net metrics.
**Parameters:** `period`, `byProject?: boolean`, `includeExpenses?: boolean`

**Estimated effort:** 4 hours

#### 3c. `weekly_review` — Pre-aggregated Weekly Data
**File:** `src/tools/weekly-review.ts` (NEW)
**DBs:** `weeks`, `activity_log`, `tasks`, `financial_log`, `projects`, `diet_log`, `subjective_journal`
**Purpose:** Holistic weekly snapshot across all domains.
**Output:** Structured markdown with time, tasks, finance, projects, health, mood sections + week-over-week changes.
**Parameters:** `week_number?: number`, `date?: string`, `includeHealth?: boolean`

**Estimated effort:** 4 hours

#### 3d. `correlate` — Statistical Correlation Engine
**File:** `src/tools/correlate.ts` (NEW)
**DBs:** Any two measurable domains
**Purpose:** Compute Pearson correlation, lag analysis, conditional probability between any two time series.
**Output:** Structured markdown with correlation coefficient, lag analysis, conditional probability table.
**Parameters:** `domain_a`, `domain_b`, `period`, `lag_days?: number`

**Estimated effort:** 6 hours

**Total Phase 3 effort:** ~18 hours

---

### Task 4: Add New Data Enrichment Tools

#### 4a. `monthly_synthesis` — Month-Level Rollup
**File:** `src/tools/monthly-synthesis.ts` (NEW)
**DBs:** `months`, `activity_log`, `tasks`, `projects`, `quarterly_goals`, `financial_log`, `diet_log`, `subjective_journal`, `relational_journal`, `content_pipeline`
**Purpose:** Month-level performance review across all domains.
**Output:** Structured markdown with overall score, per-domain scores, month-over-month trends table.
**Parameters:** `month?: string`, `includeRelationships?: boolean`, `includeContent?: boolean`

**Estimated effort:** 6 hours

#### 4b. `quarterly_retrospective` — Quarter-Level Rollup
**File:** `src/tools/quarterly-retrospective.ts` (NEW)
**DBs:** `quarters`, `quarterly_goals`, `annual_goals`, `projects`, `financial_log`, `activity_log`, `tasks`, `campaigns`, `content_pipeline`, `directives_risk_log`, `opportunities_strengths`, `systemic_journal`
**Purpose:** Quarterly strategic review with OKR alignment and year trajectory.
**Output:** Structured markdown with OKR results, project outcomes, financial summary, risk evolution, strategic reflections.
**Parameters:** `quarter?: string`, `year?: string`

**Estimated effort:** 6 hours

**Total Phase 4 effort:** ~12 hours

---

### Task 5: Enhance Existing Tools

#### 5a. `temporal_analysis` — Multi-Domain Support
**File:** `src/tools/temporal-analysis.ts`
**Enhancements:**
- Add `tasks` — task completion trends
- Add `financial_log` — financial trends (make `include_financial` default `true` for month scope)
- Add `diet_log` — health trends
- Use `Weeks` DB for pre-aggregated data instead of re-computing

**Estimated effort:** 4 hours

#### 5b. `trajectory` — Cross-Domain Trajectories
**File:** `src/tools/trajectory.ts`
**Enhancements:**
- Add task completion trajectory
- Add financial trend trajectory
- Make key activities dynamic from targets (currently hardcoded: `["Work", "Recreation", "Sleep", "Workout"]`)

**Estimated effort:** 3 hours

#### 5c. `journal_synthesis` — Content Analysis
**File:** `src/tools/journal-synthesis.ts`
**Enhancements:**
- Analyze actual journal content (psychograph, relational notes, systemic notes), not just titles
- Return keyword frequency data in table format
- Show cross-journal theme overlap

**Estimated effort:** 4 hours

**Total Phase 5 effort:** ~11 hours

---

## Total Effort Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| **Phase 1 — Completed** | Hardcoded removals, incomplete data fixes | ✅ Done |
| **Phase 2 — Cleanup** | Remaining navigation hints, tool descriptions | 2.5 hours |
| **Phase 3 — New Computation** | health_vitality, financial_productivity, weekly_review, correlate | 18 hours |
| **Phase 4 — New Enrichment** | monthly_synthesis, quarterly_retrospective | 12 hours |
| **Phase 5 — Enhance Existing** | temporal_analysis, trajectory, journal_synthesis | 11 hours |
| **Total Remaining** | | **~43.5 hours** |

**Timeline:** 6-8 working days for a single developer.

---

## Implementation Order

Recommended order to maximize incremental value:

1. **Week 1:** Phase 2 (cleanup) + Phase 3a (health_vitality) + Phase 3b (financial_productivity)
   - Immediate value: health and financial insights
   - Low risk: new tools, no existing code changes

2. **Week 2:** Phase 3c (weekly_review) + Phase 3d (correlate) + Phase 5c (journal_synthesis)
   - Weekly review is high-value for regular use
   - Correlate enables cross-domain analysis
   - Journal synthesis fix improves existing tool

3. **Week 3:** Phase 4a (monthly_synthesis) + Phase 4b (quarterly_retrospective) + Phase 5a/5b (enhance temporal/trajectory)
   - Completes the temporal hierarchy (daily → weekly → monthly → quarterly)
   - Enhances existing tools with multi-domain support

---

## Architecture Notes

### Shared Library (Optional but Recommended)
Create `src/lib/analysis/` for shared computation:
- `statistics.ts` — mean, stdDev, z-score, linear regression, Pearson correlation
- `temporal.ts` — already exists, extend with more functions
- `formatters.ts` — shared markdown table generation

This avoids code duplication across new tools.

### Testing Strategy
- Each new tool should have at least one manual test via MCP client
- Verify output format matches the structured markdown spec
- Verify all parameters work correctly
- Verify edge cases (empty data, single data point, missing DBs)

---

## Success Criteria

After all phases complete:
- ✅ No hardcoded thresholds or judgments in any tool
- ✅ All tools show actual content, not just counts
- ✅ No navigation hints in output (moved to descriptions)
- ✅ 20 tools total (14 existing + 6 new)
- ✅ All 23 databases covered by at least 1 synthesis tool
- ✅ Cross-domain correlation capability via `correlate` tool
- ✅ Full temporal hierarchy: daily → weekly → monthly → quarterly
- ✅ Health and financial insights available as first-class synthesis
