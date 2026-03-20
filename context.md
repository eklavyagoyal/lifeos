# Context Handoff

Update this file after each implementation pass. Treat it as the canonical handoff note for the next chat: summarize what changed, what was verified, any important repo state, and what should happen next.

## Current Status

This repo has completed a substantial Wave 1 foundation pass, three meaningful Wave 2 slices, and three major Wave 3 slices:

- Capture and Inbox 2.0
- Scheduler, recurring jobs, and multi-period review generation
- Reviews 2.0 plus milestones/goal rollups
- Search, backlinks, graph focus, and event detail navigation
- Importers plus local attachment storage/linking
- Attachment-aware discovery plus capture-first PWA/offline capture
- Import preview diffing, mapping visibility, and rollback-safe import runs

The codebase is currently in a good working state locally:

- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `pnpm build` passes

## Roadmap Source

The active gameplan is the 10-item `plan.md` roadmap discussed in the previous chat. It has not been fully implemented yet. This file is the working continuation summary for that plan.

High-level roadmap buckets:

1. Wave 1: quality floor, runtime hardening, performance and scale
2. Wave 2: capture/inbox, recurrence/scheduler, reviews 2.0, milestones/goals
3. Wave 3: search/graph/backlinks, importers, PWA/attachments

## Implemented So Far

### 1. Wave 1: Quality Floor and Runtime Hardening

Implemented:

- Shared app version via [src/lib/app-info.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/app-info.ts)
- Runtime diagnostics and environment validation via [src/server/services/runtime.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.ts)
- Runtime database checks now validate required columns as well as required tables, and surface explicit migration-needed errors for stale schemas via [src/server/services/runtime.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.ts)
- Real readiness output in [src/app/api/health/route.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/api/health/route.ts)
- Runtime/auth/backup diagnostics surfaced in [src/app/(app)/settings/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/settings/page.tsx)
- Authenticated app routes now assert DB readiness before rendering through [src/app/(app)/layout.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/layout.tsx), so stale databases fail early with an actionable `pnpm db:migrate` message instead of a later SQLite missing-column crash
- Shared version usage in [src/server/services/system.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/system.ts) and [src/server/services/export.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/export.ts)

Developer quality floor:

- ESLint CLI wiring in [package.json](/Users/eklavya.goyal/Projects/lifeOS/package.json)
- ESLint config in [.eslintrc.cjs](/Users/eklavya.goyal/Projects/lifeOS/.eslintrc.cjs)
- Vitest config in [vitest.config.ts](/Users/eklavya.goyal/Projects/lifeOS/vitest.config.ts)
- CI workflow in [.github/workflows/ci.yml](/Users/eklavya.goyal/Projects/lifeOS/.github/workflows/ci.yml)
- Temp DB test helpers in [src/test/test-db.ts](/Users/eklavya.goyal/Projects/lifeOS/src/test/test-db.ts)
- Regression tests in:
  - [src/server/services/runtime.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.test.ts)
  - [src/server/services/search.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.test.ts)
  - [src/server/services/reviews.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/reviews.test.ts)
  - Expanded stale-schema coverage in [src/server/services/runtime.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.test.ts)

### 2. Wave 1: Performance and Search Improvements

Implemented:

- Search FTS migration and incremental sync in [src/server/services/search.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.ts)
- Search sync hooks added across CRUD services:
  - [src/server/services/tasks.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/tasks.ts)
  - [src/server/services/habits.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/habits.ts)
  - [src/server/services/journal.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/journal.ts)
  - [src/server/services/notes.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/notes.ts)
  - [src/server/services/ideas.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/ideas.ts)
  - [src/server/services/projects.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/projects.ts)
  - [src/server/services/goals.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/goals.ts)
  - [src/server/services/entities.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/entities.ts)
- Deterministic graph layout in [src/server/services/graph.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph.ts)
- Inbox count optimization in [src/server/services/inbox.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/inbox.ts)

### 3. Build Reliability for Self-Hosting

Implemented:

- Removed Google Fonts runtime dependency from [src/app/layout.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/layout.tsx)
- Switched Tailwind sans stack in [tailwind.config.ts](/Users/eklavya.goyal/Projects/lifeOS/tailwind.config.ts)
- Added [pnpm-workspace.yaml](/Users/eklavya.goyal/Projects/lifeOS/pnpm-workspace.yaml) to allow native `better-sqlite3` builds under pnpm 10

Important note:

- `pnpm-lock.yaml` changed substantially during dependency/install work

### 4. Wave 2: Capture and Inbox 2.0

Implemented:

- Shared typed capture parser and materializer in [src/server/services/capture.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture.ts)
- Expanded capture types in [src/lib/types.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/types.ts)
- Inbox service now uses capture previews in [src/server/services/inbox.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/inbox.ts)
- Server actions for preview, smart submit, and bulk triage in [src/app/actions.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/actions.ts)
- Live preview command bar in [src/components/capture/quick-capture.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/capture/quick-capture.tsx)
- Bulk triage inbox UI in [src/components/inbox/inbox-item-list.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/inbox/inbox-item-list.tsx)
- Parser and materialization tests in [src/server/services/capture.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture.test.ts)

Behavior now supported:

- Parse captures into task, note, idea, journal, metric, entity, or inbox suggestions
- Parse tags like `#health`
- Parse priorities like `p1`
- Parse due dates like `today`, `tomorrow`, `next week`, or ISO date
- Parse project references for tasks
- Parse metric captures like `sleep 7.5`
- Parse entity-style prefixes like `person:`, `book:`, `article:`, `course:`
- Smart create directly from capture when confidence is high
- Inbox fallback when the parser cannot safely materialize
- Bulk keyboard-driven inbox triage

Keyboard shortcuts now in inbox:

- `A` select all
- `Enter` apply suggested conversion
- `T` convert selection to tasks
- `N` convert selection to notes
- `D` dismiss selection
- `Escape` clear selection

### 5. Wave 2: Scheduler, Recurrence, and Reviews Foundation

Implemented:

- Scheduler state tables in [src/server/db/schema.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/db/schema.ts):
  - `scheduled_jobs`
  - `job_runs`
- Generated migration and snapshot:
  - [drizzle/migrations/0001_watery_gunslinger.sql](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/0001_watery_gunslinger.sql)
  - [drizzle/migrations/meta/0001_snapshot.json](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/meta/0001_snapshot.json)
- New scheduler service in [src/server/services/scheduler.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/scheduler.ts)
- Runtime diagnostics now include scheduler health in [src/server/services/runtime.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.ts)
- Export now includes scheduler tables in [src/server/services/export.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/export.ts)
- Task service now supports `recurrenceRule` and syncs recurrence jobs in [src/server/services/tasks.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/tasks.ts)
- Project service now syncs scheduled review reminder jobs in [src/server/services/projects.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/projects.ts)
- Reviews service was generalized in [src/server/services/reviews.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/reviews.ts)
- Review snapshot builder was generalized in [src/server/services/aggregation.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/aggregation.ts)
- Review list/detail UI now shows real review types and correctly reads the actual snapshot shape:
  - [src/app/(app)/reviews/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/reviews/page.tsx)
  - [src/app/(app)/reviews/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/reviews/[id]/client.tsx)
- Added typed review action entry point in [src/app/actions.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/actions.ts)

Behavior now supported:

- Persistent scheduled jobs with idempotent run logs
- Cron-backed scheduler bootstrap in long-lived app processes
- Recurring task materialization from completed tasks with supported rules:
  - `daily`
  - `weekdays`
  - `weekly`
  - `biweekly`
  - `monthly`
- Scheduled project review reminder tasks based on `reviewCadence`
- Daily, weekly, monthly, and yearly review draft generation through one review service
- Daily stale-project scans that create check-in tasks for long-idle active projects
- Scheduler health surfaced through the existing runtime diagnostics and `/api/health`

Tests added:

- [src/server/services/scheduler.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/scheduler.test.ts)
- Expanded [src/server/services/reviews.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/reviews.test.ts) for daily/monthly/yearly coverage

### 6. Wave 2: Reviews 2.0 and Goal Alignment

Implemented:

- Added `goalId` linkage to tasks and projects plus the new `milestones` table in [src/server/db/schema.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/db/schema.ts)
- Added the next migration and snapshot for goal links plus milestones:
  - [drizzle/migrations/0002_long_nomad.sql](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/0002_long_nomad.sql)
  - [drizzle/migrations/meta/0002_snapshot.json](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/meta/0002_snapshot.json)
- Built the goal rollup engine in [src/server/services/progress.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/progress.ts)
- Added milestone CRUD and computed milestone state in [src/server/services/milestones.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/milestones.ts)
- Expanded goal services in [src/server/services/goals.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/goals.ts)
- Hooked goal/project/habit/task progress recalculation into:
  - [src/server/services/tasks.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/tasks.ts)
  - [src/server/services/projects.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/projects.ts)
  - [src/server/services/habits.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/habits.ts)
- Added template helpers in [src/server/services/templates.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/templates.ts)
- Reworked [src/server/services/reviews.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/reviews.ts) so regenerate preserves authored user sections and supports extraction of follow-up tasks/goals
- Added milestone and review-extraction server actions in [src/app/actions.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/actions.ts)
- Goal detail page now exposes milestone management, rollup visibility, and direct contributor lists:
  - [src/app/(app)/goals/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/goals/[id]/page.tsx)
  - [src/app/(app)/goals/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/goals/[id]/client.tsx)
- Task, project, and habit detail pages now expose explicit goal/project linking:
  - [src/app/(app)/tasks/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/tasks/[id]/page.tsx)
  - [src/app/(app)/tasks/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/tasks/[id]/client.tsx)
  - [src/app/(app)/projects/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/projects/[id]/page.tsx)
  - [src/app/(app)/projects/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/projects/[id]/client.tsx)
  - [src/app/(app)/habits/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/habits/[id]/page.tsx)
  - [src/app/(app)/habits/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/habits/[id]/client.tsx)
- Review detail now exposes one-click extraction from insight cards and clearly communicates preserved sections:
  - [src/app/(app)/reviews/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/reviews/[id]/client.tsx)
- Shared select-field rendering was improved in [src/components/detail/editable-field.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/detail/editable-field.tsx)
- Runtime/export wiring was updated so milestones are included in readiness and exports:
  - [src/server/services/runtime.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.ts)
  - [src/server/services/export.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/export.ts)

Behavior now supported:

- Goals can roll progress up from:
  - milestones
  - directly linked tasks
  - directly linked projects
  - directly linked habits
- Milestones can be:
  - manual
  - task-backed
  - project-backed
  - habit-backed
- Goal rollups deduplicate direct contributors already represented by milestones
- Project progress now excludes review-generated reminder tasks from the rollup
- Review regeneration preserves user-authored `personal_notes`, `lessons`, and `commitments` sections
- Review insights can be extracted into tasks or goals and are linked back to the source review with `derived_from` relations
- Detail-page selectors now make goal/project alignment editable from the linked work itself

Tests added:

- [src/server/services/progress.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/progress.test.ts)
- Expanded [src/server/services/reviews.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/reviews.test.ts) for authored-section preservation and review insight extraction

### 7. Wave 3: Discoverability, Backlinks, and Graph Exploration

Implemented:

- Search now covers tasks, habits, journal, notes, ideas, projects, goals, entities, metrics, events, and reviews in [src/server/services/search.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.ts)
- Indexed search bodies now include:
  - tag context
  - relation context
  - milestone text for goals
- Search results now resolve real `detailUrl` and subtitle metadata instead of relying on hardcoded client routing in [src/app/(app)/search/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/search/client.tsx)
- Added an events service in [src/server/services/events.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/events.ts) with search sync and accurate date-range filtering
- Added dedicated event detail routes:
  - [src/app/(app)/events/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/events/[id]/page.tsx)
  - [src/app/(app)/events/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/events/[id]/client.tsx)
- Built a resolved connection service in [src/server/services/connections.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/connections.ts)
- Detail pages now show:
  - explicit backlinks and outgoing links
  - structural links derived from foreign-key relationships
  - suggestion cards merged from shared tags and mention-style search matches
- Connection surfaces are now wired into detail pages for:
  - tasks
  - habits
  - notes
  - journal
  - ideas
  - projects
  - goals
  - metrics
  - people
  - learning entities
  - reviews
  - events
- Structural graph coverage was expanded in [src/server/services/graph-helpers.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph-helpers.ts) to include:
  - task -> goal
  - project -> goal
- Graph nodes now carry `tagIds` and the graph page now loads tag edges in [src/server/services/graph.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph.ts) and [src/app/(app)/graph/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/graph/page.tsx)
- The graph client was substantially upgraded in [src/app/(app)/graph/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/graph/client.tsx) with:
  - saved local filters
  - edge-type toggles
  - tag filtering
  - focus mode
  - focus depth switching
  - empty states that reflect active filters
- Shared relation UI was upgraded in [src/components/detail/relations-panel.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/detail/relations-panel.tsx) so suggestions explain whether they came from shared tags, mention matches, or both
- Shared types for resolved connections and search results now live in [src/lib/types.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/types.ts)

Behavior now supported:

- Search can find reviews, events, metrics, and entities alongside the earlier core item types
- Search results navigate directly to the correct detail page, including:
  - `/events/[id]`
  - `/reviews/[id]`
  - `/people/[id]`
  - `/learning/[id]`
- Creating or removing tags and relations incrementally refreshes search context for affected items
- Goal search results include milestone text
- Detail pages expose backlinks and structural context instead of only raw relation rows
- Connection suggestions can surface items that:
  - share tags
  - appear to mention the current item in indexed text
  - satisfy both of the above
- Suggestion cards can create direct `related_to` links from the detail page
- Graph exploration now supports local filter persistence, tag slicing, edge-type filtering, and neighborhood focus mode
- Event items now have a first-class detail destination rather than only living inside the timeline

Tests added:

- New [src/server/services/connections.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/connections.test.ts)
- New [src/server/services/graph.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph.test.ts)
- Expanded [src/server/services/search.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.test.ts) to cover:
  - relation context
  - tag context
  - goal milestone search context
  - event indexing
  - generated review indexing

### 8. Wave 3: Importers and Local Attachments

Implemented:

- Added attachment and import persistence to [src/server/db/schema.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/db/schema.ts):
  - `attachments`
  - `attachment_links`
  - `import_runs`
  - `imported_records`
- Generated the new migration and snapshot:
  - [drizzle/migrations/0003_minor_magdalene.sql](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/0003_minor_magdalene.sql)
  - [drizzle/migrations/meta/0003_snapshot.json](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/meta/0003_snapshot.json)
- Added local attachment storage/copy/dedupe logic in [src/server/services/attachments.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachments.ts)
- Added streaming/download support for stored files in [src/app/api/attachments/[id]/route.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/api/attachments/[id]/route.ts)
- Added shared attachment UI in [src/components/detail/attachments-panel.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/detail/attachments-panel.tsx)
- Notes, journal entries, ideas, and projects now expose first-class attachment panels:
  - [src/app/(app)/notes/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/notes/[id]/page.tsx)
  - [src/app/(app)/notes/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/notes/[id]/client.tsx)
  - [src/app/(app)/journal/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/journal/[id]/page.tsx)
  - [src/app/(app)/journal/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/journal/[id]/client.tsx)
  - [src/app/(app)/ideas/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/ideas/[id]/page.tsx)
  - [src/app/(app)/ideas/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/ideas/[id]/client.tsx)
  - [src/app/(app)/projects/[id]/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/projects/[id]/page.tsx)
  - [src/app/(app)/projects/[id]/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/projects/[id]/client.tsx)
- Added import preview/commit services with run logging and dedupe in [src/server/services/imports.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.ts)
- Added import actions in [src/app/actions.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/actions.ts)
- Added a new `/imports` surface:
  - [src/app/(app)/imports/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/imports/page.tsx)
  - [src/app/(app)/imports/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/imports/client.tsx)
- Added navigation entry for imports in [src/components/layout/sidebar.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/layout/sidebar.tsx)
- Export/runtime/settings surfaces now account for attachments/import runs:
  - [src/server/services/export.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/export.ts)
  - [src/server/services/runtime.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.ts)
  - [src/app/(app)/settings/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/settings/page.tsx)

Behavior now supported:

- Browser-side manual attachment uploads for notes, journal entries, ideas, and projects
- Files are copied into `ATTACHMENTS_PATH`, deduped by content hash, and streamed back through `/api/attachments/[id]`
- Re-linking the same file across multiple items reuses stored file content instead of duplicating bytes
- Import runs are logged with preview/import mode, status, warnings, summary text, and aggregate stats
- Repeated imports dedupe against prior imported source records through `imported_records`
- Supported import paths now include:
  - Todoist CSV exports
  - Obsidian vault folders
  - Notion Markdown/CSV exports (folders or zips)
  - Day One JSON exports (folders or zips)
- Obsidian imports currently preserve:
  - markdown notes
  - frontmatter and inline tags
  - wiki-link note relations
  - embedded local files as attachments
- Notion imports currently preserve:
  - markdown pages as notes
  - CSV rows as notes or task-like items via heuristics
- Day One imports currently preserve:
  - journal entry text
  - entry dates/times
  - tags
  - resolvable media references as attachments
- Todoist imports currently preserve:
  - task titles and descriptions
  - sections as task context
  - priorities
  - due dates when they can be normalized
  - parent/child nesting from indent level
  - project grouping from the source file name

Tests added:

- New [src/server/services/attachments.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachments.test.ts)
- New [src/server/services/imports.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.test.ts)
- Import coverage now exercises:
  - Obsidian vault import with wiki links, attachments, and rerun dedupe
  - Todoist CSV import with sections, priorities, tags, and parent nesting
  - Day One JSON import with tags and media
  - Notion export import with markdown pages and task-like CSV rows

### 9. Wave 3: Attachment-Aware Discovery and Capture-First PWA

Implemented:

- Extended the attachment schema in [src/server/db/schema.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/db/schema.ts) with:
  - `search_text`
  - `search_summary`
  - `search_status`
  - `extracted_at`
- Generated the next migration and snapshot:
  - [drizzle/migrations/0004_brave_prowler.sql](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/0004_brave_prowler.sql)
  - [drizzle/migrations/meta/0004_snapshot.json](/Users/eklavya.goyal/Projects/lifeOS/drizzle/migrations/meta/0004_snapshot.json)
- Added attachment extraction in:
  - [src/server/services/attachment-content.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachment-content.ts)
  - [src/server/services/attachments.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachments.ts)
- Added shared attachment query helpers in [src/server/services/attachment-queries.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachment-queries.ts)
- Search indexing now includes attachment names and extracted text in [src/server/services/search.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.ts)
- Connection inference now treats shared files as inferred links in [src/server/services/connections.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/connections.ts)
- Graph exploration now includes attachment edges and node attachment counts in:
  - [src/server/services/graph.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph.ts)
  - [src/app/(app)/graph/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/graph/client.tsx)
- Search results now surface attachment counts/names in [src/app/(app)/search/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/search/client.tsx)
- Attachment panels now surface indexing status, extracted summaries, and shared-file counts in [src/components/detail/attachments-panel.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/detail/attachments-panel.tsx)
- Shared capture parsing was split into [src/lib/capture-preview.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/capture-preview.ts) so client and server can preserve the same parse contract
- Added offline queue helpers in [src/lib/offline-capture.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/offline-capture.ts)
- Refactored capture submission/reward logic into [src/server/services/capture.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture.ts) and [src/server/services/capture-paths.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture-paths.ts)
- Added a queued capture API in [src/app/api/capture/route.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/api/capture/route.ts)
- Added a Web Share Target endpoint in [src/app/api/share-target/route.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/api/share-target/route.ts)
- Reworked [src/components/capture/quick-capture.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/capture/quick-capture.tsx) for:
  - local preview fallback
  - offline queueing
  - automatic queued sync on reconnect
  - visible queue/offline status
- Added PWA shell files:
  - [src/app/manifest.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/manifest.ts)
  - [src/app/offline/page.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/offline/page.tsx)
  - [src/components/pwa/pwa-provider.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/components/pwa/pwa-provider.tsx)
  - [public/sw.js](/Users/eklavya.goyal/Projects/lifeOS/public/sw.js)
  - [public/icon.svg](/Users/eklavya.goyal/Projects/lifeOS/public/icon.svg)
  - [public/icon-maskable.svg](/Users/eklavya.goyal/Projects/lifeOS/public/icon-maskable.svg)
- Root metadata/middleware were updated for manifest, icon, offline, and service-worker routes in:
  - [src/app/layout.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/layout.tsx)
  - [src/middleware.ts](/Users/eklavya.goyal/Projects/lifeOS/src/middleware.ts)

Behavior now supported:

- Text-like attachments and PDFs can be indexed into search when the host can extract text
- Uploaded or imported files now reindex their linked items automatically
- Search queries can match attachment filenames and extracted text while still landing on the parent item detail page
- Shared attachment reuse is now visible as:
  - inferred links on detail pages
  - graph edges
  - attachment panel shared-count badges
- Graph nodes now expose attachment counts and attachment edges can be filtered independently
- The quick capture bar can keep working offline in a capture-first mode:
  - local preview still parses tags, priority, due dates, and entity/metric intent
  - captures queue locally when offline
  - queued captures sync automatically after reconnect
- Offline queue snapshots preserve the original parse intent for relative dates like `tomorrow`
- Installed/browser PWA flows now include:
  - manifest and icons
  - service-worker registration
  - offline fallback page
  - Web Share Target support
- Text/link shares with title or files currently materialize as reference notes; text-only shares fall back to inbox capture

Tests added or expanded:

- Expanded [src/server/services/attachments.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachments.test.ts) for extraction, shared counts, and attachment-backed search
- Expanded [src/server/services/search.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.test.ts) for attachment-text search coverage
- Expanded [src/server/services/connections.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/connections.test.ts) for shared-attachment inferred links
- Expanded [src/server/services/graph.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph.test.ts) for attachment edges and node counts
- Expanded [src/server/services/capture.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture.test.ts) for preserved offline relative-date parsing plus later project resolution

### 8. Wave 3: Import Trust, Diffing, and Rollback

Implemented:

- Expanded import preview contracts in [src/server/services/imports.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.ts) to include:
  - mapping groups
  - dry-run diff summaries
  - richer sample items with mapped fields, duplicate targets, relation counts, attachment names, and projected auto-created projects
- Import runs now persist structured detail metadata in `import_runs.details`, including preview summaries, tracked created artifacts, and rollback state, all via [src/server/services/imports.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.ts)
- Added import rollback support in:
  - [src/server/services/imports.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.ts)
  - [src/app/actions.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/actions.ts)
- Rollback now:
  - archives imported tasks, notes, and journal entries instead of hard deleting them
  - removes relations touching rolled-back imported items
  - removes attachment links for rolled-back imported items
  - archives orphaned attachments when nothing still references them
  - archives auto-created import projects only when they are still effectively empty and untouched by additional linked data
  - deletes the corresponding `imported_records` rows so reruns are clean
- Added orphan-attachment cleanup support in [src/server/services/attachments.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachments.ts)
- Reworked the imports UI in [src/app/(app)/imports/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/imports/client.tsx) so it now shows:
  - diff cards for new items, duplicate matches, files, and relations
  - mapping cards explaining inferred field translations
  - richer sample item cards
  - run-history rollback controls and rollback summaries

Behavior now supported:

- Previewing an import now shows what the importer believes it will do before write, not just raw counts
- Import runs now expose rollback availability and artifact cleanup state in the run history
- Rolling back an import clears dedupe state for that run, so rerunning the same source can create fresh records again
- Older runs without full tracked artifact metadata still roll back imported items safely and clean up item-linked relations/attachments conservatively

Tests added or expanded:

- Expanded [src/server/services/imports.test.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.test.ts) to cover:
  - preview mapping/diff summaries
  - rollback of imported notes/tasks
  - relation and attachment cleanup
  - auto-created project archival
  - rerun correctness after rollback

## Important Files To Know First

If starting fresh in a new chat, read these first:

- [context.md](/Users/eklavya.goyal/Projects/lifeOS/context.md)
- [package.json](/Users/eklavya.goyal/Projects/lifeOS/package.json)
- [src/app/actions.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/actions.ts)
- [src/lib/capture-preview.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/capture-preview.ts)
- [src/lib/offline-capture.ts](/Users/eklavya.goyal/Projects/lifeOS/src/lib/offline-capture.ts)
- [src/server/services/capture.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture.ts)
- [src/server/services/capture-paths.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/capture-paths.ts)
- [src/server/services/scheduler.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/scheduler.ts)
- [src/server/services/reviews.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/reviews.ts)
- [src/server/services/progress.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/progress.ts)
- [src/server/services/milestones.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/milestones.ts)
- [src/server/services/runtime.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/runtime.ts)
- [src/server/services/search.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/search.ts)
- [src/server/services/connections.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/connections.ts)
- [src/server/services/attachment-content.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachment-content.ts)
- [src/server/services/attachment-queries.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachment-queries.ts)
- [src/server/services/attachments.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/attachments.ts)
- [src/server/services/imports.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/imports.ts)
- [src/server/services/events.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/events.ts)
- [src/server/services/graph.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/services/graph.ts)
- [src/app/(app)/graph/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/graph/client.tsx)
- [src/app/(app)/imports/client.tsx](/Users/eklavya.goyal/Projects/lifeOS/src/app/(app)/imports/client.tsx)
- [src/app/api/capture/route.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/api/capture/route.ts)
- [src/app/api/share-target/route.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/api/share-target/route.ts)
- [src/app/manifest.ts](/Users/eklavya.goyal/Projects/lifeOS/src/app/manifest.ts)
- [public/sw.js](/Users/eklavya.goyal/Projects/lifeOS/public/sw.js)
- [src/server/db/schema.ts](/Users/eklavya.goyal/Projects/lifeOS/src/server/db/schema.ts)

## Recommended Next Phase

The cleanest next implementation step is now Wave 3 polish and depth work around the two remaining edges: richer attachment/media extraction and a more intentional installed/offline PWA experience.

Recommended focus for the next pass:

1. Expand attachment extraction beyond text-like files and host-level PDFs into richer media-aware indexing and better failure visibility
2. Deepen the PWA layer with install prompts, broader offline read surfaces, and more intentional share-target UX for different payload types
3. Add optional advanced import polish such as user-editable field remapping presets or importer-specific override controls, now that the core mapping/diff/rollback loop exists

### Why This Next

The codebase now stores, links, imports, indexes, and queues much more of a person’s real context:

- review-derived follow-up items
- direct goal/project/task/habit links
- milestone-backed goal rollups
- richer scheduler-created review artifacts
- resolved backlinks and connection suggestions
- graph focus/filter tooling
- event detail destinations that search and graph can target
- imported external history
- locally stored attachments with reusable links
- attachment-backed search and shared-file graph links
- offline queued captures with preserved parse snapshots

The next highest-leverage step is polishing the workflows that now exist end to end: make attachment extraction richer when files are harder than plain text/PDF, and turn the new capture-first PWA shell into a more deliberate mobile/installed experience.

After that:

- attachment OCR/transcription and richer media pipelines
- broader offline detail-page support beyond quick capture

## Still Open From The 10-Point Plan

Not yet implemented:

- Full offline browsing/editing beyond the current capture-first queue and offline page
- Richer media extraction such as OCR/transcription beyond text-like files and host-level PDF text extraction
- More polished install/share flows tailored to distinct share payload types
- Optional advanced importer overrides such as editable field remapping or reusable importer-specific presets

## Repo State Notes

Useful context for the next chat:

- The worktree may contain unrelated untracked directories like `output/` and `tmp/`
- There is an untracked helper script at [scripts/generate_app_summary_pdf.py](/Users/eklavya.goyal/Projects/lifeOS/scripts/generate_app_summary_pdf.py)
- Scheduler persistence depends on Drizzle migration `0001_watery_gunslinger`
- Goal links and milestones depend on Drizzle migration `0002_long_nomad`
- Attachments and import runs depend on Drizzle migration `0003_minor_magdalene`
- Attachment search metadata depends on Drizzle migration `0004_brave_prowler`
- `pnpm db:migrate` should be run in new environments before expecting scheduler/runtime checks or milestone features to go green
- This pass was verified with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
- No new migration was added in this pass; importer rollback metadata is stored in existing `import_runs.details`
- If authenticated routes report that the database schema is out of date, the intended fix is to run `pnpm db:migrate` against the configured `DATABASE_PATH`
- `adm-zip` and `@types/adm-zip` were added for zipped export support
- Do not revert unrelated changes without checking first
- Prefer `rg` for discovery
- Use `apply_patch` for file edits

## Handoff Reminder

Before ending any future implementation pass, update this file with:

- what changed
- what was verified
- any migrations, caveats, or lockfile/native build notes
- the recommended next step
