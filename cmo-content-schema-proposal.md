# CMO-Content: Ideal Notion Database Schema Proposal

> **Design Principle**: Every property must serve a CMO decision: *What to create? When? Where? For whom? How well did it perform? What to do next?*
>
> Three databases in the CMO domain: **Content Pipeline**, **Campaigns**, **Projects** (content dimension only).

---

## 1. Content Pipeline Database

### Purpose
Track every piece of content from ideation → production → distribution → performance. The atomic unit of the content flywheel.

---

### Core Properties

| Property | Type | Options / Format | Purpose |
|---|---|---|---|
| `Content Name` | Title | — | Unique identifier |
| `ID` | Unique ID | CP-### | Machine-readable reference |
| `Status` | Select | `Potential Idea` → `Scheduled` → `Next Up 🚩` → `Writing 📝` → `Recording ⏺` → `Editing 🎞` → `Ready to Post 📤` → `Published 💥` → `Repurposing ♻️` → `Evergreen 🌿` → `Archived` | Production workflow state machine |
| `Content Type` | Select | `Article`, `Thread`, `Carousel`, `Video`, `Reel`, `Podcast`, `Newsletter`, `Case Study`, `Infographic`, `Webinar`, `Live Stream`, `Short`, `Tweet`, `Post` | What kind of content this is (separate from format) |
| `Format` | Select | `45-90 Sec Reel`, `5-10 Min Video`, `30-60 Min Podcast`, `Blog`, `Newsletter`, `FB/Linkedin/X Post`, `Thread`, `Carousel (10 slides)`, `Long-form Article (2000+)`, `Short-form (<280 chars)` | Platform-specific packaging |
| `Pillar` | Select | `P1: Meta-Theory`, `P2: AI Consulting`, `P3: LifeOS`, `P4: Counselling`, `P5: Activism` | Strategic content pillar |
| `Funnel Stage` | Select | `TOFU (Awareness)`, `MOFU (Consideration)`, `BOFU (Conversion)`, `Retention (Loyalty)`, `Advocacy (Referral)` | Where this sits in the funnel |
| `Topic / Hook` | Rich Text | — | The core angle, headline, or hook. **Critical for content planning.** |
| `Content Brief` | Rich Text | — | Outline, key points, CTA, target keyword. The creative brief for the piece. |
| `Content Body` | Rich Text | — | Full draft or script. Living document. |
| `CTA` | Select | `Follow`, `Subscribe`, `Book Call`, `Download Lead Magnet`, `Join Community`, `Buy Product`, `Share`, `Comment`, `None` | Primary call-to-action |
| `CTA Link` | URL | — | Destination URL for the CTA |
| `Target Keyword` | Text | — | Primary SEO/search keyword |
| `Secondary Keywords` | Multi-select | — | Supporting keywords |
| `Tone` | Select | `Intellectual`, `Authentic/Vulnerable`, `Practical/How-to`, `Analytic`, `Urgent`, `Inspirational`, `Contrarian`, `Conversational` | Voice for this piece |
| `Complexity Score` | Select | `Beginner (ELI5)`, `Intermediate`, `Advanced`, `Expert` | Audience knowledge level |
| `Platforms` | Multi-select | `YouTube`, `Instagram`, `X (Twitter)`, `LinkedIn`, `Substack`, `TikTok`, `Blog`, `Medium`, `Facebook`, `Threads`, `Podcast`, `Newsletter` | Where this will be distributed |
| `Primary Platform` | Select | Same as Platforms | The platform this was created FOR (others are repurposed) |
| `Publish Date` | Date | YYYY-MM-DD | Scheduled/actual publish date |
| `Publish Time` | Text | `09:00 IST` | Optimal posting time |
| `Action Date` | Date | YYYY-MM-DD | When work should begin |
| `Deadline` | Date | YYYY-MM-DD | Hard deadline for publication |
| `Live URL` | URL | — | Published content URL |
| `Media Assets` | Files & Media | — | Thumbnails, images, video files |
| `Thumbnail/Banner` | Files & Media | — | Hero visual asset |
| `Script / Draft URL` | URL | — | Link to Google Doc / Notion page with full draft |
| `Collaborators` | People | — | Who's working on this (writers, editors, designers) |
| `Estimated Effort` | Select | `Quick (<1hr)`, `Medium (1-3hr)`, `Heavy (3-6hr)`, `Major (6hr+)` | Production complexity |
| `Content Length` | Text | `500 words`, `2 min`, `30 slides` | Approximate output size |
| `Hashtags / Tags` | Text | — | Platform-specific hashtags |
| `Mentions / Tags` | Text | `@username, @brand` | Accounts to tag/mention |
| `Content Notes` | Rich Text | — | Internal notes, references, inspiration links |
| `Repurpose Potential` | Select | `High`, `Medium`, `Low` | How many derivative pieces this can generate |
| `Evergreen Score` | Select | `Timely (expires)`, `Seasonal`, `Evergreen` | Longevity classification |
| `Content Quality Score` | Number | 1-10 | Post-publication quality rating (internal) |
| `SEO Score` | Number | 1-100 | Post-publication SEO rating (tool-based) |

---

### Performance Metrics (Post-Publication)

| Property | Type | Purpose |
|---|---|---|
| `Reach` | Number | Total impressions/views across all platforms |
| `Impressions` | Number | Total times content was shown (separate from reach) |
| `Engagement` | Number | Total engagement actions (likes + comments + shares + saves) |
| `Likes` | Number | Platform-agnostic total |
| `Comments` | Number | Total comments/replies |
| `Shares` | Number | Total shares/retweets/reposts |
| `Saves` | Number | Total bookmarks/saves |
| `Clicks` | Number | Total link clicks |
| `CTR (%)` | Number | Click-through rate (clicks ÷ impressions × 100) |
| `Watch Time` | Number | Total minutes/hours watched (video/podcast) |
| `Avg. Watch Time` | Number | Average per viewer |
| `Completion Rate (%)` | Number | % who watched/read to completion |
| `New Followers` | Number | Followers gained attributed to this piece |
| `Leads Generated` | Number | Email signups, DMs, inquiries from this content |
| `Revenue Attributed` | Number | Revenue directly traced to this content |
| `Sentiment Score` | Select | `Negative`, `Neutral`, `Positive`, `Viral Positive` | Audience reaction sentiment |
| `Last Metrics Update` | Date | When performance data was last refreshed |

---

### Formula Properties

| Property | Formula | Purpose |
|---|---|---|
| `Engagement Rate (%)` | `if(prop("Reach") > 0, round(prop("Engagement") / prop("Reach") * 10000) / 100, 0)` | Engagement as % of reach |
| `Content Velocity` | `if(prop("Publish Date") and prop("Action Date"), dateBetween(prop("Publish Date"), prop("Action Date"), "days"), empty)` | Days from action to publish (speed to market) |
| `Content Age (days)` | `if(prop("Publish Date"), dateBetween(now(), prop("Publish Date"), "days"), empty)` | How long since published |
| `Efficiency Score` | `if(prop("Reach") > 0, round(prop("Reach") / if(prop("Estimated Effort") == "Quick (<1hr)", 1, if(prop("Estimated Effort") == "Medium (1-3hr)", 2, if(prop("Estimated Effort") == "Heavy (3-6hr)", 4, 6))) * 100) / 100, 0)` | Reach per effort hour |
| `Funnel Progress` | `if(prop("Leads Generated") > 0, if(prop("Revenue Attributed") > 0, "Revenue", "Lead Gen"), if(prop("Clicks") > 0, "Click-through", if(prop("Engagement") > 0, "Engaged", "Impression Only")))` | How far this content moved people down funnel |
| `Content Score` | `round((prop("Engagement Rate (%)") * 0.3 + if(prop("New Followers") > 0, min(prop("New Followers"), 100) * 0.2, 0) + if(prop("Leads Generated") > 0, min(prop("Leads Generated"), 50) * 0.3, 0) + if(prop("Content Quality Score") > 0, prop("Content Quality Score") * 2 * 0.2, 0)) * 100) / 100` | Composite content effectiveness score |
| `Days Since Published` | `if(prop("Publish Date"), dateBetween(now(), prop("Publish Date"), "days"), empty)` | For recency filtering |
| `Repurposable?` | `if(or(prop("Repurpose Potential") == "High", prop("Repurpose Potential") == "Medium"), "✅ Yes", "❌ No")` | Quick filter for repurposing queue |
| `Waterfall Depth` | `if(prop("Repurpose Potential") == "High", 5, if(prop("Repurpose Potential") == "Medium", 3, 1))` | Estimated derivative content pieces |
| `Is Overdue` | `if(prop("Deadline") and prop("Deadline") < now() and prop("Status") != "Published 💥" and prop("Status") != "Archived", "🔴 Overdue", "✅ On Track")` | Deadline compliance flag |

---

### Rollup Properties

| Property | Rollup From | Function | Purpose |
|---|---|---|---|
| `Campaign Name` | ← Campaigns (relation) | Show original | Which campaign this belongs to |
| `Project Name` | ← Projects (relation) | Show original | Which project this supports |
| `Child Content Count` | → Content Pipeline (self-relation: Parent) | Count | How many derivative pieces exist |
| `Parent Content Reach` | ← Content Pipeline (self-relation: Parent) | Sum | Total reach of parent (waterfall source) |
| `Total Waterfall Reach` | → Content Pipeline (self-relation: Parent) | Sum | Combined reach of all derivative pieces |
| `Campaign Budget Allocation` | ← Campaigns (relation) | Show original | Budget this content operates under |

---

### Relation Properties

| Property | Relates To | Direction | Purpose |
|---|---|---|---|
| `Campaigns` | Campaigns | Many-to-Many | Which campaign(s) this content serves |
| `Projects` | Projects | Many-to-One | Which project this content supports |
| `Parent Content` | Content Pipeline (self) | Many-to-One | Source piece this was repurposed FROM |
| `Child Content` | Content Pipeline (self) | One-to-Many | Pieces repurposed FROM this piece |
| `Quarterly Goals` | Quarterly Goals | Many-to-Many | Which OKR this content advances |
| `People` | People | Many-to-Many | Subject matter experts, interviewees, collaborators |
| `Financial Log` | Financial Log | One-to-Many | Production costs, ad spend attributed to this piece |
| `Days` | Days | Many-to-One | Temporal anchoring for publishing day |

---

### What to ADD (missing but critical)

| Property | Why It Matters |
|---|---|
| **`Content Type`** (separate from Format) | Type = what it IS (article, video), Format = how it's packaged. Currently conflated. |
| **`Topic / Hook`** | The single most important planning field. CMOs decide based on hooks, not bodies. |
| **`Content Brief`** | Separation of brief from body enables handoff workflows. |
| **`CTA` + `CTA Link`** | Every piece needs a conversion goal. Currently missing. |
| **`Target Keyword` + `Secondary Keywords`** | SEO strategy requires keyword tracking per piece. |
| **`Primary Platform`** | Distinguish native platform from distribution platforms. |
| **`Publish Time`** | Posting time optimization is critical for reach. |
| **`Deadline`** | Currently only `Action Date` and `Publish Date` exist. Need a hard deadline field. |
| **`Collaborators`** | Multi-person content production needs assignment tracking. |
| **`Estimated Effort`** | Resource planning requires effort estimation. |
| **`Repurpose Potential`** | Drives the content waterfall strategy. |
| **`Evergreen Score`** | Content decay planning. |
| **`Content Quality Score`** | Post-publication quality audit. |
| **`SEO Score`** | Technical SEO compliance per piece. |
| **`Impressions`** (separate from Reach) | Reach = unique viewers, Impressions = total views. Different metrics. |
| **`Likes`, `Comments`, `Shares`, `Saves`** (broken out) | Currently only aggregate `Engagement`. Granular breakdown needed for platform-specific analysis. |
| **`CTR (%)`** | Critical for conversion optimization. |
| **`Watch Time` + `Avg. Watch Time`** | Video/podcast essential metrics. |
| **`Completion Rate (%)`** | Content quality proxy — did people finish? |
| **`New Followers`** | Audience growth attribution. |
| **`Leads Generated`** | Marketing's #1 conversion metric. |
| **`Revenue Attributed`** | Direct ROI per content piece. |
| **`Sentiment Score`** | Qualitative performance indicator. |
| **`Last Metrics Update`** | Data freshness tracking. |
| **`Script / Draft URL`** | External doc linking (Google Docs, Figma). |
| **`Thumbnail/Banner`** | Asset management separate from general media. |
| **`Complexity Score`** | Audience targeting precision. |
| **`Hashtags / Tags` + `Mentions / Tags`** | Distribution execution details. |
| **`Content Notes`** | Internal working context. |

---

### What to REMOVE (noise without marketing value)

| Current Property | Why Remove | Replacement |
|---|---|---|
| `media_assets` (as multi-select text) | Too vague. Files & Media type is better. | Replace with `Media Assets` (Files) + `Thumbnail/Banner` (Files) |

---

### Agent Workflow Simulation

#### Step 1: Content Calendar Review

| Action | Properties | Operation |
|---|---|---|
| Filter upcoming 7 days | `Publish Date`, `Status` | Read: `Status` ≠ `Published 💥`, `Publish Date` within 7d |
| Check readiness | `Status`, `Content Body`, `Media Assets`, `CTA` | Read: verify all production assets present |
| Identify bottlenecks | `Status`, `Deadline`, `Is Overdue` (formula) | Filter: `Is Overdue` = 🔴 |
| Prioritize queue | `Priority`, `Publish Date`, `Action Date` | Sort: `Action Date` ASC, `Publish Date` ASC |

#### Step 2: Production Status Check

| Action | Properties | Operation |
|---|---|---|
| Pipeline distribution | `Status` | Read: count by status → identify stage bottlenecks |
| Work-in-progress age | `Action Date`, `Content Velocity` (formula) | Compute: current date - Action Date for items in production |
| Effort vs. deadline | `Estimated Effort`, `Deadline`, `Publish Date` | Read: flag items where effort > time remaining |
| Collaborator workload | `Collaborators`, `Status` | Read: group by collaborator → find overloaded people |

#### Step 3: Distribution Planning

| Action | Properties | Operation |
|---|---|---|
| Platform schedule | `Primary Platform`, `Platforms`, `Publish Date`, `Publish Time` | Read: map content to platform + time slots |
| Repurposing queue | `Repurpose Potential`, `Status` | Filter: `Repurpose Potential` = High/Medium AND `Status` = `Published 💥` AND `Repurposable?` = ✅ |
| Waterfall generation | `Parent Content`, `Waterfall Depth` (formula) | Read: identify pieces with depth > 1 that haven't spawned children |
| Content gaps | `Pillar`, `Funnel Stage`, `Publish Date` | Read: matrix of pillar × funnel stage → find empty cells |

#### Step 4: Performance Analysis

| Action | Properties | Operation |
|---|---|---|
| Top performers | `Content Score` (formula), `Engagement Rate (%)`, `Reach` | Sort: `Content Score` DESC |
| Underperformers | `Engagement Rate (%)`, `CTR (%)`, `Completion Rate (%)` | Filter: below benchmark thresholds |
| Platform comparison | `Primary Platform`, `Engagement Rate (%)`, `Reach`, `New Followers` | Group by: `Primary Platform` → avg metrics |
| Funnel analysis | `Funnel Stage`, `Leads Generated`, `Revenue Attributed`, `Funnel Progress` (formula) | Group by: `Funnel Stage` → sum conversions |
| Content decay | `Content Age (days)`, `Reach`, `Engagement` | Filter: `Content Age` > 30 AND still gaining engagement |

#### Step 5: Campaign Optimization

| Action | Properties | Operation |
|---|---|---|
| Campaign content inventory | `Campaigns` (relation) | Filter: by campaign → count pieces, sum reach |
| Campaign velocity | `Campaigns`, `Publish Date`, `Content Velocity` | Compute: pieces published per week per campaign |
| Budget efficiency | `Campaigns`, `Revenue Attributed`, `Estimated Effort`, `Efficiency Score` (formula) | Compute: ROI per campaign |
| Content waterfall audit | `Waterfall Depth`, `Child Content Count`, `Total Waterfall Reach` | Read: actual vs. potential waterfall yield |

#### Step 6: Strategic Alignment Check

| Action | Properties | Operation |
|---|---|---|
| Pillar balance | `Pillar`, `Status` | Group by: `Pillar` → count published vs. planned |
| Funnel coverage | `Funnel Stage`, `Publish Date` | Matrix: funnel stage × time period → find gaps |
| OKR contribution | `Quarterly Goals` (relation), `Leads Generated`, `Revenue Attributed` | Read: map content metrics to OKR key results |
| Project support | `Projects` (relation), `Publish Date` | Read: content output per active project |
| Content quality trend | `Content Quality Score`, `Publish Date` | Compute: rolling average quality over time |

---

## 2. Campaign Management Database

### Purpose
Orchestrate multi-channel, multi-content marketing initiatives with clear objectives, timelines, budgets, and ROI tracking.

---

### Core Properties

| Property | Type | Options / Format | Purpose |
|---|---|---|---|
| `Campaign` | Title | — | Campaign name |
| `ID` | Unique ID | CMP-### | Machine-readable reference |
| `Status` | Select | `Research`, `Planning`, `Active`, `Paused`, `Completed`, `Cancelled`, `Post-Analysis` | Campaign lifecycle |
| `Campaign Type` | Select | `Launch`, `Awareness`, `Lead Generation`, `Product Launch`, `Event`, `Brand Building`, `SEO`, `Community Growth`, `Partnership`, `Retargeting`, `Nurture` | Campaign classification |
| `Theme` | Rich Text | — | Central message / narrative thread |
| `Summary` | Rich Text | — | Executive summary of the campaign |
| `Objective` | Rich Text | — | Specific, measurable campaign objective |
| `Success Criteria` | Rich Text | — | What "win" looks like (specific metrics) |
| `Start Date` | Date | YYYY-MM-DD | Campaign launch |
| `End Date` | Date | YYYY-MM-DD | Campaign conclusion |
| `Duration` | Formula | Auto-calculated | Campaign length in days |
| `Phase` | Select | `Pre-Launch`, `Launch`, `Sustain`, `Amplify`, `Wind-Down` | Current campaign phase |
| `Platforms` | Multi-select | `YouTube`, `Instagram`, `X (Twitter)`, `LinkedIn`, `Substack`, `TikTok`, `Blog`, `Medium`, `Facebook`, `Threads`, `Email`, `Paid Ads` | Active platforms |
| `Content Types` | Multi-select | `Carousels`, `Essays`, `Threads`, `Case Studies`, `Videos`, `Reels`, `Podcasts`, `Webinars`, `Emails`, `Ads` | Content formats in use |
| `Content Frequency` | Select | `Daily`, `3x/week`, `Weekly`, `Bi-weekly`, `Burst (intensive)` | Publishing cadence |
| `Target Audience` | Rich Text | — | Detailed audience description |
| `Demographics` | Rich Text | — | Age, gender, location, income, education |
| `Psychographics` | Rich Text | — | Values, interests, pain points, aspirations |
| `Audience Size` | Number | — | Total addressable audience on target platforms |
| `Content Waterfall` | Rich Text | — | Waterfall strategy: hero piece → derivatives |
| `Key Messages` | Rich Text | — | 3-5 core messages for this campaign |
| `SEO Keywords` | Text | comma-separated | Target keyword cluster |
| `Hashtag Strategy` | Text | — | Campaign hashtag(s) |
| `Budget` | Number | — | Total allocated budget (USD or local currency) |
| `Budget Spent` | Number | — | Actual spend to date |
| `Budget Remaining` | Formula | Auto-calculated | `Budget - Budget Spent` |
| `Budget Breakdown` | Rich Text | — | Allocation by platform/channel |
| `Ad Spend` | Number | — | Paid media spend specifically |
| `Organic Spend` | Number | — | Production/effort cost (non-paid) |
| `Team` | Multi-select / People | — | Who's running this campaign |
| `External Partners` | Text | — | Agencies, freelancers, collaborators |
| `Assets` | Files & Media | — | Campaign creative assets (banners, templates) |
| `Campaign Brief URL` | URL | — | Link to full campaign brief document |
| `Landing Page URL` | URL | — | Primary destination URL |
| `Tracking URL / UTM` | Text | — | UTM parameters for this campaign |
| `Notes` | Rich Text | — | Internal campaign notes |

---

### Performance Metrics

| Property | Type | Purpose |
|---|---|---|
| `Target Reach` | Number | Reach goal for the campaign |
| `Actual Reach` | Number | Total unique people reached |
| `Reach %` | Formula | `if(prop("Target Reach") > 0, round(prop("Actual Reach") / prop("Target Reach") * 10000) / 100, 0)` |
| `Total Impressions` | Number | Sum across all content + paid |
| `Total Engagement` | Number | Sum of all engagement actions |
| `Engagement Rate` | Number | `if(prop("Actual Reach") > 0, round(prop("Total Engagement") / prop("Actual Reach") * 10000) / 100, 0)` |
| `Total Clicks` | Number | All link clicks from campaign content |
| `CTR` | Number | Click-through rate |
| `Total Leads` | Number | Email signups, form fills, inquiries |
| `Cost Per Lead` | Formula | `if(prop("Total Leads") > 0, round(prop("Budget Spent") / prop("Total Leads") * 100) / 100, 0)` |
| `Total Conversions` | Number | Sales, signups, or primary conversion action |
| `Conversion Rate` | Number | `if(prop("Total Clicks") > 0, round(prop("Total Conversions") / prop("Total Clicks") * 10000) / 100, 0)` |
| `Revenue Generated` | Number | Total revenue attributed to campaign |
| `ROI` | Formula | `if(prop("Budget Spent") > 0, round((prop("Revenue Generated") - prop("Budget Spent")) / prop("Budget Spent") * 10000) / 100, 0)` |
| `ROAS` | Formula | `if(prop("Budget Spent") > 0, round(prop("Revenue Generated") / prop("Budget Spent") * 100) / 100, 0)` |
| `New Followers Gained` | Number | Follower growth during campaign |
| `Content Pieces Published` | Number | Total content output |
| `Viral Score` | Select | `None`, `Low`, `Medium`, `High`, `Viral` | Did anything go viral? |
| `Sentiment` | Select | `Negative`, `Neutral`, `Positive`, `Mixed` | Overall campaign sentiment |
| `Lessons Learned` | Rich Text | — | Post-campaign retrospective |
| `Last Metrics Update` | Date | — | When performance data was last refreshed |

---

### Formula Properties

| Property | Formula | Purpose |
|---|---|---|
| `Duration (days)` | `if(prop("Start Date") and prop("End Date"), dateBetween(prop("End Date"), prop("Start Date"), "days") + 1, empty)` | Campaign length |
| `Days Remaining` | `if(prop("End Date"), dateBetween(prop("End Date"), now(), "days"), empty)` | Countdown to end |
| `Days Active` | `if(prop("Start Date") and now() > prop("Start Date"), dateBetween(now(), prop("Start Date"), "days"), 0)` | How long campaign has been running |
| `Budget Burn Rate` | `if(prop("Days Active") > 0, round(prop("Budget Spent") / prop("Days Active") * 100) / 100, 0)` | Daily spend rate |
| `Budget On Track?` | `if(prop("Days Remaining") > 0, if(prop("Budget Remaining") / prop("Days Remaining") >= prop("Budget Burn Rate"), "✅ On Track", "⚠️ Overspending"), if(prop("Budget Remaining") >= 0, "✅ Complete", "❌ Over Budget"))` | Budget health check |
| `Campaign Health` | `if(prop("Status") == "Cancelled", "❌ Cancelled", if(prop("Status") == "Completed", "✅ Completed", if(prop("Reach %") >= 80 and prop("ROI") >= 0, "🟢 Strong", if(prop("Reach %") >= 50 and prop("ROI") >= -20, "🟡 On Track", "🔴 At Risk"))))` | Overall health composite |
| `Content Velocity` | `if(prop("Days Active") > 0, round(prop("Content Pieces Published") / (prop("Days Active") / 7) * 10) / 10, 0)` | Pieces per week |
| `Reach Efficiency` | `if(prop("Budget Spent") > 0, round(prop("Actual Reach") / prop("Budget Spent") * 100) / 100, 0)` | Reach per dollar spent |
| `Lead Quality Score` | `if(prop("Total Conversions") > 0, round(prop("Total Conversions") / prop("Total Leads") * 10000) / 100, 0)` | Lead-to-conversion rate |
| `Is Active` | `if(prop("Status") == "Active", "🔴 LIVE", "⚪ Inactive")` | Quick status flag |
| `Time Phase` | `if(prop("Start Date") == empty, "Not Started", if(now() < prop("Start Date"), format(dateBetween(prop("Start Date"), now(), "days")) + "d to launch", if(prop("End Date") != empty and now() > prop("End Date"), "Ended " + format(dateBetween(now(), prop("End Date"), "days")) + "d ago", "Day " + format(dateBetween(now(), prop("Start Date"), "days")))))` | Human-readable timeline |

---

### Rollup Properties

| Property | Rollup From | Function | Purpose |
|---|---|---|---|
| `Content Pieces` | → Content Pipeline (relation) | Count | Total content items in this campaign |
| `Total Content Reach` | → Content Pipeline (relation) | Sum | Combined reach of all campaign content |
| `Total Content Engagement` | → Content Pipeline (relation) | Sum | Combined engagement across all content |
| `Total Content Clicks` | → Content Pipeline (relation) | Sum | Combined clicks from all content |
| `Total Content Leads` | → Content Pipeline (relation) | Sum | Combined leads from all content |
| `Total Content Revenue` | → Content Pipeline (relation) | Sum | Combined revenue from all content |
| `Published Count` | → Content Pipeline (relation) | Count where `Status` = `Published 💥` | How many pieces are live |
| `Upcoming Count` | → Content Pipeline (relation) | Count where `Status` ≠ `Published 💥` | How many pieces are pending |
| `Avg Content Quality` | → Content Pipeline (relation) | Average of `Content Quality Score` | Quality benchmark for campaign |
| `Top Performing Piece` | → Content Pipeline (relation) | Show original sorted by `Content Score` | Best content in campaign |
| `Projects Supported` | → Projects (relation) | Show original | Which projects this campaign serves |

---

### Relation Properties

| Property | Relates To | Direction | Purpose |
|---|---|---|---|
| `Content Pipeline` | Content Pipeline | One-to-Many | All content pieces in this campaign |
| `Projects` | Projects | Many-to-Many | Which projects this campaign supports |
| `Quarterly Goals` | Quarterly Goals | Many-to-Many | Which OKRs this campaign advances |
| `People` | People | Many-to-Many | Team members, partners, influencers |
| `Financial Log` | Financial Log | One-to-Many | Campaign expenses and revenue entries |
| `Systemic Journal` | Systemic Journal | One-to-Many | Campaign reflections and learnings |

---

### What to ADD (missing but critical)

| Property | Why It Matters |
|---|---|
| **`Campaign Type`** | Classifies campaigns for strategy analysis. Currently missing. |
| **`Objective` + `Success Criteria`** | Every campaign needs measurable goals. Currently only implied. |
| **`Phase`** | Campaign lifecycle stage (pre-launch → wind-down). Enables phase-specific actions. |
| **`Audience Size`** | TAM for reach efficiency calculation. |
| **`Key Messages`** | Messaging consistency check across content pieces. |
| **`Hashtag Strategy`** | Campaign-specific hashtags for tracking. |
| **`Budget` + `Budget Spent` + `Budget Breakdown`** | Financial tracking per campaign. Currently missing entirely. |
| **`Ad Spend` + `Organic Spend`** | Separate paid vs. organic cost analysis. |
| **`Team` + `External Partners`** | Resource and accountability tracking. |
| **`Campaign Brief URL`** | Central doc link for campaign context. |
| **`Landing Page URL`** | Primary conversion destination. |
| **`Tracking URL / UTM`** | Attribution tracking. |
| **`Total Impressions`** | Separate from reach. |
| **`Total Clicks` + `CTR`** | Conversion funnel metrics. |
| **`Total Leads` + `Cost Per Lead`** | Lead gen efficiency. |
| **`Total Conversions` + `Conversion Rate`** | Bottom-of-funnel metrics. |
| **`Revenue Generated` + `ROI` + `ROAS`** | Financial return measurement. |
| **`New Followers Gained`** | Audience growth attribution. |
| **`Content Pieces Published`** | Output tracking. |
| **`Sentiment`** | Qualitative campaign health. |
| **`Lessons Learned`** | Post-campaign institutional memory. |
| **`Last Metrics Update`** | Data freshness tracking. |
| **`Notes`** | Working context. |

---

### What to REMOVE (noise without marketing value)

| Current Property | Why Remove | Replacement |
|---|---|---|
| `content_pipeline` (relation as single field) | Too vague — should be the canonical One-to-Many relation | Keep but clarify as relation to Content Pipeline DB |
| `engagement_rate` (manually entered text) | Should be formula-computed from engagement ÷ reach | Replace with formula `Engagement Rate` |
| `conversion_rate` (manually entered text) | Should be formula-computed from conversions ÷ clicks | Replace with formula `Conversion Rate` |
| `viral_score` (manual text) | Make it a structured select field with defined options | Replace with Select: `None/Low/Medium/High/Viral` |

---

### Agent Workflow Simulation

#### Step 1: Campaign Calendar Review

| Action | Properties | Operation |
|---|---|---|
| Active campaigns | `Status`, `Start Date`, `End Date` | Filter: `Status` = `Active` |
| Upcoming launches | `Status`, `Start Date` | Filter: `Status` = `Planning` AND `Start Date` within 14d |
| Overdue campaigns | `End Date`, `Status`, `Days Remaining` | Filter: `Days Remaining` < 0 AND `Status` ≠ `Completed` |
| Campaign load | `Status`, `Campaign Type` | Read: count active by type |

#### Step 2: Campaign Health Check

| Action | Properties | Operation |
|---|---|---|
| Health dashboard | `Campaign Health` (formula), `Status`, `Reach %`, `ROI` | Read: all active campaigns |
| Budget tracking | `Budget`, `Budget Spent`, `Budget On Track?`, `Budget Burn Rate` | Filter: `Budget On Track?` = ⚠️ or ❌ |
| Content output | `Content Pieces Published`, `Content Velocity`, `Upcoming Count` | Read: output vs. plan |
| Timeline pressure | `Days Remaining`, `Upcoming Count`, `Content Frequency` | Compute: can remaining content meet cadence? |

#### Step 3: Campaign Optimization

| Action | Properties | Operation |
|---|---|---|
| Platform performance | `Platforms`, `Total Content Reach` (rollup), `Total Content Engagement` (rollup) | Group by platform → identify winners/losers |
| Content type effectiveness | `Content Types`, `Avg Content Quality` (rollup), `Total Content Leads` (rollup) | Identify which content types drive results |
| Budget reallocation | `Budget Burn Rate`, `Reach Efficiency`, `Cost Per Lead` | Compute: which channels get more budget |
| Waterfall audit | `Content Waterfall`, `Content Pieces` (rollup), `Published Count` | Read: is waterfall strategy executing? |

#### Step 4: Performance Analysis

| Action | Properties | Operation |
|---|---|---|
| ROI analysis | `ROI`, `ROAS`, `Revenue Generated`, `Budget Spent` | Sort: `ROI` DESC across all completed campaigns |
| Lead gen efficiency | `Cost Per Lead`, `Lead Quality Score`, `Total Leads` | Compare: CPL across campaign types |
| Reach efficiency | `Reach Efficiency`, `Audience Size`, `Reach %` | Compute: % of TAM reached |
| Funnel analysis | `Total Impressions`, `Actual Reach`, `Total Clicks`, `Total Leads`, `Total Conversions` | Compute: impression → reach → click → lead → conversion rates |

#### Step 5: Strategic Alignment

| Action | Properties | Operation |
|---|---|---|
| OKR mapping | `Quarterly Goals` (relation), `Revenue Generated`, `Total Leads` | Read: campaign contribution to OKRs |
| Project support | `Projects` (relation), `Status` | Read: campaigns per active project |
| Resource allocation | `Team`, `Budget`, `Content Pieces` | Compute: effort/output ratio per campaign |
| Portfolio balance | `Campaign Type`, `Status`, `Budget` | Matrix: type × budget → find imbalances |

#### Step 6: Post-Campaign Analysis

| Action | Properties | Operation |
|---|---|---|
| Retrospective | `Status`, `Lessons Learned`, `ROI`, `Sentiment` | Filter: `Status` = `Completed` → extract learnings |
| Benchmark creation | `ROI`, `Reach %`, `Cost Per Lead`, `Conversion Rate` | Compute: averages by campaign type for future planning |
| Content legacy | `Content Pieces` (rollup), `Total Content Reach` (rollup) | Identify evergreen content to repurpose |
| Relationship value | `People` (relation), `External Partners` | Read: which partners delivered value |

---

## 3. Projects Database (Content Dimension)

### Purpose
Projects that produce content as their primary output. The bridge between strategic goals and content execution.

> **Note**: Projects DB serves ALL domains. This section covers only the properties relevant to the CMO's content operations.

---

### Current Properties (Retained for CMO use)

| Property | Type | Purpose for CMO |
|---|---|---|
| `Project` | Title | Project identifier |
| `ID` | Unique ID | Machine reference (PROJ-###) |
| `Status` | Select | `Active`, `Done`, `On Hold`, `Cancelled`, `Someday/Maybe`, `Delegated` |
| `Priority` | Select | ⭐ to ⭐⭐⭐⭐⭐ |
| `Deadline` | Date | Project completion target |
| `Project Start` | Date | When work began |
| `Progress` | Number (0-100) | Completion percentage |
| `KPI` | Text | Key performance indicator for this project |
| `Strategy` | Text | How this project achieves its goal |
| `Project Summary` | Text | One-line description |
| `Campaigns` | Relation → Campaigns | Campaigns this project drives |
| `People` | Relation → People | Team/stakeholders |
| `Quarterly Goals` | Relation → Quarterly Goals | OKR alignment |
| `Tasks` | Relation → Tasks | Execution items |

---

### Content-Specific Properties to ADD

| Property | Type | Purpose |
|---|---|---|
| `Content Strategy` | Rich Text | How content drives this project's success |
| `Target Audience` | Rich Text | Who this project's content is for |
| `Content Goals` | Rich Text | Specific content objectives (awareness, leads, authority) |
| `Primary Channel` | Select | `YouTube`, `Blog`, `LinkedIn`, `X (Twitter)`, `Podcast`, `Newsletter`, `Instagram`, `Multi-channel` | Main distribution channel |
| `Content Volume Target` | Number | Target number of content pieces for this project |
| `Content Produced` | Rollup → Content Pipeline | Count of content pieces linked to this project |
| `Content Completion %` | Formula | `if(prop("Content Volume Target") > 0, round(prop("Content Produced") / prop("Content Volume Target") * 10000) / 100, 0)` |
| `Total Content Reach` | Rollup → Content Pipeline | Sum of reach from all project content |
| `Total Content Engagement` | Rollup → Content Pipeline | Sum of engagement from all project content |
| `Total Content Leads` | Rollup → Content Pipeline | Sum of leads from all project content |
| `Total Content Revenue` | Rollup → Content Pipeline | Sum of revenue from all project content |
| `Content Budget` | Number | Allocated budget for content production |
| `Content Budget Spent` | Number | Actual content spend |
| `Content ROI` | Formula | `if(prop("Content Budget Spent") > 0, round((prop("Total Content Revenue") - prop("Content Budget Spent")) / prop("Content Budget Spent") * 10000) / 100, 0)` |
| `Content Health` | Formula | Composite of progress, quality, and engagement metrics |
| `Brand Guidelines` | Files & Media | Brand assets, voice guidelines, templates |
| `Content Calendar URL` | URL | Link to external content calendar if used |
| `Distribution Strategy` | Rich Text | How content will be distributed and amplified |
| `Content Pillars` | Multi-select | `P1: Meta-Theory`, `P2: AI Consulting`, `P3: LifeOS`, `P4: Counselling`, `P5: Activism` | Which pillars this project covers |

---

### Formula Properties

| Property | Formula | Purpose |
|---|---|---|
| `Content Completion %` | See above | Content output vs. target |
| `Content ROI` | See above | Financial return on content investment |
| `Content Health` | `if(prop("Content Produced") >= prop("Content Volume Target"), "✅ Target Met", if(prop("Content Produced") >= prop("Content Volume Target") * 0.75, "🟢 On Track", if(prop("Content Produced") >= prop("Content Volume Target") * 0.5, "🟡 Behind", "🔴 Critical")))` | Content production health |
| `Engagement per Piece` | `if(prop("Content Produced") > 0, round(prop("Total Content Engagement") / prop("Content Produced") * 100) / 100, 0)` | Average engagement per content piece |
| `Reach per Piece` | `if(prop("Content Produced") > 0, round(prop("Total Content Reach") / prop("Content Produced") * 100) / 100, 0)` | Average reach per content piece |
| `Days to Deadline` | `if(prop("Deadline"), dateBetween(prop("Deadline"), now(), "days"), empty)` | Deadline countdown |
| `Is Content Overdue` | `if(prop("Deadline") and prop("Deadline") < now() and prop("Status") != "Done", "🔴 Overdue", "✅ On Track")` | Deadline flag |

---

### Rollup Properties

| Property | Rollup From | Function | Purpose |
|---|---|---|---|
| `Campaigns Count` | → Campaigns | Count | How many campaigns this project drives |
| `Active Campaigns` | → Campaigns | Count where `Status` = `Active` | Currently running campaigns |
| `Content Pieces` | → Content Pipeline | Count | Total content output |
| `Published Content` | → Content Pipeline | Count where `Status` = `Published 💥` | Live content count |
| `Scheduled Content` | → Content Pipeline | Count where `Status` = `Scheduled` | Upcoming content |
| `Content in Production` | → Content Pipeline | Count where `Status` in production stages | Work in progress |
| `Avg Content Quality` | → Content Pipeline | Average of `Content Quality Score` | Quality benchmark |
| `Top Content Piece` | → Content Pipeline | Show original by `Content Score` DESC | Best performing piece |
| `Total Campaign Reach` | → Campaigns | Sum of `Actual Reach` | Campaign-level reach |
| `Total Campaign Budget` | → Campaigns | Sum of `Budget` | Total campaign investment |

---

### What to ADD (for CMO efficacy)

| Property | Why It Matters |
|---|---|
| **`Content Strategy`** | Documents how content drives project success. Currently missing. |
| **`Target Audience`** | Project-level audience definition. |
| **`Content Goals`** | Specific content objectives separate from project KPIs. |
| **`Primary Channel`** | Main distribution channel for focus. |
| **`Content Volume Target`** | Quantitative content production goal. |
| **Content rollups** | Reach, engagement, leads, revenue aggregated from content pieces. |
| **`Content Budget` + `Content Budget Spent`** | Financial tracking specific to content. |
| **`Content ROI`** | Content-specific financial return. |
| **`Content Health`** | Composite content production status. |
| **`Brand Guidelines`** | Centralized brand asset access. |
| **`Content Calendar URL`** | External calendar linking. |
| **`Distribution Strategy`** | How content gets amplified. |
| **`Content Pillars`** | Which pillars this project serves. |

---

### What to REMOVE (for CMO focus)

| Current Property | Why Remove for CMO View |
|---|---|
| `health` (formula) | Replace with `Content Health` for content-specific view |
| `progress` (general) | Keep, but supplement with `Content Completion %` for content dimension |

> **Note**: These properties serve other domains. Don't remove from the DB — create a CMO-specific view that surfaces content properties prominently.

---

### Agent Workflow Simulation

#### Step 1: Project Portfolio Review

| Action | Properties | Operation |
|---|---|---|
| Active projects | `Status`, `Priority` | Filter: `Status` = `Active` |
| Content production status | `Content Produced`, `Content Volume Target`, `Content Completion %` | Read: output vs. target per project |
| Content health | `Content Health` (formula), `Status` | Filter: `Content Health` = 🔴 or 🟡 |

#### Step 2: Content Performance by Project

| Action | Properties | Operation |
|---|---|---|
| Reach leaders | `Total Content Reach`, `Content Produced`, `Reach per Piece` | Sort: `Reach per Piece` DESC |
| Engagement leaders | `Total Content Engagement`, `Engagement per Piece` | Sort: `Engagement per Piece` DESC |
| Revenue leaders | `Total Content Revenue`, `Content ROI` | Sort: `Content ROI` DESC |
| Underperforming projects | `Content Health`, `Content Completion %` | Filter: `Content Health` ≠ ✅ |

#### Step 3: Strategic Alignment

| Action | Properties | Operation |
|---|---|---|
| OKR alignment | `Quarterly Goals` (relation), `Content Volume Target`, `Content Produced` | Read: content output per OKR |
| Campaign coverage | `Campaigns Count`, `Active Campaigns` | Read: projects driving campaigns |
| Pillar distribution | `Content Pillars`, `Content Produced` | Matrix: pillar × project → find gaps |
| Resource allocation | `Content Budget`, `Content Budget Spent`, `Content ROI` | Compute: budget efficiency per project |

#### Step 4: Content Planning

| Action | Properties | Operation |
|---|---|---|
| Capacity planning | `Content Volume Target`, `Content Produced`, `Days to Deadline` | Compute: required pace to hit target |
| Gap analysis | `Content Pillars`, `Content Volume Target` | Read: which pillars are underserved |
| Channel strategy | `Primary Channel`, `Content Produced` | Read: channel distribution across projects |
| Content waterfall | `Content Pillars`, `Content Strategy` | Plan: hero pieces that can cascade across projects |

---

## Cross-Database Architecture

### Data Flow Diagram

```
Quarterly Goals
    ↓ (relation)
Projects ────→ Content Pipeline
    ↓              ↓
Campaigns ←── (relation)
    ↓
Financial Log (budget, revenue, ROI)
    ↓
Content Pipeline (performance metrics)
    ↓
Rollups → Campaign dashboards → Project scorecards → OKR progress
```

### Key Relations Map

| From | To | Type | Purpose |
|---|---|---|---|
| Content Pipeline | Campaigns | Many-to-Many | Content serves campaigns |
| Content Pipeline | Projects | Many-to-One | Content supports projects |
| Content Pipeline | Content Pipeline (self) | Many-to-Many | Parent/child for repurposing |
| Content Pipeline | Quarterly Goals | Many-to-Many | Content advances OKRs |
| Content Pipeline | People | Many-to-Many | Collaborators, subjects |
| Content Pipeline | Financial Log | One-to-Many | Content costs and revenue |
| Campaigns | Projects | Many-to-Many | Campaigns execute projects |
| Campaigns | Quarterly Goals | Many-to-Many | Campaigns advance OKRs |
| Campaigns | Financial Log | One-to-Many | Campaign budget and revenue |
| Campaigns | Content Pipeline | One-to-Many | Campaign contains content |
| Projects | Campaigns | One-to-Many | Projects drive campaigns |
| Projects | Quarterly Goals | Many-to-Many | Projects execute OKRs |
| Projects | Financial Log | One-to-Many | Project costs and revenue |

### Computed Metrics Chain

```
Content Piece Level:
  Reach, Engagement, Clicks → Engagement Rate, Content Score, CTR

Campaign Level (rollups from content):
  Total Reach, Total Engagement, Total Leads, Total Revenue
  → ROI, ROAS, Cost Per Lead, Campaign Health

Project Level (rollups from content + campaigns):
  Content Completion %, Content ROI, Content Health
  → Project Health, OKR Progress
```

---

## Implementation Priority

### Phase 1: Critical Adds (immediate CMO efficacy)
1. `Topic / Hook` — Content Pipeline
2. `Content Type` — Content Pipeline (separate from Format)
3. `CTA` + `CTA Link` — Content Pipeline
4. `Campaign Type` — Campaigns
5. `Objective` + `Success Criteria` — Campaigns
6. `Budget` + `Budget Spent` — Campaigns
7. `Revenue Generated` — Content Pipeline + Campaigns
8. `ROI` formula — Campaigns
9. `Content Volume Target` — Projects
10. Content rollups — all three databases

### Phase 2: Performance Granularity
1. Broken-out engagement metrics (Likes, Comments, Shares, Saves)
2. Watch time and completion rate fields
3. Sentiment scoring
4. Cost Per Lead formula
5. Lead Quality Score
6. Efficiency Score formulas

### Phase 3: Strategic Depth
1. Content quality scoring
2. SEO scoring
3. Brand guidelines attachment
4. Distribution strategy documentation
5. Content waterfall planning
6. Lessons learned fields

### Phase 4: Advanced Analytics
1. Content decay tracking
2. Evergreen identification
3. Viral detection
4. Predictive reach modeling
5. Optimal publish time recommendations

---

## Summary: Property Counts

| Database | Current | Proposed Adds | Proposed Removals | Net Total |
|---|---|---|---|---|
| **Content Pipeline** | 21 | ~38 | 1 (refactor) | ~58 |
| **Campaigns** | 20 | ~28 | 3 (refactor) | ~45 |
| **Projects (CMO)** | 14 (shared) | ~18 | 0 (view-level) | ~32 (CMO view) |

> **Total CMO schema**: ~135 properties across 3 databases, each serving a specific CMO decision or action.
