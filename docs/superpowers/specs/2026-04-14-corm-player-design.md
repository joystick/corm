# CORM Player — Stage 2 Design Spec

## Overview

A Lit-based web component (`<corm-player>`) that replaces the SCORM iframe player in seaducate.com and onboard Pi terminals. Renders CORM markdown content, runs IMS Simple Sequencing natively, persists full CMI state to RxDB, and syncs via MQTT within 128KB packet limits.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Host App (iframe or import)         │
│  seaducate.com (React) │ Pi terminal (Deno)     │
└──────────────────┬──────────────────────────────┘
                   │ <corm-player> web component
┌──────────────────▼──────────────────────────────┐
│  @corm/player (Lit web component)               │
│                                                  │
│  ┌────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Renderer   │ │ Sequencing  │ │ Assessment │ │
│  │ (markdown  │ │ Engine      │ │ Engine     │ │
│  │  slides)   │ │ (interpreter│ │ (10 types) │ │
│  └─────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
│        └───────┬───────┘──────────────┘         │
│         ┌──────▼──────┐                          │
│         │ CMI Runtime │ ← SCORM 1.2 + 2004 API  │
│         └──────┬──────┘                          │
│         ┌──────▼──────┐                          │
│         │   RxDB      │ ← offline-first store    │
│         └──────┬──────┘                          │
│         ┌──────▼──────┐                          │
│         │ Sync Layer  │ → MQTT ≤128KB packets    │
│         └─────────────┘                          │
└──────────────────────────────────────────────────┘
```

### Package

`packages/player/` in the CORM monorepo. Standalone library, framework-agnostic web component. Will be published as a separate npm/JSR package.

### Web Component API

```html
<corm-player
  course-id="h2s-safety"
  learner-id="seafarer-42"
  manifest-url="/api/courses/h2s-safety/manifest.json"
></corm-player>
```

### Internal Modules

| Module | Responsibility |
|--------|---------------|
| **Renderer** | Parses markdown, renders slides/content via Lit templates |
| **Sequencing Engine** | Evaluates IMS Simple Sequencing rules against CMI state per navigation event |
| **Assessment Engine** | Renders all 10 SCORM interaction types, captures responses, scores |
| **CMI Runtime** | Full `cmi.*` state model, exposes SCORM 1.2 and 2004 API shims |
| **RxDB Store** | Collections: enrollments, attempts, cmi_state, interactions, sync_queue |
| **Sync Layer** | Reads RxDB change stream, chunks into ≤128KB MQTT packets |

## CMI Runtime & SCORM Compatibility

### Full CMI Data Model

```
cmi.core.student_id          ← from learner-id attribute
cmi.core.student_name        ← from RxDB enrollment
cmi.core.lesson_location     ← bookmark / resume point
cmi.core.lesson_status       ← not attempted|incomplete|completed|passed|failed
cmi.core.score.raw/min/max   ← assessment scores
cmi.core.exit                ← suspend|logout|normal
cmi.suspend_data             ← opaque string, persisted for resume
cmi.interactions.n.*         ← full interaction logging (10 types)
cmi.objectives.n.*           ← objective status + scores
cmi.core.total_time          ← accumulated session time
cmi.core.session_time        ← current session duration
```

### Dual API Shim

- **SCORM 1.2:** `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, `LMSFinish` via `window.API`
- **SCORM 2004:** `Initialize`, `GetValue`, `SetValue`, `Commit`, `Terminate` via `window.API_1484_11`

Both APIs write to the same CMI state in RxDB. This enables:

- Existing Articulate/vendor SCOs run inside the CORM player unchanged (iframe with `window.API` shim)
- Native CORM content uses the CMI Runtime directly (no shim needed)
- Every `SetValue` call persists to RxDB immediately for full resume capability

### STCW Audit Trail

- Every `cmi.interactions.n` write is hash-chained: `hash(previous_hash + interaction_data + timestamp)`
- Stored in the `interactions` RxDB collection
- Tamper-evident: breaking any link invalidates the chain
- Synced to server when MQTT is available

## Sequencing Engine

Interpreter that evaluates IMS Simple Sequencing at each navigation event (next, previous, choice, exit).

### Sequencing Loop

```
Navigation Event (learner clicks next/prev/choice)
  → Navigation Request Processing
    → check controlMode (choice allowed? flow enabled? forwardOnly?)
  → Sequencing Request Processing
    → evaluate preConditionRules (skip? disabled? hiddenFromChoice?)
    → identify target activity
  → Delivery Request Processing
    → evaluate postConditionRules (exitAll? retry? continue?)
    → rollup (propagate status up the activity tree)
    → deliver activity or reject with reason
```

### Inputs

| Input | Source |
|-------|--------|
| Activity tree | CORM manifest `organizations[].items[]` (recursive) |
| Sequencing rules | `item.sequencing` (controlMode, pre/post conditions, rollup) |
| Current state | CMI Runtime (objectives satisfied, attempts, scores) |
| Navigation request | User interaction (next/prev/choice/exit) |

### Output

Either a delivery (render this activity) or a rejection (show "not available" with reason).

### SCORM 1.2 Fallback

SCORM 1.2 has no sequencing — the engine defaults to linear navigation (next/previous through flat item list). No rules evaluated.

### Deferred for Later

- Randomization/selection (rare in maritime training)
- Auxiliary resources (supplemental content)

## RxDB Collections & Sync

### Collections

| Collection | Key | Purpose |
|------------|-----|---------|
| `enrollments` | `learnerId + courseId` | Learner↔course binding, overall status, enrolled/completed dates |
| `attempts` | `enrollmentId + attemptNumber` | Per-attempt: start time, duration, score, status, exit type |
| `cmi_state` | `attemptId` | Full CMI snapshot: suspend_data, location, objectives, total_time |
| `interactions` | `attemptId + interactionIndex` | Individual responses: type, learner_response, result, latency, hash_chain |
| `sync_queue` | `auto-generated` | Outbound changes: collection, docId, operation, payload, timestamp |

RxDB is also used as the data layer for the broader seaducate.com React Router v6 app, not just scoped to the player.

### Sync Layer Protocol

```
RxDB write → change stream fires
  → Sync Layer captures change
  → Adds to sync_queue collection
  → If MQTT connected:
      → Batch changes from sync_queue
      → Serialize to JSON
      → If > 128KB: chunk into multiple messages
      → Publish to topic: corm/{courseId}/{learnerId}/sync
      → On server ACK: remove from sync_queue
  → If offline:
      → Changes accumulate in sync_queue
      → Retry on reconnect
```

### Conflict Resolution

Last-write-wins keyed on `learnerId + courseId + field`. Tracking data is per-learner so conflicts are rare — they only happen if the same learner uses two devices simultaneously, in which case latest timestamp wins.

### Content Sync

Course material (not tracking data) uses the existing `@corm/content-store` checksum diffing — server pushes manifest + content deltas down to the Pi over MQTT.

## Renderer & UI

### Markdown Rendering

- Parse CORM markdown slides using a lightweight parser (marked or markdown-it, ~15KB)
- Render into Lit templates inside shadow DOM
- Supports: headings, paragraphs, lists, images, tables, code blocks, bold/italic
- Embedded assessment blocks rendered by the Assessment Engine

### Component Tree

```
<corm-player>
  ├── <corm-nav>           ← top bar: title, progress indicator
  ├── <corm-content>       ← main content area (slide/assessment)
  ├── <corm-controls>      ← bottom: prev/next, activity menu
  └── <corm-status>        ← connection indicator, sync status
```

### Navigation UI

- Linear next/prev buttons (always)
- Activity menu (side panel, when `controlMode.choice === true`)
- Disabled items shown greyed with lock icon (precondition: disabled)
- Progress bar based on rollup completion percentage

### Style System

- Inherits Tailwind CSS + shadcn/ui design tokens from seaducate.com when embedded
- Defaults to shadcn styling when no host theme is detected
- CSS custom properties bridge: reads `--primary`, `--background`, `--radius`, `--destructive`, etc.
- Seaducate.com theme: navy (#112236) + brand gold (#FFB029) + ocean cyan (#06B6D4), HSL format, New York style
- Glass-morphism card patterns reused for player chrome
- Shadow DOM isolates player styles from host app

### Responsiveness

- Desktop + tablet for Stage 2 (training terminals and seaducate.com)
- No mobile-first now — future CrewFile project handles personal devices via React Native Expo + MQTT/RxDB/Zustand with stricter data access protocols

## Proctoring

Stage 2 ships `none` + `honor` tiers only:

- **none:** No proctoring, standard course playback
- **honor:** Honor-code acknowledgment before assessment, basic time tracking

### Future Tiers (incremental)

- **record_review:** Webcam/screen recording, stored locally, synced when available
- **remote_automated:** AI-based anomaly detection
- **remote_live:** Live proctor video call

The STCW audit trail (hash-chained interactions) ships in Stage 2 regardless of proctoring tier — it's the compliance foundation all tiers build on.

## Testing

### Unit Tests (Deno test)

- Sequencing engine: evaluate control modes, pre/post conditions, rollup rules against mock CMI state
- CMI Runtime: get/set/commit cycle, session time accumulation, interaction hash-chaining
- Sync Layer: change batching, 128KB chunking logic, queue management

### Integration Tests (RxDB in-memory)

- CMI writes → RxDB persistence → resume reads (full cycle)
- Interaction logging → hash chain verification
- Sync queue accumulation during offline → drain on reconnect
- SCORM API shim → CMI Runtime → RxDB (end-to-end data flow)

### Storybook (following seaducate.com pattern)

- Same stack: Storybook + Vite + Chromatic + A11y addon
- Stories for each Lit component: `<corm-nav>`, `<corm-content>`, `<corm-controls>`, `<corm-status>`
- Background presets matching seaducate.com theme (navy, navy-dark, white)
- Player states: loading, playing, paused, completed, offline, syncing
- Assessment type stories: all 10 interaction types rendered
- Sequencing states: linear nav, choice menu, disabled items, locked items

### Theme QA

- Storybook previews with both seaducate.com theme and bare shadcn defaults
- Visual comparison against seaducate.com's existing Storybook

### Deferred

- Playwright E2E browser tests (wait for UI to stabilize)
- Chromatic visual regression (add once component library settles)
