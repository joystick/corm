# Plan: CORM Player (Stage 2)

> Source PRD: `docs/superpowers/specs/2026-04-14-corm-player-design.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Package**: `packages/player/` in the CORM monorepo, published as standalone npm/JSR package
- **UI framework**: Lit web components, shadow DOM isolation
- **Web component API**: `<corm-player course-id="" learner-id="" manifest-url="">`
- **Component tree**: `<corm-player>` → `<corm-nav>`, `<corm-content>`, `<corm-controls>`, `<corm-status>`
- **Data layer**: RxDB with in-memory adapter for tests, IndexedDB for production
- **RxDB collections**: `enrollments`, `attempts`, `cmi_state`, `interactions`, `sync_queue`
- **CMI model**: Full SCORM 1.2 + 2004 CMI data model, every SetValue persists to RxDB immediately
- **Sequencing**: Interpreter pattern, evaluates IMS Simple Sequencing rules at each navigation event
- **Sync transport**: MQTT with ≤128KB packet chunking, last-write-wins conflict resolution
- **Sync topic**: `corm/{courseId}/{learnerId}/sync`
- **Style system**: CSS custom properties bridge inheriting shadcn/seaducate.com tokens, falls back to shadcn defaults
- **Audit trail**: Hash-chained interactions (`hash(prev_hash + data + timestamp)`), tamper-evident
- **Markdown parser**: marked or markdown-it (~15KB)
- **Testing**: Deno test (unit) + RxDB in-memory (integration) + Storybook (visual)
- **Proctoring**: `none` + `honor` for Stage 2, additional tiers incremental

---

## Phase 1: "Hello Course" — Web Component + CMI + RxDB

**User stories**: Package scaffold, Lit setup, CMI data model, RxDB collections, basic markdown rendering, resume capability

### What to build

A minimal `<corm-player>` Lit web component that loads a CORM manifest from a URL, renders a single markdown slide as HTML content, and persists basic CMI state to RxDB. On reload, the player resumes from where the learner left off by reading `cmi.core.lesson_location` from the `cmi_state` collection.

This is the thinnest possible vertical slice proving: web component → manifest loading → markdown rendering → CMI state → RxDB persistence → resume.

The RxDB schema for all 5 collections is defined in this phase even though only `enrollments`, `attempts`, and `cmi_state` are actively used. This avoids schema migrations later.

### Acceptance criteria

- [ ] `<corm-player>` Lit web component renders in a browser with `course-id`, `learner-id`, `manifest-url` attributes
- [ ] Fetches and parses a CORM manifest JSON from `manifest-url`
- [ ] Renders markdown content from the first activity as HTML inside shadow DOM
- [ ] CMI Runtime supports `lesson_status`, `lesson_location`, `score.raw`, `suspend_data`, `session_time`, `total_time`
- [ ] Every CMI state change persists to RxDB `cmi_state` collection
- [ ] On page reload, player resumes from persisted `lesson_location`
- [ ] RxDB schemas defined for all 5 collections (enrollments, attempts, cmi_state, interactions, sync_queue)
- [ ] Unit tests for CMI get/set/commit cycle
- [ ] Integration tests for RxDB persistence round-trip (in-memory adapter)
- [ ] `<corm-nav>` shows course title, `<corm-content>` renders slide, `<corm-controls>` shows placeholder next/prev

---

## Phase 2: Multi-Activity Navigation — Sequencing Engine

**User stories**: Sequencing loop, navigation request processing, rollup, activity tree, SCORM 1.2 linear fallback

### What to build

The sequencing interpreter that enables navigation between multiple activities in a course. When the learner clicks next/prev or selects an activity from the choice menu, the engine evaluates controlMode flags, preConditionRules, and postConditionRules against current CMI state to determine whether the target activity can be delivered.

The activity tree is built from the manifest's `organizations[].items[]` recursive structure. Rollup propagates completion/satisfaction status up the tree after each activity delivery. SCORM 1.2 courses (no sequencing data) fall back to simple linear next/prev navigation.

The `<corm-controls>` component gets real next/prev buttons, and `<corm-nav>` shows a progress bar based on rollup completion percentage. When `controlMode.choice === true`, an activity menu side panel lets learners jump to any available item. Disabled items show as greyed with a lock icon.

### Acceptance criteria

- [ ] Activity tree built from manifest organizations/items on course load
- [ ] Next/prev navigation works for linear courses (SCORM 1.2 fallback)
- [ ] controlMode flags evaluated: choice, flow, forwardOnly, choiceExit
- [ ] preConditionRules evaluated: skip, disabled, hiddenFromChoice
- [ ] postConditionRules evaluated: exitAll, retry, continue
- [ ] Rollup propagates completion status up the activity tree
- [ ] Activity menu side panel shows when choice is enabled
- [ ] Disabled activities shown greyed with lock icon and reason
- [ ] Progress bar reflects rollup completion percentage
- [ ] Unit tests for sequencing interpreter (control modes, preconditions, rollup)
- [ ] Integration test: multi-item course with sequencing navigates correctly

---

## Phase 3: Assessments — 10 Interaction Types + STCW Audit Trail

**User stories**: Assessment engine, all 10 SCORM interaction types, interaction hash-chaining, scoring, proctoring `none` + `honor`

### What to build

The assessment engine renders quiz/test content within `<corm-content>`. Each of the 10 SCORM interaction types gets a Lit component that captures learner responses and scores them against correct responses defined in the manifest.

Every interaction write is hash-chained for STCW compliance: `hash(previous_hash + interaction_data + timestamp)`. The chain is stored in the RxDB `interactions` collection. Breaking any link invalidates the chain, making the audit trail tamper-evident.

Proctoring tiers `none` and `honor` are implemented. `honor` shows an acknowledgment dialog before the assessment begins and enables basic time tracking (time per question, total assessment duration).

### Acceptance criteria

- [ ] All 10 interaction types render and capture responses: true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other
- [ ] Learner responses scored against correct responses from manifest
- [ ] `cmi.interactions.n.*` written for each response (id, type, learner_response, result, latency, timestamp)
- [ ] Hash-chaining: each interaction includes `hash(prev_hash + data + timestamp)`
- [ ] Hash chain stored in `interactions` RxDB collection
- [ ] Hash chain integrity verifiable (break one link → chain invalid)
- [ ] Proctoring `none`: standard playback, no acknowledgment
- [ ] Proctoring `honor`: acknowledgment dialog before assessment, time-per-question tracked
- [ ] `cmi.core.score.raw/min/max` updated from assessment results
- [ ] `cmi.core.lesson_status` transitions to passed/failed based on score vs mastery threshold
- [ ] Unit tests for scoring logic per interaction type
- [ ] Integration tests for hash chain persistence and verification

---

## Phase 4: SCORM API Shim — Backward Compatibility

**User stories**: Dual API shim, vendor SCO compatibility, drop-in SCORM replacement

### What to build

Expose `window.API` (SCORM 1.2) and `window.API_1484_11` (SCORM 2004) on the player's iframe context so existing vendor-built SCOs (Articulate Storyline, Rise, etc.) can run inside `<corm-player>` unchanged.

Both shims delegate to the same CMI Runtime, which persists to RxDB. The player detects whether content is native CORM (markdown) or a vendor SCO (HTML with SCORM API calls) and switches rendering mode accordingly — markdown goes through the renderer, SCO HTML loads in an iframe with the API shim injected.

Test with the real H2S Safety course from seaducate.com to validate that an Articulate Storyline SCO initializes, tracks progress, and completes through the CORM player.

### Acceptance criteria

- [ ] `window.API` exposes: `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, `LMSFinish`, `LMSGetLastError`, `LMSGetErrorString`, `LMSGetDiagnostic`
- [ ] `window.API_1484_11` exposes: `Initialize`, `GetValue`, `SetValue`, `Commit`, `Terminate`, `GetLastError`, `GetErrorString`, `GetDiagnostic`
- [ ] Both APIs read/write the same CMI state in RxDB
- [ ] Player detects SCO vs native CORM content and switches rendering mode
- [ ] SCO content loads in iframe with API shim injected
- [ ] H2S Safety Articulate course initializes, tracks progress, and completes through the CORM player
- [ ] `suspend_data` persisted and restored on re-entry (resume works for vendor SCOs)
- [ ] Error codes returned per SCORM spec (0 = no error, 101 = general exception, etc.)
- [ ] Unit tests for API shim get/set/error handling
- [ ] Integration test with real H2S course zip

---

## Phase 5: Sync Layer — MQTT + Offline

**User stories**: Sync protocol, packet chunking, conflict resolution, content delta sync, offline-first

### What to build

The sync layer connects RxDB's change stream to MQTT for bidirectional data flow. When the learner is online, tracking data flows to the server in real-time. When offline (Pi at sea), changes accumulate in the `sync_queue` collection and drain when connectivity returns.

Outbound messages are chunked to fit within the 128KB MQTT packet limit. Each chunk includes a sequence number and total count so the server can reassemble. Server ACKs remove items from the sync queue.

Content sync (course material updates) uses the existing `@corm/content-store` checksum diffing — the server publishes manifest + content deltas to `corm/{courseId}/content` and the player applies them to its local store.

Conflict resolution is last-write-wins keyed on `learnerId + courseId + field`.

### Acceptance criteria

- [ ] RxDB change stream captured and written to `sync_queue` collection
- [ ] MQTT client connects to broker and publishes to `corm/{courseId}/{learnerId}/sync`
- [ ] Messages exceeding 128KB chunked with sequence numbers
- [ ] Server ACK removes completed items from sync_queue
- [ ] Offline: changes accumulate in sync_queue without errors
- [ ] Reconnect: queued changes drain automatically
- [ ] Content sync: player subscribes to `corm/{courseId}/content` for manifest/content deltas
- [ ] Checksum diffing applied to detect and apply only changed content
- [ ] Conflict resolution: last-write-wins by timestamp
- [ ] Unit tests for chunking logic (boundary: exactly 128KB, over 128KB, multiple chunks)
- [ ] Integration tests for sync queue accumulation and drain (mock MQTT broker)

---

## Phase 6: Storybook + Theme Integration

**User stories**: Style system, component documentation, shadcn theme bridge, accessibility, visual QA

### What to build

Storybook setup following seaducate.com's pattern (Vite + Chromatic + A11y addon). Stories for every Lit component in all meaningful states. The CSS custom properties bridge reads shadcn tokens from the host and applies them inside shadow DOM — if no host theme is detected, shadcn defaults apply.

Storybook backgrounds include seaducate.com's navy/gold theme and bare shadcn for side-by-side visual QA. Glass-morphism card patterns from seaducate.com are adapted for the player chrome.

### Acceptance criteria

- [ ] Storybook configured with Vite, Chromatic, A11y addons
- [ ] Stories for `<corm-player>`, `<corm-nav>`, `<corm-content>`, `<corm-controls>`, `<corm-status>`
- [ ] Player state stories: loading, playing, paused, completed, offline, syncing
- [ ] Assessment stories: all 10 interaction types rendered
- [ ] Sequencing state stories: linear nav, choice menu, disabled items, locked items
- [ ] Background presets: navy (seaducate.com), navy-dark, white, bare shadcn
- [ ] CSS custom properties bridge: `--primary`, `--background`, `--radius`, `--destructive`, `--ring` inherited from host
- [ ] Falls back to shadcn defaults when no host theme detected
- [ ] Glass-morphism card patterns applied to player chrome
- [ ] A11y addon reports zero critical violations
- [ ] Visual comparison between seaducate.com theme and bare shadcn defaults documented
