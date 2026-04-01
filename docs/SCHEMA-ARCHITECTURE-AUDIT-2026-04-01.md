# LifeOS Schema Architecture Audit

**Date:** 2026-04-01
**Scope:** Layer 0 (Notion DB cleanliness) + Layer 1 (Tool output relevance)
**Goal:** Ensure databases are clean and tool calls return only relevant fields to the AI agent.

---

## Executive Summary

The dual-flywheel architecture is **fundamentally sound**. The problem is implementation detail:

- **Layer 0:** ~45 properties across all databases can be removed from MCP config (buttons, unused relations, redundant formulas). The Notion databases themselves remain unchanged — we curate what MCP exposes.
- **Layer 1:** Strategic tools use raw property loops instead of typed transformers (unlike activity/task tools which are clean). This causes 50-60% output bloat. Discover tool lists ALL properties by default — massive token cost.
- **Fix is mechanical, not architectural.** Estimated 5 hours of implementation.

---

## Layer 0: Database Schema Cleanliness

### Category A: Button Properties (UI-only, zero MCP value)

Buttons are Notion UI automations. The MCP agent cannot invoke them. They appear as empty properties in every API response.

| Database | Buttons | Count |
|----------|---------|-------|
| tasks | Next Sprint 1-4, Backlog, Done, Current Sprint | 7 |
| days | Activity Log, Custom Log, Yesterday Log | 3 |
| **Total** | | **10** |

**Status:** Already excluded from `lifeos.config.json`. No action needed — but worth knowing they exist in Notion.

### Category B: *_JSON Cache Formulas

Formula fields that serialize page data to JSON. These serve a separate consumer (external scripts, Notion automations), NOT the MCP server.

**Affected:** Activity_JSON, Day_JSON, Week_JSON, Month_JSON, Subjective_JSON, Relational_JSON, Systemic_JSON, Diet_JSON, Financial_JSON, DRL_JSON, Project_JSON, Quarterly_Goal_JSON

**Status:** Already excluded from MCP config. No action needed — they exist for other consumers.

### Category C: Redundant/Overlapping Formulas

| Database | Property | Issue |
|----------|----------|-------|
| projects | Progress + Project Progress | Two similar formula fields — confusing |
| projects | Duration | Overlap with Project Start / Deadline dates |
| projects | Net Cashflow, Revenue, Cost to Date | Financial formulas — no tool reads them |
| months | Accounts Involved | Possibly redundant with Financial Log relation |
| content_pipeline | Engagement Rate | Formula of Engagement ÷ Reach — computable |

**Action:** Remove `project_progress`, `duration`, `net_cashflow`, `revenue`, `cost_to_date` from MCP config.

### Category D: Relations Unused by MCP Tools

| Database | Relation | Why It's Dead Weight |
|----------|----------|---------------------|
| projects | Documents DB | External system, no tool uses it |
| projects | Notes Management | External system, no tool uses it |
| projects | Depends On | Dependency tracking, not surfaced by tools |
| projects | Dependents | Dependency tracking, not surfaced by tools |
| projects | Activity Log | Tools query activity_log directly |
| projects | Financial Log | Month synthesis queries months DB directly |
| projects | Systemic Journal | Not surfaced by any tool |
| projects | Directives & Risks | Not surfaced by project tool |
| projects | Opportunities & Strength | Not surfaced by project tool |
| people | Stories | Not surfaced by any tool |
| people | Community | Not surfaced by any tool |
| content_pipeline | Child Content | Redundant with Parent Content (inverse) |

**Action:** Remove all 12 from MCP config. They exist for the Notion UI but add nothing to the agent's data model.

### Category E: UI-Only Properties

| Database | Property | Purpose |
|----------|----------|---------|
| projects | Justify This Project | Strategic rationale — never surfaced |
| projects | KPI Status | Separate from KPI — rarely used |
| projects | Review Date | Not surfaced by tools |
| campaigns | Automation Workflows (21 options!) | Planning field, no tool references it |
| content_pipeline | Media Assets (files) | Agent can't read files |

**Action:** Remove from MCP config.

### Category F: Naming Inconsistencies

| Database | Issue |
|----------|-------|
| weeks | `activityBreakdown` (camelCase) — all others use snake_case |
| people | `In days Connection Frequency` — should be `Connection Frequency` |
| content_pipeline | Pillar options: P5 appears twice (Counselling, Activism) — should be P4/P5 |

**Action:** Fix property keys in config. The Pillar options are in Notion itself — user must fix manually.

### Summary: Properties to Remove from MCP Config

| Database | Current Props | Remove | Remaining |
|----------|--------------|--------|-----------|
| projects | 33 | ~15 | ~18 |
| tasks | 12 | 0 | 12 |
| people | 28 | 2 | 26 |
| campaigns | 20 | 1 | 19 |
| content_pipeline | 19 | 2 | 17 |
| days | 14 | 0 | 14 |
| weeks | 16 | 0 | 16 |
| months | 22 | 0 | 22 |
| quarterly_goals | 15 | 0 | 15 |
| annual_goals | 18 | 0 | 18 |
| **Total** | **~350** | **~45** | **~305** |

**Net reduction: ~13% less schema bloat in discover tool output.**

---

## Layer 1: Tool Output Relevance

### The Problem

Three patterns cause output bloat:

1. **Raw property loops** — strategic tools iterate ALL config properties and print any non-empty value
2. **"X related" noise** — every relation renders as a separate line ("3 related", "0 related")
3. **No output scoping** — discover tool dumps ALL properties by default; query tool has no return_properties

### Tool-by-Tool Analysis

| Tool | Current Output | Issue | Action |
|------|---------------|-------|--------|
| `lifeos_query` | All properties × all results | No way to scope output | Add `return_properties` param |
| `lifeos_discover` | All properties for all 22 DBs | ~2500 tokens for schema dump | Add `verbose` flag (default: false) |
| `lifeos_projects` | All 33 properties per project | ~20 lines per entry | Create typed transformer |
| `lifeos_quarterly_goals` | All 15 properties | Mixed formula/input fields | Create typed transformer |
| `lifeos_annual_goals` | All 18 properties | Mixed formula/input fields | Create typed transformer |
| `lifeos_directives_risks` | All 13 properties | Already reasonable | Minor cleanup |
| `lifeos_opportunities_strengths` | All 9 properties | Already reasonable | Minor cleanup |
| `lifeos_activity_log` | Typed ActivityEntry | ✅ Clean | None |
| `lifeos_tasks` | Typed TaskEntry | ✅ Clean | None |
| `lifeos_productivity_report` | Typed report | ✅ Clean | None |
| `lifeos_temporal_analysis` | Typed metrics | ✅ Clean | None |
| `lifeos_trajectory` | Typed metrics | ✅ Clean | None |
| `lifeos_weekday_patterns` | Typed profiles | ✅ Clean | None |
| `lifeos_daily_briefing` | Curated per section | ✅ Clean | None |
| `lifeos_find_entry` | Agent-specified (Option C) | ✅ Clean | None |
| Journal tools | Title + date + JSON | ✅ Clean | None |

**The pattern is clear:** Activity and task tools use typed transformers and are clean. Strategic tools use raw loops and are bloated. The fix is to create transformers for strategic databases — exactly like we already do for activities and tasks.

### Curated Field Definitions

#### projects (33 → ~8 lines per entry)

```
Tier 1 (always show):     Status, Priority, Deadline, Progress, Health
Tier 2 (show if non-empty): Project Summary, Strategy, KPI, Project Start
Tier 3 (compact counts):  Tasks(n), People(n), Quarterly Goals(n)
Excluded: ID, Monitor, KPI Status, Review Date, Justify This Project,
  Depends On, Dependents, Documents DB, Notes Management, Campaign Calendar,
  Activity Log, Financial Log, Systemic Journal, Directives & Risks,
  Opportunities & Strength, Projected Revenue, Required Budget, Cost to Date,
  Revenue, Net Cashflow, Duration, Project Progress, Last edited time, Project_JSON
```

#### quarterly_goals (15 → ~7 lines per entry)

```
Tier 1:  Status, Key Result 1, Key Result 2, Key Result 3, Progress, Health
Tier 2:  Key Learning, Monitor
Tier 3:  Projects(n), Annual Goals(n)
Excluded: Quarters, Goal Progress (redundant with Progress), Planned Range,
  Quarterly_Goal_JSON, ID
```

#### annual_goals (18 → ~7 lines per entry)

```
Tier 1:  Status, Strategic Intent, The Epic, Goal Archetype
Tier 2:  Success Condition, Target Value, Strategic Approach, Key Risks
Tier 3:  Quarterly Goals(n), Years(n)
Excluded: Goal Progress, Monitor, Current Annual Goal, Planned Range,
  Annual_Goal_Report, Primary Metric, Vision, ID
```

#### directives_risk_log (13 → ~7 lines per entry)

```
Tier 1:  Log Type, Status, Likelihood, Impact, Threat Level
Tier 2:  Protocol / Scenario, Last Assessed
Tier 3:  Projects(n), Quarterly Goals(n)
Excluded: DRL_JSON, Mitigates / Mitigated By, Systemic Journal, ID
```

#### opportunities_strengths (9 → ~5 lines per entry)

```
Tier 1:  Log Type, Status, Leverage Score
Tier 2:  Description & Activation, Last Assessed
Tier 3:  Projects(n), Quarterly Goals(n)
Excluded: Synergizes With, Systemic Journal
```

### Token Budget Impact

| Component | Current | Improved | Reduction |
|-----------|---------|----------|-----------|
| discover (all) | ~2,500 tokens | ~500 tokens | **80%** |
| projects (10 entries) | ~1,000 tokens | ~500 tokens | **50%** |
| query (50 results, all props) | ~10,000 tokens | ~2,500 tokens | **75%** |
| **Typical session (5-10 calls)** | **~15K tokens** | **~5K tokens** | **~67%** |

---

## Implementation Plan

### Phase 1: Config Cleanup (30 min) — Quick Win

Edit `lifeos.config.json` to remove dead-weight properties:

```json
// projects — remove these keys:
"documents_db", "notes_management", "depends_on", "dependents",
"activity_log", "financial_log", "systemic_journal",
"directives_risks", "opportunities_strengths",
"kpi_status", "review_date", "justify_this_project",
"projected_revenue", "required_budget", "cost_to_date",
"revenue", "net_cashflow", "duration", "project_progress"

// people — remove:
"community", "stories"

// content_pipeline — remove:
"child_content", "media_assets"
```

### Phase 2: Strategic Transformers (2-3 hours)

Create `src/transformers/strategic.ts` with typed interfaces:

```typescript
interface ProjectEntry {
  id: string; name: string; status: string; priority: string;
  deadline: string; projectStart: string; progress: number | null;
  health: string; summary: string; strategy: string; kpi: string;
  taskCount: number; peopleCount: number; qGoalCount: number;
}

interface QuarterlyGoalEntry { ... }
interface AnnualGoalEntry { ... }
interface DirectiveRiskEntry { ... }
interface OpportunityStrengthEntry { ... }
```

Refactor `src/tools/strategic.ts` to use these transformers instead of the raw property loop.

### Phase 3: Discover Condensed Mode (30 min)

Add `verbose: boolean` parameter to `lifeos_discover`:
- Default (false): `### Projects (\`projects\`) — 18 properties | strategic`
- Verbose (true): Current full property listing

### Phase 4: Query return_properties (30 min)

Add `return_properties: string[]` to `lifeos_query`:
- If specified: only extract and display those properties
- If omitted: current behavior (all properties, backward compatible)

### Phase 5: Relation Count Formatting (1 hour)

Replace multi-line "X related" output with compact format:
```
# Before (12 lines):
- **tasks:** 5 related
- **people:** 2 related
- **campaigns:** 0 related
...

# After (1 line):
🔗 Tasks(5) People(2) Q Goals(1) Risks(3)
```

### Total Effort: ~5 hours

---

## Workflow Validation

Every synergistic workflow was verified against curated fields:

| Workflow | Required Fields | Preserved? |
|----------|----------------|------------|
| Morning Briefing | tasks (status, priority, date), activities (type, duration) | ✅ |
| Weekly Review | productivity, temporal, trajectory (all already clean) | ✅ |
| Task Prioritization | trajectory gaps, active tasks, project (name/status/priority/deadline) | ✅ |
| Task Completion | find_entry → update_entry | ✅ |
| After Connecting | find_entry (people) → update_entry → create_entry | ✅ |
| Content Pipeline | find_entry → update_entry (status, URL, metrics) | ✅ |
| Missing Data Recovery | activity_log → weekday_patterns → create_entry | ✅ |

**No workflow requires any of the removed/curated-out fields.**

---

## Appendix: Why Activity/Task Tools Are Already Clean

The `transformActivity()` and `transformTask()` functions return typed interfaces with exactly the fields each tool needs. The strategic tools bypass this pattern and do raw extraction. The fix is simply to extend the transformer pattern to strategic databases — a proven, existing architecture.

The root cause: activity_log and tasks were built first with transformers. Strategic databases were added later using a generic "dump everything" loop. It worked but produced bloated output. The solution is mechanical: apply the same transformer pattern.
