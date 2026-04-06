# LifeOS MCP — Complete Synthesis Layer Proposal

**Date:** 2026-04-03
**Status:** Proposal for Implementation
**Version:** 1.0

---

## Executive Vision

Transform LifeOS from a **data collection system** into a **true intelligence engine** that synthesizes 23 databases into actionable insights across all life domains: productivity, health, finance, relationships, strategy, and content.

**Current State:** 13 tools, 26% DB coverage, zero cross-domain correlation
**Target State:** 22 tools, 100% DB coverage, full cross-domain synthesis

---

## Final Tool Stack Architecture

### Layer 1: Data Access (Existing — Keep as-is)
Generic CRUD tools for all 23 databases:
- `lifeos_query` — Universal DB query
- `lifeos_create_entry`, `lifeos_find_entry`, `lifeos_update_entry`, `lifeos_delete_entry`
- Domain-specific read tools (activity_log, tasks, projects, etc.)

### Layer 2: Core Synthesis (Enhanced Existing + New)

#### 2.1 Daily Intelligence
| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_daily_briefing` | **Enhance** | 12 → 15 | Daily snapshot with full context |
| `lifeos_health_vitality` | **NEW** | 4 | Daily health score from diet + sleep + mood |

#### 2.2 Weekly Intelligence
| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_weekly_review` | **NEW** | 8 | Holistic weekly retrospective |
| `lifeos_productivity_report` | **Fix + Enhance** | 3 → 6 | Time allocation + project ROI |

#### 2.3 Monthly Intelligence
| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_monthly_synthesis` | **NEW** | 10 | Monthly performance across all domains |
| `lifeos_financial_productivity` | **NEW** | 4 | Revenue/hour, expense patterns, ROI |

#### 2.4 Quarterly Intelligence
| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_quarterly_retrospective` | **NEW** | 12 | Quarterly rollup with OKR alignment |
| `lifeos_okrs_progress` | **Fix + Enhance** | 2 → 5 | Actual progress with task/activity correlation |

#### 2.5 Annual Intelligence
| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_annual_synthesis` | **NEW** | 15+ | Year-level strategic review |

### Layer 3: Cross-Domain Correlation (All NEW)

| Tool | DBs Covered | Purpose |
|------|-------------|---------|
| `lifeos_health_productivity` | diet_log + activity_log + subjective_journal | Nutrition/mood → productivity impact |
| `lifeos_relationship_impact` | people + projects + relational_journal + tasks | Network effect on outcomes |
| `lifeos_content_roi` | content_pipeline + campaigns + financial_log | Content monetization analysis |
| `lifeos_project_financial` | projects + financial_log + activity_log + tasks | Per-project P&L |
| `lifeos_risk_opportunity` | directives_risk_log + opportunities_strengths + projects | Strategic risk/opp synthesis |
| `lifeos_mood_performance` | subjective_journal + activity_log + tasks | Emotional state → output correlation |

### Layer 4: Operational Intelligence (Enhanced Existing)

| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_planning_ops` | **Enhance** | 3 → 7 | Planning with full context |
| `lifeos_people_ops` | **Enhance** | 2 → 5 | Relationship intelligence |
| `lifeos_finance_ops` | **Enhance** | 1 → 4 | Financial intelligence |
| `lifeos_alignment` | **Fix + Enhance** | 3 → 6 | Strategic alignment |
| `lifeos_project_health` | **Fix + Enhance** | 3 → 7 | Project health with real data |

### Layer 5: Temporal Analysis (Enhanced Existing)

| Tool | Status | DBs Covered | Purpose |
|------|--------|-------------|---------|
| `lifeos_temporal_analysis` | **Enhance** | 2 → 6 | Multi-domain trend analysis |
| `lifeos_trajectory` | **Enhance** | 2 → 5 | Target compliance across domains |
| `lifeos_weekday_patterns` | **Enhance** | 2 → 5 | Behavioral patterns by weekday |

### Layer 6: Insight Engine (NEW)

| Tool | Purpose |
|------|---------|
| `lifeos_correlate` | Generic cross-domain correlation engine |
| `lifeos_insights` | AI-powered insight generation from any data combination |
| `lifeos_anomalies` | Detect anomalies across all domains |
| `lifeos_predictions` | 30/60/90-day projections based on trends |

---

## Detailed Tool Specifications

### NEW: `lifeos_health_vitality`

**Purpose:** Daily health score combining diet, sleep, mood, and exercise.

**DBs Queried:**
- `diet_log` — Nutrition quality, meal regularity
- `activity_log` — Sleep duration, workout completion
- `subjective_journal` — Mood/energy levels
- `activity_types` — Health targets

**Output:**
```
Health Vitality Score: 7.2/10
├── Nutrition: 6.5/10 (protein target missed 2/7 days)
├── Sleep: 8.0/10 (avg 7.2h, consistent schedule)
├── Exercise: 7.5/10 (4/5 workouts completed)
└── Mood: 6.8/10 (stress elevated on Tue/Wed)

Insights:
- Low energy days correlate with skipped breakfast
- Workout days show 23% higher productivity
- Stress spikes on days with >3h meetings
```

---

### NEW: `lifeos_weekly_review`

**Purpose:** Holistic weekly retrospective across all domains.

**DBs Queried:**
- `weeks` — Pre-aggregated week data
- `activity_log` — Time allocation vs targets
- `tasks` — Completion rate, overdue items
- `financial_log` — Income/expenses this week
- `subjective_journal` — Mood trends
- `relational_journal` — Connection activity
- `projects` — Progress updates
- `diet_log` — Nutrition compliance

**Output:**
```
Week 14 Review (Mar 31 - Apr 6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ Time Allocation: 42h tracked (85% of target)
✅ Tasks: 12/15 completed (80%)
💰 Net Flow: +₹45,000 (3 invoices, 2 expenses)
📊 Projects: 2/4 active, avg progress +8%
❤️ Relationships: 5 connections logged
🥗 Health: 78% nutrition compliance, 4/5 workouts
📝 Mood: Avg 7.1/10 (↑ from 6.4 last week)

Wins:
- Completed LifeOS MCP audit ahead of schedule
- Reconnected with 3 dormant relationships
- Maintained workout streak (4 weeks)

Concerns:
- Sleep inconsistent (6.5h avg vs 7.5h target)
- Content pipeline stalled (0 pieces published)
- Financial: ₹12,000 unplanned expense

Next Week Focus:
1. Publish 2 content pieces
2. Schedule sleep routine
3. Review Q2 OKR progress
```

---

### NEW: `lifeos_monthly_synthesis`

**Purpose:** Monthly performance review across all life domains.

**DBs Queried:**
- `months` — Pre-aggregated month data
- `activity_log` — Full month time analysis
- `tasks` — Monthly completion metrics
- `projects` — Progress trajectory
- `quarterly_goals` — OKR progress
- `financial_log` — P&L summary
- `diet_log` — Monthly nutrition patterns
- `subjective_journal` — Mood trajectory
- `relational_journal` — Network activity
- `content_pipeline` — Output metrics

**Output:**
```
March 2026 — Monthly Synthesis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Overall Score: 7.4/10 (↑ from 6.8 in Feb)

Productivity: 8.2/10
├── 168h tracked (92% of target)
├── 47/52 tasks completed (90%)
└── Top category: Work (58%), Learning (18%)

Finance: 7.8/10
├── Revenue: ₹2,45,000 (↑ 15% MoM)
├── Expenses: ₹89,000 (within budget)
└── Revenue/hour: ₹1,458

Health: 6.9/10
├── Workouts: 16/20 (80%)
├── Sleep: 7.1h avg (↓ from 7.3h)
└── Nutrition: 72% compliance

Relationships: 7.2/10
├── 18 interactions logged
├── 3 new connections
└── 2 relationships need attention

Strategy: 7.5/10
├── Q1 OKRs: 68% complete (on track)
├── 2/4 projects ahead of schedule
└── 1 critical risk identified

Content: 5.8/10
├── 4 pieces published (target: 8)
├── Reach: 12,400 (↑ 22%)
└── Gap: Behind on video content

Key Insights:
- Highest productivity weeks had 7.5h+ sleep
- Revenue correlates with client meeting frequency
- Mood dips correlate with content creation stress
- Relationship activity predicts next-week energy

Recommendations:
1. Prioritize sleep consistency (biggest leverage)
2. Batch content creation to reduce context switching
3. Schedule 2 client meetings/week minimum
4. Address Q1 OKR #3 (blocked on project delay)
```

---

### NEW: `lifeos_quarterly_retrospective`

**Purpose:** Quarterly strategic review with OKR alignment and year trajectory.

**DBs Queried:**
- `quarters` — Quarter context
- `quarterly_goals` — OKR results
- `annual_goals` — Year alignment
- `projects` — Project outcomes
- `financial_log` — Quarterly P&L
- `activity_log` — Time investment patterns
- `tasks` — Completion trends
- `campaigns` — Campaign results
- `content_pipeline` — Content performance
- `directives_risk_log` — Risk evolution
- `opportunities_strengths` — Opportunity activation
- `systemic_journal` — Strategic reflections

---

### NEW: `lifeos_annual_synthesis`

**Purpose:** Year-level strategic review across all domains.

**DBs Queried:**
- `years` — Year context
- `annual_goals` — Goal achievement
- `quarters` (all 4) — Quarterly progression
- `monthly_synthesis` results — Month trends
- All log databases — Full year patterns
- All strategic databases — Outcome analysis

---

### NEW: `lifeos_health_productivity`

**Purpose:** Correlate health metrics with productivity outcomes.

**DBs Queried:**
- `diet_log` — Nutrition quality, timing
- `activity_log` — Work hours, energy patterns
- `subjective_journal` — Mood, energy, stress
- `activity_types` — Health targets

**Analysis:**
- Does nutrition quality predict next-day productivity?
- Do workout days show higher output?
- Does sleep consistency correlate with focus time?
- What health patterns precede high-performance weeks?

---

### NEW: `lifeos_financial_productivity`

**Purpose:** Compute financial ROI of time investment.

**DBs Queried:**
- `financial_log` — Revenue, expenses by category
- `activity_log` — Time by activity type
- `projects` — Project-level financials
- `activity_types` — Time targets

**Analysis:**
- Revenue per hour of Work time
- Cost per hour of Recreation/learning
- Project profitability (revenue - time cost)
- Expense patterns by weekday/activity

---

### NEW: `lifeos_relationship_impact`

**Purpose:** Analyze how relationships affect outcomes.

**DBs Queried:**
- `people` — Network profiles, connection frequency
- `projects` — Project involvement
- `relational_journal` — Interaction history
- `tasks` — Collaborative tasks

**Analysis:**
- Which relationships correlate with project success?
- Does connection frequency predict opportunities?
- Network health score and at-risk relationships
- Collaboration impact on task completion

---

### NEW: `lifeos_content_roi`

**Purpose:** Analyze content performance and monetization.

**DBs Queried:**
- `content_pipeline` — Output, reach, engagement
- `campaigns` — Campaign alignment
- `financial_log` — Revenue attribution

**Analysis:**
- Revenue per content piece
- Best-performing formats/platforms
- Content → lead → conversion funnel
- ROI of content creation time

---

### NEW: `lifeos_project_financial`

**Purpose:** Per-project P&L analysis.

**DBs Queried:**
- `projects` — Project details, progress
- `financial_log` — Project-linked transactions
- `activity_log` — Time invested
- `tasks` — Task completion rate

**Analysis:**
- Revenue vs time cost per project
- Profit margin by project type
- Budget variance analysis
- Resource utilization efficiency

---

### NEW: `lifeos_risk_opportunity`

**Purpose:** Strategic risk and opportunity synthesis.

**DBs Queried:**
- `directives_risk_log` — Active risks, mitigation status
- `opportunities_strengths` — Activated opportunities
- `projects` — Risk/opp impact on projects
- `systemic_journal` — Strategic reflections

**Analysis:**
- Risk exposure score by project/domain
- Opportunity activation rate
- Emerging risk patterns from journal themes
- Risk → opportunity conversion analysis

---

### NEW: `lifeos_mood_performance`

**Purpose:** Correlate emotional state with output.

**DBs Queried:**
- `subjective_journal` — Mood, stress, energy
- `activity_log` — Productivity metrics
- `tasks` — Completion patterns
- `diet_log` — Nutrition impact on mood

**Analysis:**
- Mood → productivity correlation
- Stress triggers and patterns
- Optimal conditions for flow state
- Emotional trajectory over time

---

### NEW: `lifeos_correlate`

**Purpose:** Generic cross-domain correlation engine.

**Parameters:**
- `domain_a` — First domain (e.g., "health")
- `domain_b` — Second domain (e.g., "productivity")
- `period` — Time period for analysis
- `metrics` — Specific metrics to correlate

**Analysis:**
- Pearson correlation between time series
- Lag analysis (does A predict B next day?)
- Conditional probability (given A, likelihood of B)
- Statistical significance testing

---

### NEW: `lifeos_insights`

**Purpose:** AI-powered insight generation from any data combination.

**Parameters:**
- `databases` — List of DBs to analyze
- `period` — Time period
- `focus` — Optional focus area
- `depth` — Analysis depth (quick/deep)

**Output:**
- Non-obvious patterns
- Actionable recommendations
- Anomaly explanations
- Predictive insights

---

### NEW: `lifeos_anomalies`

**Purpose:** Detect anomalies across all domains.

**Analysis:**
- Statistical outliers in time series
- Behavioral pattern breaks
- Unexpected correlations
- Early warning signals

---

### NEW: `lifeos_predictions`

**Purpose:** Forward-looking projections.

**Parameters:**
- `horizon` — 30/60/90 days
- `domains` — Which domains to project
- `confidence` — Confidence interval

**Output:**
- OKR completion probability
- Financial trajectory
- Health trend projection
- Burnout risk assessment

---

## Enhanced Existing Tools

### `lifeos_daily_briefing` — Enhancement

**Current DBs:** 7
**Target DBs:** 15

**Add:**
- `diet_log` — Today's nutrition
- `projects` — Project context for tasks
- `directives_risk_log` — Critical risks
- `opportunities_strengths` — Active opportunities
- `campaigns` — Campaign deadlines
- `days` — Day-level context
- `health_vitality` — Today's health score

---

### `lifeos_productivity_report` — Fix + Enhance

**Fixes:**
- Filter tasks by date range (currently fetches ALL)
- Add project-level time breakdown

**Add:**
- `financial_log` — Revenue correlation
- `projects` — Project time allocation
- `diet_log` — Health context

---

### `lifeos_project_health` — Fix + Enhance

**Fixes:**
- Query actual risk/opp content (not counts)
- Query actual task status (not relation counts)

**Add:**
- `financial_log` — Project financials
- `activity_log` — Time investment
- `campaigns` — Campaign linkage
- `people` — Team involvement

---

### `lifeos_okrs_progress` — Fix + Enhance

**Fixes:**
- Query actual project status (not counts)
- Real blocked detection (not proxy)

**Add:**
- `tasks` — Task completion per OKR
- `activity_log` — Time investment per OKR
- `financial_log` — Financial impact

---

### `lifeos_alignment` — Fix + Enhance

**Fixes:**
- Filter projects by actual relations
- Query actual campaign/person details

**Add:**
- `financial_log` — Budget alignment
- `tasks` — Task alignment per project

---

### `lifeos_temporal_analysis` — Enhance

**Add:**
- `tasks` — Task completion trends
- `financial_log` — Financial trends
- `diet_log` — Health trends
- `journaling` — Mood trends
- Use Weeks DB for pre-aggregated data

---

### `lifeos_trajectory` — Enhance

**Add:**
- `tasks` — Task completion trajectory
- `projects` — Project progress trajectory
- `financial_log` — Financial trajectory
- `diet_log` — Health compliance trajectory

---

### `lifeos_weekday_patterns` — Enhance

**Add:**
- `tasks` — Task patterns by weekday
- `financial_log` — Spending by weekday
- `diet_log` — Eating patterns by weekday
- `journaling` — Mood by weekday

---

### `lifeos_planning_ops` — Enhance

**Add:**
- `projects` — Project context
- `financial_log` — Budget constraints
- `journaling` — Reflection input
- `health_vitality` — Energy-aware planning

---

### `lifeos_people_ops` — Enhance

**Add:**
- `relational_journal` — Interaction history
- `projects` — Project involvement
- `campaigns` — Campaign roles
- Relationship health scoring

---

### `lifeos_finance_ops` — Enhance

**Add:**
- `projects` — Project-level P&L
- `campaigns` — Campaign ROI
- `content_pipeline` — Content monetization
- Use Months/Weeks pre-computed data

---

## Database Coverage — Final State

| Database | Current Tools | Target Tools | Coverage |
|----------|---------------|--------------|----------|
| activity_log | 7 | 15 | ✓✓✓ |
| tasks | 5 | 12 | ✓✓✓ |
| activity_types | 6 | 8 | ✓✓✓ |
| projects | 3 | 10 | ✓✓✓ |
| quarterly_goals | 2 | 6 | ✓✓✓ |
| annual_goals | 0 | 4 | ✓✓ |
| days | 0 | 5 | ✓✓ |
| weeks | 0 | 6 | ✓✓ |
| months | 1 | 5 | ✓✓ |
| quarters | 0 | 4 | ✓✓ |
| years | 0 | 3 | ✓✓ |
| subjective_journal | 2 | 8 | ✓✓✓ |
| relational_journal | 3 | 7 | ✓✓✓ |
| systemic_journal | 2 | 6 | ✓✓ |
| financial_log | 2 | 10 | ✓✓✓ |
| diet_log | 0 | 7 | ✓✓✓ |
| directives_risk_log | 1 | 5 | ✓✓ |
| opportunities_strengths | 1 | 5 | ✓✓ |
| people | 2 | 7 | ✓✓✓ |
| campaigns | 1 | 5 | ✓✓ |
| content_pipeline | 0 | 4 | ✓✓ |
| reports | 0 | 2 | ✓ |
| notes_management | 0 | 2 | ✓ |

**Final Coverage:**
- 23/23 databases (100%) covered by at least 1 synthesis tool
- 18/23 databases (78%) covered by 3+ synthesis tools
- Full cross-domain correlation capability

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Fix critical bugs, create shared infrastructure

1. **Fix P0 Bugs** (3 days)
   - `productivity_report` task date filter
   - `journal_synthesis` content analysis
   - `project_health` actual data queries
   - `alignment` relation filtering

2. **Create Shared Library** (4 days)
   - `src/lib/analysis/statistics.ts`
   - `src/lib/analysis/correlation.ts`
   - `src/lib/analysis/temporal.ts`
   - `src/lib/fetchers/multi-db-fetcher.ts`
   - `src/lib/formatters/`

3. **Enhance Temporal Context** (3 days)
   - `resolveTemporalContext()` function
   - Weeks/Months/Quarters integration
   - Parallel data fetching

### Phase 2: Core Synthesis (Weeks 3-4)
**Goal:** Implement daily/weekly/monthly intelligence

1. **Daily Intelligence** (3 days)
   - Enhance `daily_briefing` with 8 new DBs
   - Create `health_vitality` tool

2. **Weekly Intelligence** (4 days)
   - Create `weekly_review` tool
   - Enhance `productivity_report`

3. **Monthly Intelligence** (4 days)
   - Create `monthly_synthesis` tool
   - Create `financial_productivity` tool

### Phase 3: Cross-Domain (Weeks 5-6)
**Goal:** Implement correlation engine and cross-domain tools

1. **Correlation Engine** (3 days)
   - Create `correlate` tool
   - Statistical analysis functions

2. **Cross-Domain Tools** (7 days)
   - `health_productivity`
   - `relationship_impact`
   - `content_roi`
   - `project_financial`
   - `risk_opportunity`
   - `mood_performance`

### Phase 4: Strategic Intelligence (Weeks 7-8)
**Goal:** Implement quarterly/annual synthesis

1. **Quarterly** (4 days)
   - Create `quarterly_retrospective`
   - Enhance `okrs_progress`

2. **Annual** (3 days)
   - Create `annual_synthesis`
   - Year trajectory analysis

3. **Enhance Ops Tools** (3 days)
   - `planning_ops`, `people_ops`, `finance_ops`
   - `project_health`, `alignment`

### Phase 5: Insight Engine (Weeks 9-10)
**Goal:** AI-powered insights and predictions

1. **Insight Tools** (5 days)
   - `insights` — AI pattern detection
   - `anomalies` — Statistical anomaly detection
   - `predictions` — Forward projections

2. **Enhance Temporal** (3 days)
   - `temporal_analysis` multi-domain
   - `trajectory` cross-domain
   - `weekday_patterns` full coverage

3. **Testing & Optimization** (2 days)
   - Integration tests
   - Performance optimization
   - Caching layer

---

## Architecture: Shared Library

### `src/lib/analysis/statistics.ts`
```typescript
export function computeBaseline(data: number[], windows: number): Stats
export function computeTrend(data: number[]): { slope: number, direction: string }
export function computeDeviation(value: number, baseline: Stats): { zScore: number, isAnomaly: boolean }
export function correlation(x: number[], y: number[]): { r: number, pValue: number }
export function movingAverage(data: number[], window: number): number[]
```

### `src/lib/analysis/correlation.ts`
```typescript
export async function crossDomainCorrelate(
  domainA: DomainData,
  domainB: DomainData,
  options: CorrelationOptions
): Promise<CorrelationResult>

export function lagCorrelation(
  seriesA: TimeSeries,
  seriesB: TimeSeries,
  maxLag: number
): LagResult

export function conditionalProbability(
  condition: Event[],
  outcome: Event[],
  window: number
): number
```

### `src/lib/analysis/temporal.ts`
```typescript
export async function resolveTemporalContext(
  date: string
): Promise<TemporalContext>

export async function rollUpPeriod(
  period: 'week' | 'month' | 'quarter' | 'year',
  date: string,
  databases: string[]
): Promise<PeriodRollup>
```

### `src/lib/fetchers/multi-db-fetcher.ts`
```typescript
export async function fetchMultiple(
  queries: DBQuery[]
): Promise<Map<string, any>>

export async function fetchTemporal(
  period: string,
  databases: string[]
): Promise<TemporalData>
```

### `src/lib/formatters/`
```typescript
export function toMarkdown(result: SynthesisResult): string
export function toStructured(result: SynthesisResult): JSON
export function toInsights(result: SynthesisResult): Insight[]
export function toAlerts(result: SynthesisResult): Alert[]
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| DBs with synthesis coverage | 13/23 (57%) | 23/23 (100%) |
| Cross-domain tools | 0 | 8 |
| Avg DBs per synthesis tool | 2.1 | 5.8 |
| Tools with structured output | 0 | 22 |
| Analysis depth (surface/deep) | 90% surface | 60% deep |
| Cross-domain correlation | None | Full |
| Temporal hierarchy usage | 1/5 levels | 5/5 levels |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Notion API rate limits | Parallel fetching with batching, caching layer |
| Tool complexity | Modular design, shared primitives, clear interfaces |
| Performance | Incremental analysis, result caching, async processing |
| Maintenance | Comprehensive tests, documentation, type safety |
| User adoption | Progressive enhancement, backward compatibility |

---

## Conclusion

This proposal transforms LifeOS from a **data collection system** into a **comprehensive intelligence engine** that:

1. **Covers all 23 databases** with meaningful synthesis
2. **Correlates across domains** to reveal hidden patterns
3. **Operates at all temporal scales** — daily to annual
4. **Provides actionable insights** not just data summaries
5. **Predicts future outcomes** based on trend analysis

The implementation is phased over 10 weeks, with each phase delivering usable improvements. The shared library architecture ensures maintainability and extensibility.

**Next Step:** Review and approve this proposal, then begin Phase 1 implementation.
