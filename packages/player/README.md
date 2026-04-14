# @corm/player

CORM course player — a Lit web component that replaces SCORM players with offline-first, MQTT-synced course delivery.

## Usage

```html
<script type="module">
  import "@corm/player";
</script>

<corm-player
  course-id="h2s-safety"
  learner-id="seafarer-42"
  manifest-url="/api/courses/h2s-safety/manifest.json"
></corm-player>
```

## React Integration

```tsx
import "@corm/player";

function CourseViewer({ courseId, learnerId }) {
  return (
    <corm-player
      course-id={courseId}
      learner-id={learnerId}
      manifest-url={`/api/courses/${courseId}/manifest.json`}
    />
  );
}
```

## Subpath Imports

```typescript
import { CmiRuntime } from "@corm/player/cmi";
import { SequencingEngine } from "@corm/player/sequencing";
import { scoreInteraction } from "@corm/player/assessment";
import { createCormStore } from "@corm/player/store";
import { installScormShim } from "@corm/player/shim";
```
