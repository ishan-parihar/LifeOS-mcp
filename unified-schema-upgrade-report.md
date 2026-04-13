# LifeOS Unified Database Schema Upgrade Report — V2 (Lean)

**Generated:** 2026-04-10
**Architect:** Schema Synthesizer
**Scope:** 23 existing databases → 24 databases (+1 new), lean property additions
**Philosophy:** Breadth over depth. Minimize properties. Maximize entry text. Let the body do the work.

---

## 1. Executive Summary

### What Changed Since V1

V1 ballooned to **~734 properties across 28 databases** — unmanageable overhead. V2 corrects:

| Metric | V1 (Rejected) | V2 (This) |
|---|---|---|
| Databases | 28 (+5 new) | **24 (+1 new)** |
| Net new properties | ~390 | **~85** |
| Properties removed | 42 | **12** |
| Formula properties | ~112 | **~20** |
| Rollup properties | ~77 | **~15** |

### Core Corrections

1. **`monitor` properties are NOT dead data** — they are sophisticated Notion formula widgets that aggregate health signals, pacing, blockers, and attention items into rich-text status cards visible on the Notion dashboard. **KEEP all monitor formulas.**
2. **`*_JSON` properties serve MCP tools** — they format structured data for the LifeOS MCP server. If MCP computes server-side, they become redundant. **KEEP until MCP migration confirmed.**
3. **`activity_type` is a FORMULA (parsed from title), not a Select** — the current system derives type via `ifs(title.contains("Workout"), "Workout", ...)`. Changing to Relation requires rewriting all existing entries.
4. **Physician collapses into `diet_log` only** — no separate `health_interventions` DB. Diet Log becomes the single biological/somatic/hormonal/chemical/atomic log.
5. **Only 1 new database** — `financial_accounts`. Budget logic goes as formula rollups in financial_log, not a separate DB.

---

## 2. Design Philosophy

### Breadth > Depth

LifeOS captures everything. The schema should be **lightweight enough to log effortlessly**, but **structured enough for agents to query across domains**.

- **Properties exist to enable cross-DB queries and rollups**, not to replace journaling.
- **Page body (text) is for depth** — longer entries, narrative, context.
- **Properties are for breadth** — filterable, sortable, formula-computable signals.
- **Every property must earn its place**: "Can an agent use this to compute something, filter something, or relate something?"
- **If the answer is "it helps the human read the row" — don't add it.**

### The 3-Question Test (Every Property)

1. Does an agent **query/filter** by this?
2. Does a **formula/rollup** compute from this?
3. Does another DB **relate** to this?

If no to all three → it's management overhead, not system intelligence.

---

## 3. Per-Database Changes

### Ownership Convention
- **CEO** = Strategic oversight
- **COO** = Operations, scheduling
- **CPO** = Psychological/emotional
- **CRO** = Relational/network
- **CFO** = Financial/capital
- **CMO** = Content/marketing
- **PHY** = Physician/health
- **SYS** = System-level (all read)
- **DASH** = Dashboard formula (notion frontend widget)

---

### 3.1 Activity Log (`activity_log`)

**Current:** 13 properties → **Unified:** 17 properties (+4)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1 | `title` | Title | COO | KEEP | Activity identifier (parsed for type) |
| 2 | `date` | Date | COO | KEEP | Date range |
| 3 | `activity_type` | **Formula** | COO | KEEP (as formula) | Derived from title — DO NOT change to Relation (breaks migration) |
| 4 | `duration` | Formula | COO | KEEP | Auto: end - start |
| 5 | `activity_notes` | Formula | COO | KEEP | Notes extracted from title |
| 6 | `habit` | Formula | COO | KEEP | Derived from activity_type |
| 7 | `logged` | Checkbox | COO | KEEP | Manual confirmation flag |
| 8 | `activity_json` | Formula | COO | KEEP | MCP-serving JSON |
| 9 | `days` | Relation | COO | KEEP | Temporal link |
| 10 | `projects` | Relation | COO | KEEP | Project linkage |
| 11 | `date_end` | Formula | COO | KEEP | End of date range |
| 12 | `id` | Unique ID | SYS | KEEP | ACT-123 |
| 13 | `name` | Title | COO | KEEP | Title field |
| — | `energy` | Select | PHY | ADD | High/Medium/Low (single field, physician) |
| — | `mood_delta` | Select | PHY | ADD | ↑/→/↓ (post vs pre) |
| — | `notes_body` | Rich Text | COO | ADD | Free-text context (move from formula-based activity_notes) |
| — | `activity_type_rel` | Relation | COO | ADD | Relation to activity_types (parallel to formula, enables future rollups without breaking current system) |

**Key Decision:** `activity_type` stays as formula for backward compatibility. `activity_type_rel` added as a Relation for future use — agents can use whichever is available during transition.

**Formulas added:** None (keep existing dashboard formulas)

---

### 3.2 Activity Types (`activity_types`)

**Current:** 4 properties → **Unified:** 7 properties (+3)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1 | `title` | Title | COO | KEEP | Activity name |
| 2 | `frequency` | Select | COO | KEEP | How often |
| 3 | `duration` | Number | COO | KEEP | Target hours |
| 4 | `habit` | Select | COO | KEEP | Habit flag |
| — | `category` | Select | PHY | ADD | Exercise/Recovery/Nutrition/Work/Mindfulness/Social/Chore/Commute/Entertainment/Learning |
| — | `is_health_tracked` | Checkbox | PHY | ADD | Should this activity log health data? |
| — | `target_per_week` | Number | COO | ADD | Weekly frequency target |

**Why these 3 additions:** `category` enables cross-domain filtering (COO sees "Work" types, PHY sees "Exercise" types). `is_health_tracked` tells Physician which activities to correlate with biological data. `target_per_week` gives COO a baseline for compliance calculation.

---

### 3.3 Days (`days`)

**Current:** 14 properties → **Unified:** 15 properties (+1)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-13 | (all existing) | Various | COO | KEEP ALL | All current properties including Day_JSON formula |
| 14 | `year` | Number | COO | KEEP | Derivable but explicit for rollups |
| 15 | `status` | Formula | COO | KEEP | Dashboard widget |
| — | `health_score` | Formula | PHY | ADD | 1-10 composite: sleep_quality + energy + mood + activity_compliance |

**Key Decision:** Days already has a massive `Day_JSON` formula that aggregates all journal DBs. DO NOT add more properties. The single `health_score` formula is the only PHY addition — it gives agents a daily health signal without requiring them to parse all journal entries.

**Formulas:** Keep existing Day_JSON, Status, Day Name. Add `health_score`.

---

### 3.4 Weeks (`weeks`)

**Current:** 18 properties → **Unified:** 18 properties (no changes)

Weeks already has solid rollup infrastructure (total_income, total_expenses, net_cashflow). The `activity_breakdown`, `category_summary`, and `week_json` are all formula-generated. **No additions, no removals.** The week-level aggregation is already working.

---

### 3.5 Months (`months`)

**Current:** 22 properties → **Unified:** 22 properties (no changes)

Same as weeks. Monthly aggregation is already structured with financial rollups, category summaries, and JSON export. **No changes needed.**

---

### 3.6 Tasks (`tasks`)

**Current:** 11 properties → **Unified:** 15 properties (+4)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-10 | (existing) | Various | COO | KEEP ALL | Including Monitor formula |
| — | `sprint_status` | Formula | COO | KEEP | Dashboard widget |
| — | `parent_task` | Relation | COO | KEEP | Self-relation |
| — | `sub_task` | Relation | COO | KEEP | Self-relation |
| — | `estimated_hours` | Number | COO | ADD | Capacity planning |
| — | `completed_date` | Date | COO | ADD | Auto-set when Done |
| — | `tags` | Multi-select | COO | ADD | Quick categorization |
| — | `blocked_by` | Relation | COO | ADD | Self-relation (dependency) |

**Key Decision:** Monitor formula is critical — DO NOT remove. The 4 additions are the minimum for COO to do capacity planning and dependency tracking. No deadline, no priority changes (both exist).

---

### 3.7 Projects (`projects`)

**Current:** 14 properties → **Unified:** 18 properties (+4)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-13 | (existing) | Various | CEO | KEEP ALL | Including Health, Progress, KPI |
| 14 | `campaigns` | Relation | CMO | KEEP | Campaign linkage |
| — | `phase` | Select | CEO | ADD | Discovery/Planning/Execution/Launch/Maintenance/Winding-down |
| — | `budget_allocated` | Number | CFO | ADD | Capital assigned |
| — | `budget_spent` | Rollup | CFO | ADD | From financial_log |
| — | `team` | Relation → people | CRO | ADD | People involved (rename from existing `people` if needed) |

**Key Decision:** Projects is the hub DB. It already has 14 properties. Only 4 additions — the minimum for financial tracking (budget) and lifecycle tracking (phase). No psychological dimensions, no CMO dimensions, no content dimensions. Those go in the body text.

---

### 3.8 Quarterly Goals (`quarterly_goals`)

**Current:** 15 properties → **Unified:** 15 properties (no changes)

Already has sophisticated Monitor, Health, and Goal Progress formulas. Key Results are structured as rich text. **No changes.** The formula engine here is well-tuned.

---

### 3.9 Annual Goals (`annual_goals`)

**Current:** 15 properties → **Unified:** 15 properties (no changes)

Same as quarterly goals. Monitor formula aggregates quarterly goal health. **No changes.**

---

### 3.10 Directives & Risk Log (`directives_risk_log`)

**Current:** 12 properties → **Unified:** 12 properties (no changes)

Has DRL_JSON formula, Threat Level formula, and solid relations. **No changes.**

---

### 3.11 Opportunities & Strengths (`opportunities_strengths`)

**Current:** 7 properties → **Unified:** 9 properties (+2)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-7 | (existing) | Various | CEO | KEEP ALL | |
| — | `opportunity_type` | Select | CEO | ADD | Market/Technology/Partnership/Talent/Capital/Competitive |
| — | `activation_date` | Date | CEO | ADD | When activated |

**Why these 2:** Opportunity type enables filtering by domain. Activation date tracks time-to-action. That's it.

---

### 3.12 People (`people`)

**Current:** 27 properties → **Unified:** 30 properties (+3)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-26 | (existing) | Various | CRO | KEEP ALL | Including all CPO psychological fields |
| 27 | `connection_frequency` | Number | CRO | KEEP | Days between contact |
| — | `email` | Email | CRO | ADD | Direct contact |
| — | `timezone` | Select | CRO | ADD | IST/EST/PST/GMT/GST |
| — | `last_interaction_sentiment` | Select | CRO | ADD | Positive/Neutral/Tense/Negative |

**Key Decision:** People already has 27 properties — the most in the system. DO NOT remove any psychological fields (developmental_altitude, primary_center_of_intelligence, etc.) — these are core CRO/CPO intelligence. The 3 additions are the absolute minimum for operational contact management.

---

### 3.13 Campaigns (`campaigns`)

**Current:** 20 properties → **Unified:** 22 properties (+2)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-19 | (existing) | Various | CMO | KEEP ALL | |
| — | `status` | Select | CMO | ADD | Planning/Active/Paused/Completed/Archived |
| — | `budget_allocated` | Number | CFO | ADD | Campaign budget |

**Why these 2:** Campaigns lacks a status field — every other strategic DB has one. Budget is the minimum for CFO attribution.

---

### 3.14 Content Pipeline (`content_pipeline`)

**Current:** 21 properties → **Unified:** 23 properties (+2)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-21 | (existing) | Various | CMO | KEEP ALL | |
| — | `topic_hook` | Text | CMO | ADD | What the piece is about (1 line) |
| — | `evergreen` | Checkbox | CMO | ADD | Evergreen vs time-bound |

**Why these 2:** topic_hook enables searchability. evergreen enables content ROI analysis over time.

---

### 3.15 Systemic Journal (`systemic_journal`)

**Current:** 10 properties → **Unified:** 10 properties (no changes)

Already has relations to projects, goals, directives. AI Generated Report field serves dashboard. **No changes.**

---

### 3.16 Subjective Journal (`subjective_journal`)

**Current:** 6 properties → **Unified:** 10 properties (+4)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1 | `title` | Title | CPO | KEEP | Entry name |
| 2 | `id` | Unique ID | SYS | KEEP | SJ-123 |
| 3 | `date` | Date | CPO | KEEP | Entry date |
| 4 | `days` | Relation | CPO | KEEP | → days |
| 5 | `psychograph` | Rich Text | CPO | KEEP | Free-form narrative |
| 6 | `subjective_json` | Formula | CPO | KEEP | MCP-serving JSON |
| — | `energy_level` | Select | CPO | ADD | 1-10 |
| — | `stress_level` | Select | CPO | ADD | 1-5 |
| — | `mood_trigger` | Multi-select | CPO | ADD | Work/Relationship/Health/Finance/Weather/Other |
| — | `sleep_hours` | Number | CPO | ADD | Hours slept |

**Philosophy:** 4 additions only. Energy, stress, mood_trigger, sleep_hours — the minimum for CPO pattern detection. Everything else (emotional valence, arousal, dominance, clarity, etc.) goes in the psychograph body text.

---

### 3.17 Relational Journal (`relational_journal`)

**Current:** 7 properties → **Unified:** 10 properties (+3)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-6 | (existing) | Various | CRO | KEEP ALL | |
| 7 | `relational_json` | Formula | CRO | KEEP | MCP-serving JSON |
| — | `interaction_type` | Select | CRO | ADD | 1:1 Call/Meeting/Text/Email/Event/Group |
| — | `sentiment` | Select | CRO | ADD | Positive/Neutral/Tense/Negative |
| — | `follow_up_needed` | Checkbox | CRO | ADD | Requires action |

**Why these 3:** Interaction type enables filtering (CRO can see "all 1:1 calls this month"). Sentiment enables trend tracking. Follow-up needed is the only actionable flag.

---

### 3.18 ⭐ Diet Log → Biological Log (`diet_log`)

**Current:** 6 properties → **Unified:** 18 properties (+12)

**This is the big change.** Diet Log becomes the **single Physician/biological/somatic/hormonal/chemical/atomic logging database**. Renamed conceptually (Notion display name can stay "Diet Log" or change to "Biological Log").

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1 | `title` | Title | PHY | KEEP | Entry identifier |
| 2 | `id` | Unique ID | SYS | KEEP | DIET-123 / BIO-123 |
| 3 | `date` | Date | PHY | KEEP | When |
| 4 | `days` | Relation | PHY | KEEP | → days |
| 5 | `nutrition` | Rich Text | PHY | KEEP | Free-form nutrition/biological narrative |
| 6 | `diet_json` | Formula | PHY | KEEP | MCP-serving JSON |
| — | `log_type` | Select | PHY | ADD | **Meal/Supplement/Medication/Symptom/Vitals/Mood/Hormonal/Exercise-Recovery/Environmental** |
| — | `meal_type` | Select | PHY | ADD | Breakfast/Morning Snack/Lunch/Evening Snack/Dinner/Late Night (only relevant when log_type=Meal) |
| — | `calories` | Number | PHY | ADD | kcal |
| — | `protein_g` | Number | PHY | ADD | grams |
| — | `water_ml` | Number | PHY | ADD | milliliters |
| — | `caffeine_mg` | Number | PHY | ADD | mg |
| — | `supplements` | Multi-select | PHY | ADD | Creatine/Whey/Vit D/Magnesium/Omega3/Zinc/Iron/Other |
| — | `symptoms` | Multi-select | PHY | ADD | Headache/Fatigue/Nausea/Dizziness/Brain Fog/Joint Pain/Digestive/Skin Rash/Other |
| — | `vitals_notes` | Rich Text | PHY | ADD | HR/HRV/BP/Temp/Weight/O2 — free-form |
| — | `energy_level` | Select | PHY | ADD | 1-10 |
| — | `sleep_quality` | Select | PHY | ADD | Poor/Fair/Good/Excellent |
| — | `mood` | Select | PHY | ADD | Low/Neutral/Good/Great/Euphoric |
| — | `environment` | Multi-select | PHY | ADD | Indoor/Outdoor/Polluted/AC/Nature/Office/Gym/Home |

**Design Rationale:**

- **`log_type`** is the master filter. An entry can be a meal, a symptom log, a vitals check, a supplement intake, a hormonal observation, etc. This collapses what would have been 4-5 separate databases into one.
- **Core structured fields** (calories, protein, water, caffeine, supplements) are the only numeric fields. Everything else (vitals, symptoms, mood, energy) uses Select/Multi-select for filterability.
- **`nutrition` rich text** remains for free-form meal descriptions. **`vitals_notes`** rich text for vitals narrative. **Depth goes in the body.**
- **No health_interventions DB.** Interventions are logged as entries with `log_type=Supplement` or `log_type=Medication` and tracked over time via date filtering and symptom correlation.

**What this replaces from V1:**
- V1 had 40 properties on diet_log + a separate 20-property health_interventions DB = 60 properties
- V2 has **18 properties total** on a single database
- Agents still get everything they need: filter by log_type, rollup daily protein/calories/water, correlate symptoms with meals, track supplement compliance over time

**Formulas:**
- `daily_calories` — rollup from days (PHY)
- `daily_protein` — rollup from days (PHY)
- `daily_water` — rollup from days (PHY)

---

### 3.19 Financial Log (`financial_log`)

**Current:** 13 properties → **Unified:** 17 properties (+4)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-12 | (existing) | Various | CFO | KEEP ALL | Including financial_json |
| 13 | `financial_json` | Formula | CFO | KEEP | MCP-serving JSON |
| — | `signed_amount` | Number | CFO | ADD | Positive=income, Negative=expense (replaces amount + transaction_type duality) |
| — | `recurring` | Checkbox | CFO | ADD | Is this recurring? |
| — | `receipt_url` | URL | CFO | ADD | Audit trail |
| — | `account` | Relation | CFO | ADD | → financial_accounts (new DB) |

**Key Decision:** `signed_amount` is the single source of truth. Positive = income, negative = expense. `amount` and `transaction_type` remain during migration but agents should use `signed_amount`.

---

### 3.20 ⭐ New: Financial Accounts (`financial_accounts`)

**Current:** 0 properties → **New:** 10 properties

**Purpose:** Balance sheet — assets, liabilities, net worth tracking.

| # | Property | Type | Purpose |
|---|---|---|---|
| 1 | `title` | Title | Account name |
| 2 | `account_type` | Select | Checking/Savings/Credit Card/Investment/Brokerage/Crypto/Cash/Loan/Mortgage |
| 3 | `balance_current` | Number | Current balance |
| 4 | `balance_as_of` | Date | Last reconciliation |
| 5 | `currency` | Select | INR/USD/EUR |
| 6 | `is_active` | Checkbox | Include in totals |
| 7 | `institution` | Text | Bank/broker name |
| 8 | `interest_rate` | Number | % |
| 9 | `financial_log` | Relation | → financial_log |
| 10 | `months` | Relation | → months (snapshots) |

**Why this is the ONLY new DB:** Financial accounts are a critical gap. Without them, CFO cannot compute net worth, track utilization, or attribute transactions to accounts. Budget_lines can be handled as rollups on financial_log (filter by category, compare to target).

---

### 3.21 Reports (`reports`)

**Current:** 3 properties → **Unified:** 5 properties (+2)

| # | Property | Type | Owner | Action | Purpose |
|---|---|---|---|---|---|
| 1-3 | (existing) | Various | COO | KEEP ALL | |
| — | `report_type` | Select | COO | ADD | Daily/Weekly/Monthly/Quarterly/Ad-hoc |
| — | `period_covered` | Date Range | COO | ADD | Time range |

---

### 3.22-3.23 Notes Management, Quarters, Years

**No changes.**

---

### 3.24 Dropped from V1

| V1 Proposal | V2 Decision | Reason |
|---|---|---|
| `health_interventions` DB | **DROPPED** | Collapsed into diet_log with `log_type` field |
| `budget_lines` DB | **DROPPED** | Budget tracking via financial_log rollups |
| `network_map` DB | **DROPPED** | Network topology is implicit in people.referred_by relations |
| `social_events` DB | **DROPPED** | Event logging via relational_journal entries |
| 42 property removals | **Reduced to 12** | Monitor and JSON properties are functional, not dead |

---

## 4. Properties for Removal (12)

| Database | Property | Type | Rationale |
|---|---|---|---|
| days | `day_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| weeks | `week_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| weeks | `week_name` | Text | Redundant with title |
| months | `month_name` | Text | Redundant with title |
| months | `month_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| quarterly_goals | `quarterly_goal_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| annual_goals | `annual_goal_report` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| directives_risk_log | `drl_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| systemic_journal | `systemic_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| subjective_journal | `subjective_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| relational_journal | `relational_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| financial_log | `financial_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| diet_log | `diet_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |
| activity_log | `activity_json` | Formula | **KEEP** — MCP-serving, DO NOT remove |

**Correction from V1:** ALL `*_json` properties are **formula-generated JSON for MCP server consumption**. They are NOT dead data. Removing them breaks MCP tools. The only truly redundant properties are `week_name` and `month_name`.

**Actual removals: 2 properties** (`week_name`, `month_name`)

---

## 5. Final Statistics

### Database Count

| Metric | Before | After | Change |
|---|---|---|---|
| Total databases | 23 | **24** | +1 |
| New databases | 0 | 1 | financial_accounts |
| Dropped V1 proposals | 4 | 0 | health_interventions, budget_lines, network_map, social_events |

### Property Count

| Database | Before | After | Added | Net Change |
|---|---|---|---|---|
| activity_log | 13 | 17 | 4 | +4 |
| activity_types | 4 | 7 | 3 | +3 |
| days | 14 | 15 | 1 | +1 |
| weeks | 18 | 18 | 0 | 0 |
| months | 22 | 22 | 0 | 0 |
| tasks | 11 | 15 | 4 | +4 |
| projects | 14 | 18 | 4 | +4 |
| quarterly_goals | 15 | 15 | 0 | 0 |
| annual_goals | 15 | 15 | 0 | 0 |
| directives_risk_log | 12 | 12 | 0 | 0 |
| opportunities_strengths | 7 | 9 | 2 | +2 |
| people | 27 | 30 | 3 | +3 |
| campaigns | 20 | 22 | 2 | +2 |
| content_pipeline | 21 | 23 | 2 | +2 |
| systemic_journal | 10 | 10 | 0 | 0 |
| subjective_journal | 6 | 10 | 4 | +4 |
| relational_journal | 7 | 10 | 3 | +3 |
| diet_log | 6 | 18 | 12 | +12 |
| financial_log | 13 | 17 | 4 | +4 |
| financial_accounts | 0 | 10 | 10 | +10 (NEW) |
| reports | 3 | 5 | 2 | +2 |
| notes_management | 5 | 5 | 0 | 0 |
| quarters | 13 | 13 | 0 | 0 |
| years | 7 | 7 | 0 | 0 |
| **TOTAL** | **~283** | **~370** | **~87** | **+87** |

### Formula/Rollup Summary

| Type | Count | Notes |
|---|---|---|
| New formulas | ~8 | health_score (days), daily_calories/protein/water (diet_log rollups) |
| Existing formulas kept | ~20 | All monitors, all *_JSON, all dashboard widgets |
| New rollups | ~5 | diet_log → days aggregations |
| New relations | ~5 | activity_type_rel, account (financial_log), team (projects), etc. |

---

## 6. Implementation Plan

### Phase 1: Non-Destructive (Week 1)

Safe additions that don't affect existing data:

1. **Add structured fields to diet_log** (12 properties) — `log_type`, `meal_type`, `calories`, `protein_g`, `water_ml`, `caffeine_mg`, `supplements`, `symptoms`, `vitals_notes`, `energy_level`, `sleep_quality`, `mood`, `environment`
2. **Add financial_accounts DB** (10 properties) — Create new database, set up relations
3. **Add `account` relation to financial_log** — Link to financial_accounts
4. **Add `signed_amount` to financial_log** — Start using alongside existing `amount`
5. **Add core fields to subjective_journal** (4 properties) — `energy_level`, `stress_level`, `mood_trigger`, `sleep_hours`
6. **Add core fields to relational_journal** (3 properties) — `interaction_type`, `sentiment`, `follow_up_needed`
7. **Add `activity_type_rel` to activity_log** — Relation to activity_types (parallel to formula)
8. **Add fields to activity_types** (3 properties) — `category`, `is_health_tracked`, `target_per_week`
9. **Remove `week_name` and `month_name`** — Redundant with title

### Phase 2: Agent Tool Updates (Week 2)

1. **Update `lifeos.config.json`** — Add new database entries and property mappings
2. **Update `src/transformers/shared.ts`** — Add extractors for new property types
3. **Update `src/tools/journaling.ts`** — diet_log tool now handles `log_type` filtering
4. **Update `src/tools/discover.ts`** — Add financial_accounts to discovery schema
5. **Add financial_accounts MCP tool** — New tool for balance sheet queries

### Phase 3: Data Migration (Week 3, Optional)

1. **Migrate `financial_log.amount` → `signed_amount`** — If transaction_type=Expense, negate
2. **Backfill `activity_type_rel`** — Map existing activity_type formula values to activity_types entries
3. **Migrate existing diet entries** — Parse `nutrition` JSON into structured fields where possible

---

## 7. What This Achieves

### For the Physician
- Single Biological Log database with `log_type` filter — meals, symptoms, vitals, supplements, medications all in one place
- Agents can query: "show me all symptom entries this month", "correlate headaches with caffeine intake", "track supplement compliance"
- No intervention management overhead — interventions are just entries tracked over time

### For the CFO
- Financial accounts DB for net worth tracking
- `signed_amount` eliminates the amount/transaction_type duality
- Budget tracking via financial_log rollups (no separate DB needed)

### For Everyone Else
- Minimal property additions (~87 total vs V1's ~390)
- All existing dashboard widgets (monitors, JSON exports) preserved
- No destructive changes to existing data
- Agents get structured fields where they need them for cross-domain queries

### What It Doesn't Do
- Doesn't add psychological dimensions to projects (goes in body text)
- Doesn't add CMO analytics dimensions (goes in body text)
- Doesn't create separate intervention/event/network DBs (implicit in existing structure)
- Doesn't remove any formula properties (all serve MCP or dashboard functions)

---

## 8. Conflict Resolution vs V1

| V1 Decision | V2 Correction | Reason |
|---|---|---|
| Remove 42 properties | Remove 2 | Monitor and JSON properties are functional, not dead |
| Add health_interventions DB | Collapse into diet_log | User requirement: single Physician log |
| Add budget_lines DB | Rollups only | Budget logic doesn't need its own DB |
| Add network_map DB | Implicit in people.referred_by | Network topology is derivable |
| Add social_events DB | Log via relational_journal | Events are relational interactions |
| Change activity_type to Relation | Add parallel relation, keep formula | Migration safety |
| ~390 net new properties | ~87 net new properties | Breadth-over-depth philosophy |

---

*V2 Report generated after direct Notion schema research. All decisions verified against actual Notion property types, formulas, and MCP tool dependencies. No property proposed without answering: "Can an agent use this to compute, filter, or relate something?"*
