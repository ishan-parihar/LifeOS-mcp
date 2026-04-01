# LifeOS Database Schema Audit

Generated: 2026-04-01T09:05:04.591Z

## activity_log (Activity Log)

No status/select/multi_select properties.

## tasks (Tasks)

### Status (status)
All options: Waiting, Paused, Delegated, Up Next, Active, Focus, Done, Cancelled, Archived
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

### Priority (select)
Options: ⭐⭐⭐⭐⭐, ⭐⭐⭐⭐, ⭐⭐⭐, ⭐⭐, ⭐, P1 - Critical, P2 - High

## days (Days)

No status/select/multi_select properties.

## weeks (Weeks)

No status/select/multi_select properties.

## months (Months)

No status/select/multi_select properties.

## quarters (Quarters)

No status/select/multi_select properties.

## years (Years)

No status/select/multi_select properties.

## projects (Projects)

### Status (status)
All options: Cancelled, Someday/Maybe, On Hold, Delegated, Active, Done
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

### Priority (select)
Options: ⭐⭐⭐⭐⭐, ⭐⭐⭐⭐, ⭐⭐⭐, ⭐⭐, ⭐

## subjective_journal (Subjective Journal)

No status/select/multi_select properties.

## relational_journal (Relational Journal)

No status/select/multi_select properties.

## systemic_journal (Systemic Journal)

### Impact (select)
Options: P5: Note, P4: Low, P3: Medium, P2: High, P1: Critical

## financial_log (Financial Log)

### Capital Engine (select)
Options: E (Employment), S (Self-employment), B (Business), I (Investment), Personal

### Category (select)
Options: Business Revenue, Pocket Money, Client Payment, Investment Income, Income, Investments/Trading, House Expenses, Food & Dining, Utilities, Family Times, Transportation, Business Expenses, Rent/Mortgage, Account Transfer, Miscellaneous

## diet_log (Diet Log)

No status/select/multi_select properties.

## quarterly_goals (Quarterly Goals)

### Status (status)
All options: Planning, On Hold, At Risk, Off Track, On Track, Done
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

## annual_goals (Annual Goals)

### Status (status)
All options: Draft, Active, Achieved, Not Achieved, Archived
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

### Goal Archetype (select)
Options: Build (Create something new), Achieve (Reach a specific milestone), Become (Embody a new identity/skillset), Eliminate (Remove a major constraint)

## directives_risk_log (Directives & Risk Log)

### Log Type (select)
Options: 🛡️ Directive, 🔥 Risk

### Status (status)
All options: Identified, Active, Mitigated, Archived
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

### Likelihood (select)
Options: 🔴 High, 🟡 Medium, 🟢 Low

### Impact (select)
Options: 🔴 High, 🟡 Medium, 🟢 Low

## opportunities_strengths (Opportunities & Strengths Log)

### Log Type (select)
Options: 💡 Opportunity, 💪 Strength

### Leverage Score (select)
Options: 🌱 Seed, 📈 Medium-Impact, 🚀 High-Leverage

### Status (status)
All options: 💡 Identified, ✅ Activated, 🏆 Capitalized, 🧊 Archived
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

## people (People)

### Networking Profile (select)
Options: Key Ally, Active Collaborator, Mentor / Advisor, Protégé / Mentee, Peer / Sounding Board, Inactive, Archive

### Value Exchange Balance (select)
Options: I am in Credit, Balanced, I am in Debt

### Relationship Status (select)
Options: Family Member, Mentor, Close Friend, Close Acquiantance, Coworker, Acquiantance

### Core Shadow (select)
Options: Fear of Insignificance, Fear of Rejection, Fear of Chaos/Uncertainty, Fear of Powerlessness/Domination

### Developmental Altitude (select)
Options: LVL 3: Red (Egocentric Power), LVL 4: Amber (Mythic Order / Conformist), LVL 5: Orange (Rational Achievement), LVL 6: Green (Pluralistic / Relativistic), LVL 7: Turquoise (Integral / Systemic)

### Aspirational Drive (select)
Options: Security & Stability, Connection & Belonging, Status & Recognition, Mastery & Impact, Growth & Understanding

### Influence Toolkit (multi_select)
Options: Strategic Persuasion, Inspirational & Charismatic, Collaborative, Coercive Influence, Elicits Pity/Guilt, Creates Desire (The Covetous Object)

### Temporal Focus (select)
Options: Operational (Now/Days), Tactical (Weeks/Months), Strategic (Quarters/Years), Legacy (Decades+)

### Primary Center of Intelligence (select)
Options: Cognitive (Logic Data Frameworks), Affective (Feelings Relational Dynamics Empathy), Somatic (Instinct Embodied Sensation Kinaesthetics)

### Dominant Power Strategy (select)
Options: Directing (Power Over), Collaborating (Power With), Inspiring (Power Through), Mastering (Power From Within), Gatekeeping (Power by Controlling Access)

### City (select)
Options: Noida, Janakpuri, Delhi, Greater Noida, Gurgaon, Ghaziabad, Faridabad, Meerut, Aligarh, Varanasi, Mumbai, Bihar, Dubai, Edison NJ, Chicago IL, Netherlands, US, Canada, Britain, Pune

### Primary Conflict Style (select)
Options: Competing, Accommodating, Avoiding, Collaborating, Compromising

### Desired Trajectory (select)
Options: Deepen, Maintain, Activate, Graceful Exit, Inactive

### Stability Profile (select)
Options: The Anchor (Principled -> Rigid), The Weaver (Adaptable -> Evasive), The Rock (Dependable -> Withdrawn), The Warrior (Assertive -> Aggressive)

### Explanatory Style (select)
Options: The Pragmatist (External Temporary Specific), The Hero (Internal Temporary Specific), The Martyr (External Permanent Pervasive), The Victim (Internal Permanent Pervasive)

## campaigns (Campaign Management)

### Content Types (multi_select)
Options: Carousels, Essays, Threads, Case Studies, Videos, Reels

### Automation Workflows (multi_select)
Options: Morning Brief, Evening Synthesis, Weekly Report, Journal AI Analysis, LinkedIn Post Scheduler, Lead Nurture Sequence, CRM Integration, Substack Newsletter, YouTube Upload Notify, Twitter Thread Scheduler, Session Booking Notify, Follow-up Sequence, Client Onboarding, RSS News Aggregation, Story Brief Generator, Trade Journal Auto-Log, Performance Report Generator, Backtest Results Notify, Cross-Platform Scheduler, Analytics Aggregator, Content Calendar Sync

### Platforms (multi_select)
Options: LinkedIn, Instagram, Twitter/X, Substack, YouTube, TikTok

### Content Frequency (select)
Options: Daily, 3x/week, Weekly

## content_pipeline (Content Pipeline)

### Status (status)
All options: Potential Idea, Scheduled, Next Up 🚩, Writing 📝, Recording ⏺, Editing 🎞, Ready to Post 📤, Published 💥
  Group "To-do": 
  Group "In progress": 
  Group "Complete": 

### Platforms (multi_select)
Options: YouTube, Facebook, Instagram, X (Twitter), Threads, LinkedIn, Blog, Medium, Substack

### Tone (select)
Options: Intellectual, Authentic/Vulnerable, Practical/How-to, Analytic, Urgent

### Funnel Stage (select)
Options: TOFU (Awareness), MOFU (Nurture), BOFU (Conversion)

### Format (multi_select)
Options: 45-90 Sec Reel, 5-10 Min Video, 30-60 Min Podcast, Blog, Newsletter, FB/Linkedin/X Post

### Pillar (select)
Options: P1: Meta-Theory, P2: AI Consulting, P3: LifeOS, P5: Counselling, P5: Activism

## activity_types (Activity Types)

### Frequency (select)
Options: Once every Week, 4 Times a Day, Twice Every Week, Every Day, Once every 4 days

## reports (Reports)

### Agent (select)
Options: Psychologist, Productivity, Relational, Strategic, Nutritionist, Financial

