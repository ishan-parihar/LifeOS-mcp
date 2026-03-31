# LifeOS MCP Server

An MCP (Model Context Protocol) server that gives AI agents structured, agent-optimized access to a Notion-based LifeOS system. Wraps the Notion API v2025-09-03 data source queries with rate limiting, short-lived caching, property transformers, and server-side synthesis tools.

## What It Does

LifeOS MCP provides **16 tools** across three agent domains — Productivity, Journaling, and Strategic Planning — each returning structured markdown optimized for agent context windows.

Rather than exposing raw Notion API responses (deeply nested JSON with type discriminators), LifeOS MCP transforms property data into clean, grouped, actionable output that agents can immediately interpret and act on.

## Architecture

```
LifeOS/
├── lifeos.config.json          # Data source IDs + property mappings
├── src/
│   ├── index.ts                # MCP server entry (stdio transport)
│   ├── config.ts               # Config loader + types
│   ├── notion/
│   │   ├── client.ts           # Notion API wrapper (auth, rate limit, pagination)
│   │   ├── cache.ts            # 5-minute in-memory cache
│   │   └── types.ts            # Notion API type definitions
│   ├── transformers/
│   │   ├── shared.ts           # Property extractors + formatters
│   │   ├── activity.ts         # Activity entries → markdown
│   │   ├── tasks.ts            # Tasks → markdown
│   │   └── productivity.ts     # Activity × Tasks synthesis engine
│   └── tools/
│       ├── discover.ts         # lifeos_discover — list all databases
│       ├── query.ts            # lifeos_query — generic database query
│       ├── activity-log.ts     # lifeos_activity_log — date-filtered activities
│       ├── tasks.ts            # lifeos_tasks — status/priority/overdue filtering
│       ├── productivity.ts     # lifeos_productivity_report — synthesis
│       ├── daily-briefing.ts   # lifeos_daily_briefing — cross-database overview
│       ├── journaling.ts       # 5 journal-specific tools
│       └── strategic.ts        # 5 strategic planning tools
├── package.json
└── tsconfig.json
```

## Available Tools

### Discovery

| Tool | Description |
|------|-------------|
| `lifeos_discover` | List all configured databases with schemas and agent domain mapping |

### Productivity Agent

| Tool | Description |
|------|-------------|
| `lifeos_activity_log` | Activity entries with date range, category, and habit filters |
| `lifeos_tasks` | Tasks with status, priority, overdue detection, and search |
| `lifeos_productivity_report` | Synthesized report correlating activities and tasks |
| `lifeos_daily_briefing` | Cross-database daily overview for morning planning |

### Journaling Agent

| Tool | Description |
|------|-------------|
| `lifeos_subjective_journal` | Internal state, emotions, dreams, reflections |
| `lifeos_relational_journal` | Relationship interactions and social reflections |
| `lifeos_systemic_journal` | Systems-level observations and pattern recognition |
| `lifeos_financial_log` | Financial transaction entries with categories |
| `lifeos_diet_log` | Nutrition and meal tracking entries |

### Strategic Planning Agent

| Tool | Description |
|------|-------------|
| `lifeos_projects` | Project portfolio with health, progress, and KPI tracking |
| `lifeos_quarterly_goals` | OKR tracking with key results and progress |
| `lifeos_annual_goals` | Long-term goal management with strategic intent |
| `lifeos_directives_risks` | Risk assessment and directive management |
| `lifeos_opportunities_strengths` | Leverage point identification and activation |

### Generic

| Tool | Description |
|------|-------------|
| `lifeos_query` | Raw database query with custom filters and sorts |

## Databases (14 Phase 1)

### Foundation Tier
- **Activity Log** — Time tracking, activity types (Work/Recreation/Workout/Sleep/Chores/Socialize/Study)
- **Tasks** — Task management with statuses, priorities, sprint tracking
- **Days** — Central daily hub linking all journal databases
- **Weeks** — Weekly rollups with financial and activity breakdowns
- **Projects** — Project portfolio with health metrics and cross-database relations

### Journaling Tier
- **Subjective Journal** — Internal state, emotions, psychograph data
- **Relational Journal** — Relationship reflections with People linking
- **Systemic Journal** — Systems observations with Impact levels (P1–P5)
- **Financial Log** — Transactions by category and capital engine
- **Diet Log** — Nutrition tracking with parsed meal data

### Strategic Tier
- **Quarterly Goals** — OKRs with 3 key results each, health tracking
- **Annual Goals** — Strategic intent, epics, quarterly breakdowns
- **Directives & Risk Log** — Risk likelihood/impact assessment, threat levels
- **Opportunities & Strengths** — Leverage scoring (Seed/Medium-Impact/High-Leverage)

## Output Format

All tools return **structured markdown** designed for agent context windows:

```
## Activity Log — 2026-03-25 to 2026-03-31

**Total entries:** 24 | **Total tracked time:** 42.5h

### Work (28.0h, 16 entries)

- **[Mar 31, 09:30 AM]** Deep Work - Coding — 3.5h
  - Notes: Implemented auth flow
- **[Mar 30, 10:00 AM]** Work - Architecture Review — 2.0h

### Recreation (12.0h, 6 entries) ⚠️ HIGH

- **[Mar 31, 20:30 PM]** Anime — 3.5h
- **[Mar 30, 21:00 PM]** Reels — 1.0h

### Time Allocation

- **Recreation:** 12.0h (28%) ███░░░░░░░
- **Work:** 28.0h (66%) █████████████░
- **Sleep:** 2.5h (6%) █░░░░░░░░░

### Alerts & Insights

- ⚠️ Recreation is 28% of tracked time (>40% threshold)
- ⚠️ 2 overdue task(s) need attention
```

## Setup

### Prerequisites

- Node.js 20+
- A Notion integration token with access to the LifeOS workspace

### Install

```bash
cd LifeOS
npm install
npm run build
```

### Configure

Set the Notion API token as an environment variable:

```bash
export NOTION_API_TOKEN="your-notion-integration-token"
```

Database configuration lives in `lifeos.config.json`. The data source IDs and property mappings are pre-configured for the LifeOS workspace.

### Run

```bash
node dist/index.js
```

The server runs on **stdio** transport — output goes to stdout (MCP protocol), logging goes to stderr.

## MCP Client Configuration

### OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "lifeos": {
      "type": "local",
      "command": ["node", "/path/to/LifeOS/dist/index.js"],
      "environment": {
        "NOTION_API_TOKEN": "your-token"
      },
      "enabled": true
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "node",
      "args": ["/path/to/LifeOS/dist/index.js"],
      "env": {
        "NOTION_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "node",
      "args": ["/path/to/LifeOS/dist/index.js"],
      "env": {
        "NOTION_API_TOKEN": "your-token"
      }
    }
  }
}
```

## Configuration

Edit `lifeos.config.json` to:

- Add new databases (just need `data_source_id` and property mappings)
- Change property name mappings to match your Notion schema
- Adjust rate limits (`requestsPerSecond`, `cacheTtlSeconds`)
- Switch API version

```json
{
  "apiVersion": "2025-09-03",
  "rateLimit": {
    "requestsPerSecond": 3,
    "cacheTtlSeconds": 300
  },
  "databases": {
    "activity_log": {
      "name": "Activity Log",
      "data_source_id": "a1769af1-3ab6-4f77-bbd0-57f920c62311",
      "agent": "productivity",
      "properties": {
        "title": "Name",
        "date": "Date",
        "activity_type": "Activity Type",
        "duration": "Duration"
      }
    }
  }
}
```

## Notion API Details

This server uses the **Notion API v2025-09-03** with data sources. Key differences from older API versions:

- Pages are parented by `data_source_id` instead of `database_id`
- The query endpoint is `/v1/data_sources/{data_source_id}/query`
- Databases can contain multiple data sources

## Development

```bash
# Watch mode
npm run dev

# Type check
npm run typecheck

# Build
npm run build
```

## License

Private — for internal LifeOS use.
