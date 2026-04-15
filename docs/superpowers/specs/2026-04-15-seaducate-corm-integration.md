# Seaducate.com CORM Integration Spec

## Overview

Integrate the `@corm/player` npm package into seaducate.com to replace the iframe-based SCORM player with a native CORM web component. SCORM packages are transpiled to CORM format at upload time, and the CORM player renders them with offline-first RxDB persistence.

## Current State

### Upload Pipeline (server-side)
1. Teacher uploads SCORM `.zip` via `POST /api/upload/course-content`
2. On first view (or explicit trigger), `POST /api/extract-course-package` calls `extractCoursePackage()` in `server/src/services/extract.ts`
3. Extraction: unzip → find `imsmanifest.xml` → locate entry point → write files to `course-player/{courseId}/`
4. `launch_url` stored in `courses` table → `/uploads/course-player/{courseId}/{entryPoint}`

### Playback (client-side)
1. `CourseViewer.tsx` (657 lines) fetches enrollment + course data
2. `buildScormPlayerHtml()` generates iframe srcdoc with SCORM 1.2 + 2004 API shims
3. SCO runs in iframe, communicates via `postMessage` (scorm-status, scorm-score, scorm-finish)
4. Progress tracked via `PATCH /api/enrollments/:id`

### Database
- `courses` table: `format`, `content_url` (zip path), `launch_url` (extracted entry point)
- `enrollments` table: `status`, `progress` (0-100), `completed_at`
- `course_versions` table: draft→submitted→approved→published workflow

## Changes Required

### 1. Database Migration

**New migration: `0XX_corm_manifest.sql`**

```sql
ALTER TABLE courses ADD COLUMN corm_manifest_url TEXT;
ALTER TABLE course_versions ADD COLUMN corm_manifest_url TEXT;
```

No new tables needed — RxDB on the client handles detailed tracking (attempts, cmi_state, interactions). The server only needs to know where the CORM manifest lives.

### 2. Server: Extend Extraction Service

**File: `server/src/services/extract.ts`**

After the existing extraction logic (unzip + write files), add a CORM transpilation step:

```
extractCoursePackage(courseId, contentUrl)
  1. [existing] Unzip → write files to course-player/{courseId}/
  2. [existing] Find entry point from imsmanifest.xml
  3. [NEW] Read imsmanifest.xml content from extracted files
  4. [NEW] Parse with @corm/scorm-parser: detectVersion() + parseManifestXml()
  5. [NEW] Transpile with @corm/lens: scormToCorm()
  6. [NEW] Write corm-manifest.json to course-player/{courseId}/corm-manifest.json
  7. [NEW] Return corm_manifest_url alongside existing launch_url
```

**Return type update:**
```typescript
interface ExtractResult {
  launch_url: string;         // existing — iframe fallback
  entry_point: string;        // existing
  files_count: number;        // existing
  corm_manifest_url: string;  // NEW — /uploads/course-player/{courseId}/corm-manifest.json
}
```

**Dependency to add:**
```bash
npm install @corm/transpiler
# or during development:
npm install ../corm/packages/transpiler
```

The `@corm/transpiler` package is a Node.js-compatible npm package that bundles the SCORM parser (using `@xmldom/xmldom` instead of Deno's `deno-dom`) and the CORM lens. It handles BOM stripping, nested manifest paths, and all SCORM versions (1.2, 2004 2nd–4th).

**Usage in extraction service:**
```typescript
import { transpileScorm } from "@corm/transpiler";

// After extracting files from the zip:
const zipBuffer = await readUploadFile("course-content", contentUrl);
const cormManifest = await transpileScorm(new Uint8Array(zipBuffer));
const manifestJson = JSON.stringify(cormManifest, null, 2);
await writeUploadFile("course-player", `${courseId}/corm-manifest.json`, Buffer.from(manifestJson));
const cormManifestUrl = getPublicUrl("course-player", `${courseId}/corm-manifest.json`);
```

### 3. Server: Update Course Routes

**File: `server/src/routes/courses.ts`**

After extraction, update the courses table:
```sql
UPDATE courses SET launch_url = $1, corm_manifest_url = $2 WHERE id = $3
```

**New endpoint: `GET /api/courses/:id/manifest.json`**
- Reads `corm_manifest_url` from courses table
- Serves the CORM manifest JSON from the `course-player` bucket
- Returns 404 if not yet transpiled (fallback to iframe player)

### 4. Server: Extraction API Response

**File: `server/src/routes/upload.ts` or wherever `POST /api/extract-course-package` is handled**

Update the extraction endpoint response to include `corm_manifest_url`:
```json
{
  "launch_url": "/uploads/course-player/{id}/index_lms.html",
  "entry_point": "index_lms.html",
  "files_count": 142,
  "corm_manifest_url": "/uploads/course-player/{id}/corm-manifest.json"
}
```

### 5. Client: Install @corm/player

```bash
npm install @corm/player
# or during development:
npm install ../corm/packages/player
```

### 6. Client: Replace CourseViewer.tsx

**File: `src/pages/dashboard/CourseViewer.tsx`**

Replace the 657-line component with a much simpler version:

```tsx
import "@corm/player";

function CourseViewer() {
  const { courseId } = useParams();
  const [enrollment, setEnrollment] = useState(null);
  const [course, setCourse] = useState(null);

  useEffect(() => {
    // Fetch enrollment + course data (existing logic)
    fetchEnrollment(courseId).then(({ enrollment, course }) => {
      setEnrollment(enrollment);
      setCourse(course);
    });
  }, [courseId]);

  if (!course || !enrollment) return <Loading />;

  // If CORM manifest exists, use CORM player
  if (course.corm_manifest_url) {
    return (
      <div className="h-full w-full">
        <corm-player
          course-id={course.id}
          learner-id={enrollment.student_id}
          manifest-url={course.corm_manifest_url}
        />
      </div>
    );
  }

  // Fallback: existing iframe player for courses not yet transpiled
  return <LegacyScormPlayer course={course} enrollment={enrollment} />;
}
```

**Key changes:**
- `<corm-player>` replaces the entire iframe + buildScormPlayerHtml() + postMessage listener
- The CORM player handles: SCORM API shim, progress tracking, resume, completion — all via RxDB
- The fallback `<LegacyScormPlayer>` preserves the existing iframe approach for courses uploaded before migration

### 7. Client: Progress Sync (Server Enrollment Updates)

The CORM player tracks progress in RxDB locally. The server's `enrollments` table still needs updates for:
- Dashboard progress display
- Certificate generation
- Admin reporting

**Two options:**

**(a) MQTT sync (Pi terminals):** The CORM player's SyncCoordinator publishes to `corm/{courseId}/{learnerId}/sync`. A server-side MQTT subscriber reads these and updates PostgreSQL.

**(b) REST webhook from player (seaducate.com web):** Add a callback to the CORM player that fires on status changes:

```tsx
<corm-player
  course-id={course.id}
  learner-id={enrollment.student_id}
  manifest-url={course.corm_manifest_url}
  @corm-status-change=${(e) => {
    // Update server enrollment
    fetch(`/api/enrollments/${enrollment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        progress: e.detail.progress,
        status: e.detail.completed ? 'completed' : 'active',
      })
    });
  }}
/>
```

**Recommended: (b) for seaducate.com web, (a) for Pi terminals.** The player should emit `corm-status-change` custom events that the host app can listen to.

This requires a small addition to `<corm-player>`: dispatch a CustomEvent on CMI commit when lesson_status or progress changes. This is a minor enhancement to the player component.

### 8. Retroactive Transpilation

Existing courses already uploaded need their CORM manifests generated. Options:

**(a) Lazy:** Transpile on first view if `corm_manifest_url` is null. Player falls back to iframe while transpiling, then switches on next load.

**(b) Batch migration script:** One-time script that iterates all courses with `format = 'scorm'` and runs transpilation.

**Recommended: both.** Run the batch migration for existing courses, and keep the lazy fallback for safety.

```sql
-- Find courses needing transpilation
SELECT id, content_url FROM courses
WHERE format = 'scorm' AND corm_manifest_url IS NULL;
```

### 9. Pi Terminal / Onboard Delivery

For onboard Pi terminals with intermittent connectivity:

1. **Course content sync:** Server publishes CORM manifest + content files to MQTT topic `corm/{courseId}/content`
2. **Pi receives:** The outpost-router (Deno service on Pi) subscribes, writes files to local storage
3. **Pi serves locally:** `<corm-player manifest-url="http://localhost:8080/courses/{id}/corm-manifest.json">`
4. **Tracking sync:** Player's SyncCoordinator publishes learner progress to `corm/{courseId}/{learnerId}/sync` via MQTT
5. **Server receives:** MQTT subscriber on AWS updates PostgreSQL enrollments

The existing `@corm/content-store` checksum diffing ensures only changed files are transferred — critical for satellite bandwidth.

## Migration Plan

### Phase 1: Server-side transpilation (no client changes)
1. Add database migration for `corm_manifest_url`
2. Extend `extractCoursePackage()` to transpile and write CORM manifest
3. Add `GET /api/courses/:id/manifest.json` endpoint
4. Run batch transpilation on existing courses
5. **Verify:** All existing courses get valid CORM manifests

### Phase 2: Client-side player swap
1. Install `@corm/player`
2. Add `corm-status-change` event to player (minor enhancement)
3. Replace `CourseViewer.tsx` with CORM player + legacy fallback
4. Wire progress callback to enrollment PATCH
5. **Verify:** H2S Safety course plays through CORM player with progress tracked

### Phase 3: Pi terminal integration
1. Add MQTT content publisher on server
2. Update outpost-router to subscribe and cache course content
3. Serve CORM player locally on Pi
4. Wire MQTT sync for learner tracking
5. **Verify:** Course plays offline on Pi, progress syncs when connected

## Files Modified Summary

### Server (seaducate.com)
| File | Change |
|------|--------|
| `server/migrations/0XX_corm_manifest.sql` | NEW — add corm_manifest_url column |
| `server/src/services/extract.ts` | MODIFY — add CORM transpilation step |
| `server/src/routes/courses.ts` | MODIFY — store corm_manifest_url, add manifest endpoint |

### Client (seaducate.com)
| File | Change |
|------|--------|
| `package.json` | MODIFY — add @corm/player dependency |
| `src/pages/dashboard/CourseViewer.tsx` | REWRITE — replace iframe with <corm-player> |

### CORM Player (corm repo)
| File | Change |
|------|--------|
| `packages/player/src/components/corm-player.ts` | MODIFY — add corm-status-change event dispatch |

## Dependencies

```
seaducate.com client (Vite/React)
  └── @corm/player (npm, Lit web components)
        ├── lit ^3.2.0
        ├── marked ^15.0.0
        └── rxdb ^16.0.0 (peer, optional)

seaducate.com server (Hono/Node.js)
  └── @corm/transpiler (npm, Node.js-compatible)
        ├── effect ^3.14.0
        ├── jszip ^3.10.0
        └── @xmldom/xmldom ^0.9.0
```

## Testing Checklist

- [ ] SCORM 1.2 course (H2S Safety) transpiles to valid CORM manifest
- [ ] CORM manifest served at `/api/courses/:id/manifest.json`
- [ ] `<corm-player>` renders H2S Safety course in seaducate.com
- [ ] Progress updates flow from player → server enrollment
- [ ] Resume works: close browser, reopen, course resumes from last position
- [ ] Legacy fallback: courses without CORM manifest still play via iframe
- [ ] New upload: fresh SCORM zip upload → extraction → transpilation → CORM player
- [ ] Certificate generation still works on course completion
