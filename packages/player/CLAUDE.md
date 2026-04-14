# @corm/player

Lit web component SCORM/CORM course player with offline-first RxDB persistence and MQTT sync.

## Quick Start

```tsx
// React integration (seaducate.com)
import "@corm/player";

<corm-player
  course-id="h2s-safety"
  learner-id="seafarer-42"
  manifest-url="/api/courses/h2s-safety/manifest.json"
/>
```

## Package Structure

```
src/
  components/     # Lit web components (shadow DOM)
    corm-player   # Main entry — orchestrates everything
    corm-nav      # Title bar + progress
    corm-content  # Markdown or SCO iframe rendering
    corm-controls # Prev/next + choice menu
    corm-status   # Online/offline indicator
    corm-sco-frame # Sandboxed iframe for vendor SCOs
  cmi/            # SCORM CMI runtime (get/set/commit)
  sequencing/     # IMS Simple Sequencing interpreter
  assessment/     # 10 interaction types + scoring
  audit/          # STCW hash-chained audit trail + proctoring
  shim/           # SCORM 1.2 + 2004 API shim (window.API)
  store/          # RxDB collections (5: enrollments, attempts, cmi_state, interactions, sync_queue)
  sync/           # MQTT client, 128KB chunker, change stream watcher, coordinator
  content/        # Content type detection (markdown vs SCO)
  styles/         # Theme system (CSS custom properties, shadcn bridge)
  bridge.ts       # Wires CMI runtime to RxDB persistence + resume
```

## Subpath Imports

```typescript
import "@corm/player";                              // registers all web components
import { CmiRuntime } from "@corm/player/cmi";      // SCORM state model
import { SequencingEngine } from "@corm/player/sequencing";
import { scoreInteraction, AssessmentSession } from "@corm/player/assessment";
import { createCormStore } from "@corm/player/store";
import { installScormShim } from "@corm/player/shim";
import { HashChain, AuditLogger } from "@corm/player/audit";
import { SyncCoordinator } from "@corm/player/sync";
import { cormTheme, cormButton, cormCard } from "@corm/player/styles";
```

## Build

```bash
npm install && npm run build   # outputs to dist/
```

## Key Design Decisions

- **Lit web components** with shadow DOM — framework-agnostic, works in React/Vue/vanilla
- **RxDB** for offline-first persistence — IndexedDB in browser, in-memory for tests
- **RxDB is a peer dependency** (optional) — shared with host app when both use it
- **MQTT sync** with 128KB packet chunking — designed for satellite connectivity
- **Dual SCORM API shim** — existing Articulate SCOs run unchanged via iframe + window.API
- **Content detection** — auto-detects markdown vs SCO HTML by extension/pattern
- **Theme bridge** — inherits shadcn CSS custom properties from host, falls back to seaducate.com navy/gold/cyan defaults

## CMI Runtime

Full SCORM 1.2 + 2004 data model. Every `setValue` persists to RxDB immediately.

```typescript
const runtime = new CmiRuntime();
runtime.initialize("learner-42", "John Doe");
runtime.setValue("cmi.core.lesson_location", "slide-3");
runtime.setValue("cmi.core.lesson_status", "incomplete");
runtime.onCommit = async (state) => { /* persist to RxDB */ };
runtime.commit();
```

## Sequencing Engine

IMS Simple Sequencing interpreter. Evaluates controlMode, preconditions, postconditions, rollup.

```typescript
const tree = buildActivityTree(manifest.organizations);
const engine = new SequencingEngine(tree, runtime);
const result = engine.navigate("start");        // first activity
const next = engine.navigate("continue");       // next per sequencing rules
const choice = engine.navigate("choice", "item-3"); // direct jump
```

## Assessment Scoring

All 10 SCORM interaction types with SCORM response format parsing.

```typescript
const result = scoreInteraction(definition, response);
// result: { correct: boolean, result: "correct"|"wrong"|"neutral", score: number }
```

**Types:** true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other

## STCW Audit Trail

SHA-256 hash-chained interactions. Tamper-evident — breaking any link invalidates the chain.

```typescript
const chain = new HashChain();
const hash = await chain.append({ interactionId, type, learnerResponse, result, timestamp });
const verification = await HashChain.verify(interactions); // { valid: boolean, brokenAt?: number }
```

## SCORM API Shim

Drop-in replacement for existing SCORM players. Vendor SCOs call `window.API.LMSGetValue()` etc.

```typescript
const { api12, api2004, uninstall } = installScormShim({
  runtime,
  studentId: "learner-42",
  studentName: "John Doe",
});
// window.API and window.API_1484_11 are now set
```

## Sync

MQTT with 128KB packet limit. Offline queue drains on reconnect.

```typescript
const coordinator = new SyncCoordinator({ store, courseId, learnerId, mqttBrokerUrl });
await coordinator.start();  // connects MQTT, watches RxDB changes, auto-drains queue
coordinator.getStatus();    // { connected, pendingCount, lastSyncAt, watching }
await coordinator.stop();
```

## Theme

CSS custom properties bridge. Set these on the host to override defaults:

```css
:root {
  --primary: 36 100% 58%;        /* gold — player reads as --corm-primary */
  --background: 217 39% 14%;     /* navy */
  --secondary: 187 79% 43%;      /* cyan */
  --destructive: 0 84% 60%;      /* red */
  --radius: 0.75rem;
  --ring: 36 100% 58%;
}
```

If no host theme is detected, defaults to seaducate.com's navy/gold/cyan palette.

## RxDB Collections

| Collection | Key | Purpose |
|------------|-----|---------|
| `enrollments` | learnerId_courseId | Learner-course binding |
| `attempts` | enrollmentId_attemptNumber | Per-attempt tracking |
| `cmi_state` | attemptId | Full CMI snapshot for resume |
| `interactions` | attemptId_index | Hash-chained assessment responses |
| `sync_queue` | auto | Outbound changes pending MQTT sync |

## Testing

```bash
deno test --allow-read --allow-write --allow-env --allow-net packages/player/tests/
```

204 tests total. RxDB integration tests use in-memory storage adapter.
