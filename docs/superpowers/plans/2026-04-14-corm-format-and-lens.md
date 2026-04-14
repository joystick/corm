# CORM Format & Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CORM format schema, SCORM parser, lens transpiler (get/put), content-addressable store, asset processor, and validator — the foundation that all other CORM subsystems depend on.

**Architecture:** Effect.ts services with Layer-based DI. The lens core (`get`/`put`) orchestrates the SCORM parser, vendor parsers, asset processor, and content-addressable store. Every service boundary is instrumented with OpenTelemetry via Effect's built-in support. The transpiler ships as a Docker image (shore-side) and a Deno CLI tool.

**Tech Stack:** Deno 2.x, Effect.ts, Biome (lint/format), Deno workspace layout. Dependencies: `effect`, `@effect/schema`, `@effect/platform`, `sharp` (image processing), `jszip` (SCORM unpacking), `js-yaml` (YAML serialization).

---

## File Structure

```
corm/
  deno.json                          # root workspace config
  biome.json                         # linting & formatting
  packages/
    schema/                          # CORM format types & validation
      deno.json
      src/
        manifest.ts                  # Manifest, Organization, Item types
        sequencing.ts                # Full SCORM sequencing types
        slide.ts                     # Slide type (frontmatter + markdown)
        assessment.ts                # Assessment & Interaction types
        proctoring.ts                # Proctoring requirement types
        asset.ts                     # Asset, ContentAddressedStore types
        metadata.ts                  # LOM metadata types
        package.ts                   # CormPackage root type + schema
        checksums.ts                 # Checksums type + helpers
        mod.ts                       # public barrel export
      tests/
        manifest.test.ts
        sequencing.test.ts
        assessment.test.ts
        package.test.ts

    scorm-parser/                    # SCORM package parser
      deno.json
      src/
        parser.ts                    # ScormParser Effect service
        manifest-xml.ts              # imsmanifest.xml → typed AST
        version-detect.ts            # SCORM 1.2 vs 2004 detection
        sequencing-xml.ts            # Sequencing XML → types
        metadata-xml.ts              # LOM metadata XML → types
        errors.ts                    # Typed parse errors
        mod.ts
      tests/
        parser.test.ts
        manifest-xml.test.ts
        version-detect.test.ts
        sequencing-xml.test.ts

    vendor-parsers/                  # Pluggable vendor content extractors
      deno.json
      src/
        interface.ts                 # VendorParser interface
        registry.ts                  # VendorParserRegistry service
        generic/
          parser.ts                  # DOM-based HTML→Markdown fallback
        articulate-storyline/
          detect.ts                  # Detection: story_content/, story.html
          parser.ts                  # Extract from slides.js data model
        articulate-rise/
          detect.ts                  # Detection: scormcontent/, Rise JSON
          parser.ts                  # Extract from Rise JSON
        mod.ts
      tests/
        generic.test.ts
        articulate-storyline.test.ts
        articulate-rise.test.ts
        registry.test.ts

    content-store/                   # Content-addressed asset storage
      deno.json
      src/
        store.ts                     # ContentStore Effect service
        hash.ts                      # SHA-256 hashing utilities
        checksums.ts                 # checksums.yaml generation & comparison
        mod.ts
      tests/
        store.test.ts
        hash.test.ts
        checksums.test.ts

    asset-processor/                 # Image compression, transcript extraction
      deno.json
      src/
        processor.ts                 # AssetProcessor Effect service
        image.ts                     # Image → WebP compression (≤128KB)
        transcript.ts                # Audio → transcript extraction
        mod.ts
      tests/
        processor.test.ts
        image.test.ts
        transcript.test.ts

    lens/                            # Core get/put transpiler
      deno.json
      src/
        get.ts                       # SCORM → CORM (normalize)
        put.ts                       # CORM → SCORM (reconstruct)
        lens.ts                      # Lens service combining get+put
        scorm-builder.ts             # CORM → imsmanifest.xml + HTML
        md-renderer.ts               # Markdown → HTML for SCORM output
        assessment-renderer.ts       # YAML assessment → interactive HTML
        errors.ts                    # Typed lens errors
        mod.ts
      tests/
        get.test.ts
        put.test.ts
        roundtrip.test.ts            # Lens law verification
        scorm-builder.test.ts

    validator/                       # Schema + size + roundtrip validation
      deno.json
      src/
        validator.ts                 # CormValidator Effect service
        schema-check.ts              # Validate against CORM schema
        size-check.ts                # Enforce ≤128KB per file
        roundtrip-check.ts           # put(get(s)) conformance verification
        mod.ts
      tests/
        validator.test.ts
        schema-check.test.ts
        size-check.test.ts

    cli/                             # Deno CLI entrypoint
      deno.json
      src/
        main.ts                      # CLI commands: get, put, validate, diff
        mod.ts
      tests/
        cli.test.ts

  fixtures/                          # Test SCORM packages
    minimal-scorm12/                 # Minimal SCORM 1.2 package
    minimal-scorm2004/               # Minimal SCORM 2004 4th ed package
    README.md                        # How to add test fixtures
  Dockerfile                         # Shore-side transpiler image
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `deno.json`
- Create: `biome.json`
- Create: `packages/schema/deno.json`
- Create: `packages/scorm-parser/deno.json`
- Create: `packages/vendor-parsers/deno.json`
- Create: `packages/content-store/deno.json`
- Create: `packages/asset-processor/deno.json`
- Create: `packages/lens/deno.json`
- Create: `packages/validator/deno.json`
- Create: `packages/cli/deno.json`

- [ ] **Step 1: Create root workspace deno.json**

```json
{
  "workspace": [
    "./packages/schema",
    "./packages/scorm-parser",
    "./packages/vendor-parsers",
    "./packages/content-store",
    "./packages/asset-processor",
    "./packages/lens",
    "./packages/validator",
    "./packages/cli"
  ],
  "tasks": {
    "test": "deno test --allow-read --allow-write --allow-net packages/",
    "lint": "deno run -A npm:@biomejs/biome check .",
    "fmt": "deno run -A npm:@biomejs/biome format --write .",
    "check": "deno check packages/*/src/mod.ts"
  },
  "imports": {
    "effect": "npm:effect@^3.14",
    "@effect/schema": "npm:@effect/schema@^0.79",
    "@effect/platform": "npm:@effect/platform@^0.78",
    "js-yaml": "npm:js-yaml@^4.1",
    "jszip": "npm:jszip@^3.10",
    "sharp": "npm:sharp@^0.33"
  }
}
```

- [ ] **Step 2: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

- [ ] **Step 3: Create package deno.json files**

Each package gets a minimal deno.json. Example for `packages/schema/deno.json`:

```json
{
  "name": "@corm/schema",
  "version": "0.1.0",
  "exports": "./src/mod.ts"
}
```

Create the same pattern for each package:
- `@corm/schema` → `packages/schema/deno.json`
- `@corm/scorm-parser` → `packages/scorm-parser/deno.json`
- `@corm/vendor-parsers` → `packages/vendor-parsers/deno.json`
- `@corm/content-store` → `packages/content-store/deno.json`
- `@corm/asset-processor` → `packages/asset-processor/deno.json`
- `@corm/lens` → `packages/lens/deno.json`
- `@corm/validator` → `packages/validator/deno.json`
- `@corm/cli` → `packages/cli/deno.json`

- [ ] **Step 4: Create empty barrel exports**

For each package, create `packages/{name}/src/mod.ts` with an empty export:

```typescript
// @corm/{name} — public API
export {};
```

- [ ] **Step 5: Verify workspace resolves**

Run: `deno check packages/schema/src/mod.ts`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add deno.json biome.json packages/
git commit -m "feat: scaffold Deno workspace with 8 packages"
```

---

### Task 2: CORM Schema — Sequencing Types

**Files:**
- Create: `packages/schema/src/sequencing.ts`
- Test: `packages/schema/tests/sequencing.test.ts`

This is the most complex schema — full SCORM IMS Simple Sequencing mapped to Effect Schema types. Getting this right is critical because the lens laws depend on lossless representation.

- [ ] **Step 1: Write the failing test**

Create `packages/schema/tests/sequencing.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import {
  ControlMode,
  SequencingRule,
  Condition,
  Objective,
  ObjectiveMap,
  RollupRule,
  ItemSequencing,
} from "../src/sequencing.ts";

describe("ControlMode", () => {
  it("decodes a valid control mode", () => {
    const input = {
      choice: true,
      choiceExit: true,
      flow: true,
      forwardOnly: false,
      useCurrentAttemptObjectiveInfo: true,
      useCurrentAttemptProgressInfo: true,
    };
    const result = Schema.decodeUnknownSync(ControlMode)(input);
    expect(result.choice).toBe(true);
    expect(result.forwardOnly).toBe(false);
  });

  it("applies defaults for missing optional fields", () => {
    const result = Schema.decodeUnknownSync(ControlMode)({});
    expect(result.choice).toBe(true);
    expect(result.flow).toBe(false);
    expect(result.forwardOnly).toBe(false);
  });
});

describe("Condition", () => {
  it("decodes a satisfied condition", () => {
    const input = {
      condition: "satisfied",
      refObjective: "obj-01",
    };
    const result = Schema.decodeUnknownSync(Condition)(input);
    expect(result.condition).toBe("satisfied");
    expect(result.refObjective).toBe("obj-01");
  });

  it("decodes a measure condition with threshold", () => {
    const input = {
      condition: "objectiveMeasureGreaterThan",
      refObjective: "obj-01",
      measureThreshold: 0.7,
      operator: "not",
    };
    const result = Schema.decodeUnknownSync(Condition)(input);
    expect(result.measureThreshold).toBe(0.7);
    expect(result.operator).toBe("not");
  });

  it("rejects invalid condition type", () => {
    expect(() =>
      Schema.decodeUnknownSync(Condition)({ condition: "invalid" })
    ).toThrow();
  });
});

describe("Objective", () => {
  it("decodes an objective with maps", () => {
    const input = {
      id: "obj-primary",
      primary: true,
      satisfiedByMeasure: true,
      minNormalizedMeasure: 0.7,
      maps: [
        {
          target: "global-obj-01",
          readSatisfied: false,
          readNormalizedMeasure: false,
          writeSatisfied: true,
          writeNormalizedMeasure: true,
        },
      ],
    };
    const result = Schema.decodeUnknownSync(Objective)(input);
    expect(result.primary).toBe(true);
    expect(result.maps).toHaveLength(1);
    expect(result.maps![0].writeSatisfied).toBe(true);
  });
});

describe("RollupRule", () => {
  it("decodes a rollup rule with child activity set", () => {
    const input = {
      childActivitySet: "all",
      action: "satisfied",
      conditions: [{ condition: "satisfied" }],
    };
    const result = Schema.decodeUnknownSync(RollupRule)(input);
    expect(result.childActivitySet).toBe("all");
    expect(result.action).toBe("satisfied");
  });
});

describe("ItemSequencing", () => {
  it("decodes a full sequencing block", () => {
    const input = {
      controlMode: { choice: true, flow: true },
      constrainChoice: false,
      preventActivation: false,
      preconditions: [
        {
          action: "skip",
          conditions: {
            operator: "all",
            rules: [{ condition: "satisfied", refObjective: "obj-pretest" }],
          },
        },
      ],
      postconditions: [],
      exitConditions: [],
      objectives: [
        {
          id: "obj-primary",
          primary: true,
          satisfiedByMeasure: true,
          minNormalizedMeasure: 0.8,
        },
      ],
      rollupRules: [],
      deliveryControls: { tracked: true, completionSetByContent: false, objectiveSetByContent: true },
    };
    const result = Schema.decodeUnknownSync(ItemSequencing)(input);
    expect(result.controlMode.choice).toBe(true);
    expect(result.preconditions).toHaveLength(1);
    expect(result.objectives).toHaveLength(1);
    expect(result.objectives[0].minNormalizedMeasure).toBe(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test packages/schema/tests/sequencing.test.ts`
Expected: FAIL — cannot import from `../src/sequencing.ts`

- [ ] **Step 3: Write the sequencing types**

Create `packages/schema/src/sequencing.ts`:

```typescript
import { Schema } from "effect";

// SCORM condition types — exhaustive list from IMS SS spec
export const ConditionType = Schema.Literal(
  "satisfied",
  "objectiveStatusKnown",
  "objectiveMeasureKnown",
  "objectiveMeasureGreaterThan",
  "objectiveMeasureLessThan",
  "completed",
  "activityProgressKnown",
  "attempted",
  "attemptLimitExceeded",
  "timeLimitExceeded",
  "outsideAvailableTimeRange",
  "always"
);

export const ConditionOperator = Schema.Literal("not");

export const Condition = Schema.Struct({
  condition: ConditionType,
  refObjective: Schema.optional(Schema.String),
  measureThreshold: Schema.optional(Schema.Number),
  operator: Schema.optional(ConditionOperator),
});
export type Condition = typeof Condition.Type;

export const ConditionSet = Schema.Struct({
  operator: Schema.Literal("all", "any").pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => "all" as const)
  ),
  rules: Schema.Array(Condition),
});

// Sequencing rule actions — exhaustive from IMS SS
export const PreconditionAction = Schema.Literal(
  "skip",
  "disabled",
  "hiddenFromChoice",
  "stopForwardTraversal"
);

export const PostconditionAction = Schema.Literal(
  "exitParent",
  "exitAll",
  "retry",
  "retryAll",
  "continue",
  "previous"
);

export const ExitConditionAction = Schema.Literal("exit");

export const SequencingRule = Schema.Struct({
  action: Schema.String, // union of pre/post/exit actions
  conditions: ConditionSet,
});
export type SequencingRule = typeof SequencingRule.Type;

export const ObjectiveMap = Schema.Struct({
  target: Schema.String,
  readSatisfied: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  readNormalizedMeasure: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  writeSatisfied: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  writeNormalizedMeasure: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});
export type ObjectiveMap = typeof ObjectiveMap.Type;

export const Objective = Schema.Struct({
  id: Schema.String,
  primary: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  satisfiedByMeasure: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  minNormalizedMeasure: Schema.optionalWith(Schema.Number, { default: () => 1.0 }),
  maps: Schema.optional(Schema.Array(ObjectiveMap)),
});
export type Objective = typeof Objective.Type;

export const ChildActivitySet = Schema.Literal(
  "all",
  "any",
  "none",
  "atLeastCount",
  "atLeastPercent"
);

export const RollupAction = Schema.Literal(
  "satisfied",
  "notSatisfied",
  "completed",
  "incomplete"
);

export const RollupCondition = Schema.Struct({
  condition: Schema.Literal(
    "satisfied",
    "objectiveStatusKnown",
    "objectiveMeasureKnown",
    "completed",
    "activityProgressKnown",
    "attempted",
    "attemptLimitExceeded"
  ),
  operator: Schema.optional(ConditionOperator),
});

export const RollupRule = Schema.Struct({
  childActivitySet: ChildActivitySet,
  minimumCount: Schema.optional(Schema.Number),
  minimumPercent: Schema.optional(Schema.Number),
  conditions: Schema.Array(RollupCondition),
  action: RollupAction,
});
export type RollupRule = typeof RollupRule.Type;

export const ControlMode = Schema.Struct({
  choice: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  choiceExit: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  flow: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  forwardOnly: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  useCurrentAttemptObjectiveInfo: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  useCurrentAttemptProgressInfo: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});
export type ControlMode = typeof ControlMode.Type;

export const RandomizationControls = Schema.Struct({
  randomizationTiming: Schema.optional(Schema.Literal("never", "once", "onEachNewAttempt")),
  selectCount: Schema.optional(Schema.Number),
  reorderChildren: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  selectionTiming: Schema.optional(Schema.Literal("never", "once", "onEachNewAttempt")),
});

export const LimitConditions = Schema.Struct({
  attemptLimit: Schema.optional(Schema.Number),
  attemptAbsoluteDurationLimit: Schema.optional(Schema.String),
});

export const DeliveryControls = Schema.Struct({
  tracked: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  completionSetByContent: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  objectiveSetByContent: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export const RollupConsideration = Schema.Struct({
  requiredForSatisfied: Schema.optional(
    Schema.Literal("always", "ifAttempted", "ifNotSkipped", "ifNotSuspended")
  ),
  requiredForNotSatisfied: Schema.optional(
    Schema.Literal("always", "ifAttempted", "ifNotSkipped", "ifNotSuspended")
  ),
  requiredForCompleted: Schema.optional(
    Schema.Literal("always", "ifAttempted", "ifNotSkipped", "ifNotSuspended")
  ),
  requiredForIncomplete: Schema.optional(
    Schema.Literal("always", "ifAttempted", "ifNotSkipped", "ifNotSuspended")
  ),
});

export const ItemSequencing = Schema.Struct({
  controlMode: Schema.optionalWith(ControlMode, {
    default: () => Schema.decodeUnknownSync(ControlMode)({}),
  }),
  constrainChoice: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  preventActivation: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  preconditions: Schema.optionalWith(Schema.Array(SequencingRule), { default: () => [] }),
  postconditions: Schema.optionalWith(Schema.Array(SequencingRule), { default: () => [] }),
  exitConditions: Schema.optionalWith(Schema.Array(SequencingRule), { default: () => [] }),
  objectives: Schema.optionalWith(Schema.Array(Objective), { default: () => [] }),
  rollupRules: Schema.optionalWith(Schema.Array(RollupRule), { default: () => [] }),
  rollupConsideration: Schema.optional(RollupConsideration),
  limitConditions: Schema.optional(LimitConditions),
  randomizationControls: Schema.optional(RandomizationControls),
  deliveryControls: Schema.optionalWith(DeliveryControls, {
    default: () => Schema.decodeUnknownSync(DeliveryControls)({}),
  }),
});
export type ItemSequencing = typeof ItemSequencing.Type;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test packages/schema/tests/sequencing.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/sequencing.ts packages/schema/tests/sequencing.test.ts
git commit -m "feat(schema): add full SCORM sequencing types with Effect Schema"
```

---

### Task 3: CORM Schema — Assessment & Interaction Types

**Files:**
- Create: `packages/schema/src/assessment.ts`
- Test: `packages/schema/tests/assessment.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/tests/assessment.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import {
  InteractionType,
  Interaction,
  Assessment,
} from "../src/assessment.ts";

describe("InteractionType", () => {
  it("accepts all 10 SCORM interaction types", () => {
    const types = [
      "true_false", "single_choice", "multi_choice", "fill_in",
      "long_fill_in", "matching", "performance", "sequencing",
      "likert", "numeric", "other",
    ];
    for (const t of types) {
      expect(() => Schema.decodeUnknownSync(InteractionType)(t)).not.toThrow();
    }
  });

  it("rejects unknown type", () => {
    expect(() => Schema.decodeUnknownSync(InteractionType)("drag_drop")).toThrow();
  });
});

describe("Interaction", () => {
  it("decodes a single_choice interaction", () => {
    const input = {
      id: "q1",
      type: "single_choice",
      weighting: 1.0,
      text: "Which class of fire involves flammable liquids?",
      choices: [
        { id: "a", text: "Class A" },
        { id: "b", text: "Class B", correct: true },
        { id: "c", text: "Class C" },
      ],
      feedback: {
        correct: "Correct!",
        incorrect: "Incorrect.",
      },
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.id).toBe("q1");
    expect(result.type).toBe("single_choice");
    expect(result.choices).toHaveLength(3);
  });

  it("decodes a matching interaction", () => {
    const input = {
      id: "q2",
      type: "matching",
      weighting: 1.5,
      text: "Match fire class to fuel",
      source: [{ id: "s1", text: "Class A" }],
      target: [{ id: "t1", text: "Ordinary combustibles" }],
      correctMatches: [["s1", "t1"]],
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.type).toBe("matching");
    expect(result.correctMatches).toHaveLength(1);
  });

  it("decodes a sequencing interaction", () => {
    const input = {
      id: "q3",
      type: "sequencing",
      weighting: 1.0,
      text: "Order the PASS steps",
      items: [
        { id: "p", text: "Pull the pin" },
        { id: "a", text: "Aim at the base" },
      ],
      correctOrder: ["p", "a"],
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.correctOrder).toEqual(["p", "a"]);
  });

  it("decodes a numeric interaction", () => {
    const input = {
      id: "q4",
      type: "numeric",
      weighting: 1.0,
      text: "What is the minimum fire extinguisher pressure (bar)?",
      correctMin: 12,
      correctMax: 14,
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.correctMin).toBe(12);
  });

  it("decodes a performance interaction", () => {
    const input = {
      id: "q5",
      type: "performance",
      weighting: 2.0,
      text: "Demonstrate fire response",
      steps: [
        { id: "step1", description: "Sound the alarm", objective: "obj-alarm" },
        { id: "step2", description: "Call the bridge", objective: "obj-bridge" },
      ],
      completionThreshold: 1.0,
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.steps).toHaveLength(2);
  });
});

describe("Assessment", () => {
  it("decodes a full assessment", () => {
    const input = {
      id: "assess-01",
      title: "Fire Types Knowledge Check",
      randomize: true,
      showFeedback: true,
      interactions: [
        {
          id: "q1",
          type: "true_false",
          weighting: 1.0,
          text: "CO2 is suitable for electrical fires",
          correctResponse: true,
        },
      ],
    };
    const result = Schema.decodeUnknownSync(Assessment)(input);
    expect(result.id).toBe("assess-01");
    expect(result.interactions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test packages/schema/tests/assessment.test.ts`
Expected: FAIL — cannot import from `../src/assessment.ts`

- [ ] **Step 3: Write the assessment types**

Create `packages/schema/src/assessment.ts`:

```typescript
import { Schema } from "effect";

export const InteractionType = Schema.Literal(
  "true_false",
  "single_choice",
  "multi_choice",
  "fill_in",
  "long_fill_in",
  "matching",
  "performance",
  "sequencing",
  "likert",
  "numeric",
  "other"
);
export type InteractionType = typeof InteractionType.Type;

export const Choice = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  correct: Schema.optional(Schema.Boolean),
});

export const MatchItem = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

export const PerformanceStep = Schema.Struct({
  id: Schema.String,
  description: Schema.String,
  objective: Schema.optional(Schema.String),
});

export const Feedback = Schema.Struct({
  correct: Schema.optional(Schema.String),
  incorrect: Schema.optional(Schema.String),
});

export const LikertScale = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

// Interaction is a flexible struct that carries type-specific fields.
// The SCORM standard defines the data model per type; we carry all
// possible fields and validate contextually.
export const Interaction = Schema.Struct({
  id: Schema.String,
  type: InteractionType,
  weighting: Schema.optionalWith(Schema.Number, { default: () => 1.0 }),
  text: Schema.String,
  description: Schema.optional(Schema.String),

  // true_false
  correctResponse: Schema.optional(Schema.Boolean),

  // single_choice / multi_choice
  choices: Schema.optional(Schema.Array(Choice)),
  feedback: Schema.optional(Feedback),

  // fill_in / long_fill_in
  correctPatterns: Schema.optional(Schema.Array(Schema.String)),
  caseSensitive: Schema.optional(Schema.Boolean),

  // matching
  source: Schema.optional(Schema.Array(MatchItem)),
  target: Schema.optional(Schema.Array(MatchItem)),
  correctMatches: Schema.optional(Schema.Array(Schema.Tuple(Schema.String, Schema.String))),

  // sequencing
  items: Schema.optional(Schema.Array(MatchItem)),
  correctOrder: Schema.optional(Schema.Array(Schema.String)),

  // performance
  steps: Schema.optional(Schema.Array(PerformanceStep)),
  completionThreshold: Schema.optional(Schema.Number),

  // likert
  scale: Schema.optional(Schema.Array(LikertScale)),

  // numeric
  correctMin: Schema.optional(Schema.Number),
  correctMax: Schema.optional(Schema.Number),
  correctExact: Schema.optional(Schema.Number),
  tolerance: Schema.optional(Schema.Number),

  // SCORM correct_responses patterns (for round-trip fidelity)
  scormCorrectResponses: Schema.optional(Schema.Array(Schema.String)),

  // Latency/time tracking
  maxTime: Schema.optional(Schema.Number),
});
export type Interaction = typeof Interaction.Type;

export const ProctoringLevel = Schema.Literal(
  "none",
  "self_verified",
  "supervised",
  "remote_async",
  "remote_live"
);

export const ProctoringIdentity = Schema.Struct({
  method: Schema.Literal("pin", "photo", "pin+photo", "biometric"),
  photoCapture: Schema.optional(Schema.Literal("start", "start+end", "periodic")),
  interval: Schema.optional(Schema.Number),
});

export const ProctoringSupervision = Schema.Struct({
  type: Schema.Literal("onboard_officer", "remote_live", "remote_async"),
  officerRole: Schema.optional(Schema.Array(Schema.String)),
  attestation: Schema.optional(Schema.Boolean),
  reviewRequired: Schema.optional(Schema.Boolean),
});

export const ProctoringLockdown = Schema.Struct({
  browserLock: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  copyPaste: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  timeLimit: Schema.optional(Schema.Number),
});

export const ProctoringRecording = Schema.Struct({
  screen: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  screenInterval: Schema.optional(Schema.Number),
  webcam: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  webcamInterval: Schema.optional(Schema.Number),
  events: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

export const ProctoringRequirements = Schema.Struct({
  level: ProctoringLevel,
  identity: Schema.optional(ProctoringIdentity),
  supervision: Schema.optional(ProctoringSupervision),
  lockdown: Schema.optional(ProctoringLockdown),
  recording: Schema.optional(ProctoringRecording),
});

export const Assessment = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  randomize: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  showFeedback: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  interactions: Schema.Array(Interaction),
  proctoring: Schema.optional(ProctoringRequirements),
});
export type Assessment = typeof Assessment.Type;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test packages/schema/tests/assessment.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/assessment.ts packages/schema/tests/assessment.test.ts
git commit -m "feat(schema): add assessment and interaction types with all 10 SCORM types"
```

---

### Task 4: CORM Schema — Manifest, Metadata, Slide, Package

**Files:**
- Create: `packages/schema/src/metadata.ts`
- Create: `packages/schema/src/slide.ts`
- Create: `packages/schema/src/asset.ts`
- Create: `packages/schema/src/checksums.ts`
- Create: `packages/schema/src/proctoring.ts`
- Create: `packages/schema/src/manifest.ts`
- Create: `packages/schema/src/package.ts`
- Create: `packages/schema/src/mod.ts`
- Test: `packages/schema/tests/manifest.test.ts`
- Test: `packages/schema/tests/package.test.ts`

- [ ] **Step 1: Write the failing test for Manifest**

Create `packages/schema/tests/manifest.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import { Manifest, Organization, Item } from "../src/manifest.ts";

describe("Item", () => {
  it("decodes a leaf item with content", () => {
    const input = {
      id: "mod-01",
      title: "Introduction",
      isVisible: true,
      content: ["slide-001.md", "slide-002.md"],
      sequencing: {
        controlMode: { choice: true, flow: true },
        objectives: [{ id: "obj-01", primary: true }],
      },
    };
    const result = Schema.decodeUnknownSync(Item)(input);
    expect(result.id).toBe("mod-01");
    expect(result.content).toHaveLength(2);
  });

  it("decodes a nested item with children", () => {
    const input = {
      id: "unit-01",
      title: "Unit 1",
      items: [
        { id: "mod-01", title: "Module 1", content: ["slide-001.md"] },
        { id: "mod-02", title: "Module 2", content: ["slide-002.md"] },
      ],
    };
    const result = Schema.decodeUnknownSync(Item)(input);
    expect(result.items).toHaveLength(2);
  });
});

describe("Manifest", () => {
  it("decodes a minimal manifest", () => {
    const input = {
      corm: "1.0",
      id: "com.example.fire-safety",
      version: "1.0.0",
      scormSource: "2004-4th",
      metadata: { title: "Fire Safety" },
      organizations: [
        {
          id: "org-default",
          title: "Fire Safety Training",
          items: [{ id: "mod-01", title: "Introduction" }],
        },
      ],
    };
    const result = Schema.decodeUnknownSync(Manifest)(input);
    expect(result.corm).toBe("1.0");
    expect(result.id).toBe("com.example.fire-safety");
    expect(result.organizations).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test packages/schema/tests/manifest.test.ts`
Expected: FAIL

- [ ] **Step 3: Write metadata, slide, asset, checksums, manifest, package types**

Create `packages/schema/src/metadata.ts`:

```typescript
import { Schema } from "effect";

// IEEE LOM metadata — preserving all standard fields
export const LOMMetadata = Schema.Struct({
  title: Schema.String,
  language: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  keywords: Schema.optional(Schema.Array(Schema.String)),
  catalog: Schema.optional(Schema.String),
  entry: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  contributors: Schema.optional(
    Schema.Array(
      Schema.Struct({
        role: Schema.String,
        entity: Schema.String,
        date: Schema.optional(Schema.String),
      })
    )
  ),
  // Extensible: any additional LOM fields preserved as-is
  extensions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
export type LOMMetadata = typeof LOMMetadata.Type;
```

Create `packages/schema/src/slide.ts`:

```typescript
import { Schema } from "effect";

export const Slide = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  layout: Schema.optional(Schema.String),
  transcript: Schema.optional(Schema.String),
  assets: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  durationEstimate: Schema.optional(Schema.String),
  body: Schema.String, // Markdown content
});
export type Slide = typeof Slide.Type;
```

Create `packages/schema/src/asset.ts`:

```typescript
import { Schema } from "effect";

export const AssetRef = Schema.String; // SHA-256 hash or path

export const AssetEntry = Schema.Struct({
  hash: Schema.String,
  originalPath: Schema.optional(Schema.String),
  mimeType: Schema.optional(Schema.String),
  size: Schema.Number,
});
export type AssetEntry = typeof AssetEntry.Type;
```

Create `packages/schema/src/checksums.ts`:

```typescript
import { Schema } from "effect";

export const Checksums = Schema.Struct({
  version: Schema.String,
  previousVersion: Schema.optional(Schema.String),
  files: Schema.Record({ key: Schema.String, value: Schema.String }),
});
export type Checksums = typeof Checksums.Type;
```

Create `packages/schema/src/manifest.ts`:

```typescript
import { Schema } from "effect";
import { LOMMetadata } from "./metadata.ts";
import { ItemSequencing } from "./sequencing.ts";

export const ScormVersion = Schema.Literal("1.2", "2004-2nd", "2004-3rd", "2004-4th");
export type ScormVersion = typeof ScormVersion.Type;

export const TTSConfig = Schema.Struct({
  engine: Schema.optionalWith(Schema.String, { default: () => "browser" }),
  voice: Schema.optional(Schema.String),
  rate: Schema.optionalWith(Schema.Number, { default: () => 1.0 }),
});

export const HideLMSUI = Schema.Struct({
  previous: Schema.optional(Schema.Boolean),
  continue: Schema.optional(Schema.Boolean),
  exit: Schema.optional(Schema.Boolean),
  exitAll: Schema.optional(Schema.Boolean),
  abandon: Schema.optional(Schema.Boolean),
  abandonAll: Schema.optional(Schema.Boolean),
  suspendAll: Schema.optional(Schema.Boolean),
});

// Item is recursive (items can contain items)
export interface ItemInput {
  id: string;
  title: string;
  isVisible?: boolean;
  parameters?: string;
  hideLmsUi?: typeof HideLMSUI.Type;
  items?: ItemInput[];
  content?: string[];
  assessmentRef?: string;
  sequencing?: typeof ItemSequencing.Type;
}

export const Item: Schema.Schema<ItemInput, ItemInput> = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  isVisible: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  parameters: Schema.optional(Schema.String),
  hideLmsUi: Schema.optional(HideLMSUI),
  items: Schema.optional(Schema.Array(Schema.suspend(() => Item))),
  content: Schema.optional(Schema.Array(Schema.String)),
  assessmentRef: Schema.optional(Schema.String),
  sequencing: Schema.optional(ItemSequencing),
}) as any;
export type Item = ItemInput;

export const Organization = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  items: Schema.Array(Item),
  sequencing: Schema.optional(ItemSequencing),
});
export type Organization = typeof Organization.Type;

export const GlobalSequencing = Schema.Struct({
  sharedObjectives: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        satisfiedByMeasure: Schema.optional(Schema.Boolean),
        minNormalizedMeasure: Schema.optional(Schema.Number),
      })
    )
  ),
});

export const Manifest = Schema.Struct({
  corm: Schema.Literal("1.0"),
  id: Schema.String,
  version: Schema.String,
  scormSource: ScormVersion,
  metadata: LOMMetadata,
  style: Schema.optional(Schema.String),
  tts: Schema.optional(TTSConfig),
  sequencing: Schema.optional(GlobalSequencing),
  organizations: Schema.Array(Organization),
});
export type Manifest = typeof Manifest.Type;
```

Create `packages/schema/src/package.ts`:

```typescript
import { Schema } from "effect";
import { Manifest } from "./manifest.ts";
import { Slide } from "./slide.ts";
import { Assessment } from "./assessment.ts";
import { Checksums } from "./checksums.ts";
import { AssetEntry } from "./asset.ts";

export const CormModule = Schema.Struct({
  id: Schema.String,
  slides: Schema.Array(Slide),
  assessments: Schema.optionalWith(Schema.Array(Assessment), { default: () => [] }),
});
export type CormModule = typeof CormModule.Type;

export const StylePackage = Schema.Struct({
  id: Schema.String,
  version: Schema.String,
  templates: Schema.Record({ key: Schema.String, value: Schema.String }),
  variables: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});
export type StylePackage = typeof StylePackage.Type;

export const CormPackage = Schema.Struct({
  manifest: Manifest,
  modules: Schema.Array(CormModule),
  styles: Schema.optional(StylePackage),
  assets: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: AssetEntry }),
    { default: () => ({}) }
  ),
  checksums: Checksums,
});
export type CormPackage = typeof CormPackage.Type;
```

Update `packages/schema/src/mod.ts`:

```typescript
export * from "./sequencing.ts";
export * from "./assessment.ts";
export * from "./metadata.ts";
export * from "./slide.ts";
export * from "./asset.ts";
export * from "./checksums.ts";
export * from "./manifest.ts";
export * from "./package.ts";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test packages/schema/tests/`
Expected: All tests PASS (sequencing + assessment + manifest)

- [ ] **Step 5: Commit**

```bash
git add packages/schema/
git commit -m "feat(schema): add manifest, metadata, slide, asset, package types — complete CORM schema"
```

---

### Task 5: Content-Addressable Store

**Files:**
- Create: `packages/content-store/src/hash.ts`
- Create: `packages/content-store/src/store.ts`
- Create: `packages/content-store/src/checksums.ts`
- Create: `packages/content-store/src/mod.ts`
- Test: `packages/content-store/tests/hash.test.ts`
- Test: `packages/content-store/tests/store.test.ts`
- Test: `packages/content-store/tests/checksums.test.ts`

- [ ] **Step 1: Write the failing test for hash**

Create `packages/content-store/tests/hash.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { sha256 } from "../src/hash.ts";

describe("sha256", () => {
  it("hashes a string deterministically", () => {
    const result = Effect.runSync(sha256(new TextEncoder().encode("hello")));
    expect(result).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("produces different hashes for different inputs", () => {
    const a = Effect.runSync(sha256(new TextEncoder().encode("hello")));
    const b = Effect.runSync(sha256(new TextEncoder().encode("world")));
    expect(a).not.toBe(b);
  });

  it("produces same hash for same content", () => {
    const content = new TextEncoder().encode("same content");
    const a = Effect.runSync(sha256(content));
    const b = Effect.runSync(sha256(content));
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test packages/content-store/tests/hash.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the hash utility**

Create `packages/content-store/src/hash.ts`:

```typescript
import { Effect } from "effect";

export const sha256 = (data: Uint8Array): Effect.Effect<string> =>
  Effect.promise(async () => {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test packages/content-store/tests/hash.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for store**

Create `packages/content-store/tests/store.test.ts`:

```typescript
import { describe, it, afterEach } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { ContentStore, ContentStoreLive } from "../src/store.ts";

describe("ContentStore", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    }
  });

  it("stores content and retrieves by hash", async () => {
    tmpDir = await Deno.makeTempDir();
    const content = new TextEncoder().encode("test content");

    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const hash = yield* store.put(content);
      const retrieved = yield* store.get(hash);
      return { hash, retrieved };
    });

    const layer = ContentStoreLive(tmpDir);
    const { hash, retrieved } = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(retrieved).toEqual(content);
  });

  it("deduplicates identical content", async () => {
    tmpDir = await Deno.makeTempDir();
    const content = new TextEncoder().encode("duplicate me");

    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const hash1 = yield* store.put(content);
      const hash2 = yield* store.put(content);
      return { hash1, hash2 };
    });

    const layer = ContentStoreLive(tmpDir);
    const { hash1, hash2 } = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(hash1).toBe(hash2);
  });

  it("reports whether a hash exists", async () => {
    tmpDir = await Deno.makeTempDir();
    const content = new TextEncoder().encode("check me");

    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const before = yield* store.has("nonexistent");
      const hash = yield* store.put(content);
      const after = yield* store.has(hash);
      return { before, after };
    });

    const layer = ContentStoreLive(tmpDir);
    const { before, after } = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(before).toBe(false);
    expect(after).toBe(true);
  });
});
```

- [ ] **Step 6: Write the ContentStore service**

Create `packages/content-store/src/store.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import { sha256 } from "./hash.ts";

export class ContentStore extends Context.Tag("ContentStore")<
  ContentStore,
  {
    readonly put: (data: Uint8Array) => Effect.Effect<string>;
    readonly get: (hash: string) => Effect.Effect<Uint8Array>;
    readonly has: (hash: string) => Effect.Effect<boolean>;
    readonly list: () => Effect.Effect<string[]>;
  }
>() {}

export const ContentStoreLive = (baseDir: string) =>
  Layer.succeed(ContentStore, {
    put: (data: Uint8Array) =>
      Effect.gen(function* () {
        const hash = yield* sha256(data);
        const dir = `${baseDir}/${hash.slice(0, 2)}`;
        const path = `${dir}/${hash}`;

        yield* Effect.promise(() => Deno.mkdir(dir, { recursive: true }));
        yield* Effect.promise(() => Deno.writeFile(path, data));
        return hash;
      }),

    get: (hash: string) =>
      Effect.promise(() => {
        const path = `${baseDir}/${hash.slice(0, 2)}/${hash}`;
        return Deno.readFile(path);
      }),

    has: (hash: string) =>
      Effect.promise(async () => {
        try {
          const path = `${baseDir}/${hash.slice(0, 2)}/${hash}`;
          await Deno.stat(path);
          return true;
        } catch {
          return false;
        }
      }),

    list: () =>
      Effect.promise(async () => {
        const hashes: string[] = [];
        for await (const entry of Deno.readDir(baseDir)) {
          if (entry.isDirectory) {
            for await (const file of Deno.readDir(`${baseDir}/${entry.name}`)) {
              if (file.isFile) hashes.push(file.name);
            }
          }
        }
        return hashes;
      }),
  });
```

- [ ] **Step 7: Run test to verify it passes**

Run: `deno test --allow-read --allow-write packages/content-store/tests/store.test.ts`
Expected: PASS

- [ ] **Step 8: Write the failing test for checksums**

Create `packages/content-store/tests/checksums.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { computeChecksums, diffChecksums } from "../src/checksums.ts";

describe("computeChecksums", () => {
  it("computes checksums for a file map", () => {
    const files = new Map<string, Uint8Array>([
      ["manifest.yaml", new TextEncoder().encode("corm: 1.0")],
      ["content/slide-001.md", new TextEncoder().encode("# Hello")],
    ]);

    const result = Effect.runSync(computeChecksums(files, "1.0.0"));
    expect(result.version).toBe("1.0.0");
    expect(Object.keys(result.files)).toHaveLength(2);
    expect(result.files["manifest.yaml"]).toHaveLength(64);
  });
});

describe("diffChecksums", () => {
  it("identifies added, changed, and removed files", () => {
    const old_ = {
      version: "1.0.0",
      files: {
        "a.md": "hash_a",
        "b.md": "hash_b",
        "c.md": "hash_c",
      },
    };
    const new_ = {
      version: "1.1.0",
      previousVersion: "1.0.0",
      files: {
        "a.md": "hash_a",      // unchanged
        "b.md": "hash_b_new",  // changed
        "d.md": "hash_d",      // added
        // c.md removed
      },
    };

    const diff = diffChecksums(old_, new_);
    expect(diff.added).toEqual(["d.md"]);
    expect(diff.changed).toEqual(["b.md"]);
    expect(diff.removed).toEqual(["c.md"]);
    expect(diff.unchanged).toEqual(["a.md"]);
  });
});
```

- [ ] **Step 9: Write the checksums utility**

Create `packages/content-store/src/checksums.ts`:

```typescript
import { Effect } from "effect";
import type { Checksums } from "@corm/schema";
import { sha256 } from "./hash.ts";

export const computeChecksums = (
  files: Map<string, Uint8Array>,
  version: string,
  previousVersion?: string
): Effect.Effect<Checksums> =>
  Effect.gen(function* () {
    const entries: Record<string, string> = {};
    for (const [path, data] of files) {
      entries[path] = yield* sha256(data);
    }
    return {
      version,
      previousVersion,
      files: entries,
    };
  });

export interface ChecksumDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}

export const diffChecksums = (
  old_: Checksums,
  new_: Checksums
): ChecksumDiff => {
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const [path, hash] of Object.entries(new_.files)) {
    if (!(path in old_.files)) {
      added.push(path);
    } else if (old_.files[path] !== hash) {
      changed.push(path);
    } else {
      unchanged.push(path);
    }
  }

  const removed = Object.keys(old_.files).filter(
    (path) => !(path in new_.files)
  );

  return { added, changed, removed, unchanged };
};
```

Update `packages/content-store/src/mod.ts`:

```typescript
export { sha256 } from "./hash.ts";
export { ContentStore, ContentStoreLive } from "./store.ts";
export { computeChecksums, diffChecksums, type ChecksumDiff } from "./checksums.ts";
```

- [ ] **Step 10: Run all content-store tests**

Run: `deno test --allow-read --allow-write packages/content-store/tests/`
Expected: All PASS

- [ ] **Step 11: Commit**

```bash
git add packages/content-store/
git commit -m "feat(content-store): content-addressable store with SHA-256, dedup, and checksum diffing"
```

---

### Task 6: Asset Processor

**Files:**
- Create: `packages/asset-processor/src/image.ts`
- Create: `packages/asset-processor/src/transcript.ts`
- Create: `packages/asset-processor/src/processor.ts`
- Create: `packages/asset-processor/src/mod.ts`
- Test: `packages/asset-processor/tests/image.test.ts`
- Test: `packages/asset-processor/tests/transcript.test.ts`

- [ ] **Step 1: Write the failing test for image processing**

Create `packages/asset-processor/tests/image.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { ImageProcessor, ImageProcessorLive } from "../src/image.ts";

describe("ImageProcessor", () => {
  it("compresses a PNG to WebP under the size limit", async () => {
    // Create a minimal 1x1 red PNG (67 bytes)
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
      0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const program = Effect.gen(function* () {
      const processor = yield* ImageProcessor;
      const result = yield* processor.toWebP(png, { maxBytes: 128 * 1024 });
      return result;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(ImageProcessorLive))
    );

    expect(result.data.length).toBeLessThanOrEqual(128 * 1024);
    expect(result.mimeType).toBe("image/webp");
  });

  it("reports original and compressed sizes", async () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
      0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const program = Effect.gen(function* () {
      const processor = yield* ImageProcessor;
      return yield* processor.toWebP(png, { maxBytes: 128 * 1024 });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(ImageProcessorLive))
    );

    expect(result.originalSize).toBe(png.length);
    expect(result.compressedSize).toBe(result.data.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test packages/asset-processor/tests/image.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the ImageProcessor service**

Create `packages/asset-processor/src/image.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import sharp from "sharp";

export interface WebPResult {
  data: Uint8Array;
  mimeType: "image/webp";
  originalSize: number;
  compressedSize: number;
  quality: number;
}

export interface WebPOptions {
  maxBytes: number;
  initialQuality?: number;
  minQuality?: number;
}

export class ImageProcessor extends Context.Tag("ImageProcessor")<
  ImageProcessor,
  {
    readonly toWebP: (
      input: Uint8Array,
      options: WebPOptions
    ) => Effect.Effect<WebPResult>;
  }
>() {}

export const ImageProcessorLive = Layer.succeed(ImageProcessor, {
  toWebP: (input: Uint8Array, options: WebPOptions) =>
    Effect.gen(function* () {
      const maxBytes = options.maxBytes;
      let quality = options.initialQuality ?? 80;
      const minQuality = options.minQuality ?? 10;

      let result: Uint8Array;

      // Binary search for quality that fits under maxBytes
      while (quality >= minQuality) {
        const buffer = yield* Effect.promise(() =>
          sharp(input).webp({ quality }).toBuffer()
        );
        result = new Uint8Array(buffer);

        if (result.length <= maxBytes) {
          return {
            data: result,
            mimeType: "image/webp" as const,
            originalSize: input.length,
            compressedSize: result.length,
            quality,
          };
        }

        quality -= 10;
      }

      // Last resort: resize down
      const buffer = yield* Effect.promise(() =>
        sharp(input)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: minQuality })
          .toBuffer()
      );
      result = new Uint8Array(buffer);

      return {
        data: result,
        mimeType: "image/webp" as const,
        originalSize: input.length,
        compressedSize: result.length,
        quality: minQuality,
      };
    }),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --allow-read --allow-write --allow-ffi packages/asset-processor/tests/image.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for transcript**

Create `packages/asset-processor/tests/transcript.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import {
  TranscriptExtractor,
  TranscriptExtractorLive,
} from "../src/transcript.ts";

describe("TranscriptExtractor", () => {
  it("extracts transcript from plain text", () => {
    const text = "Welcome to fire safety training.";

    const program = Effect.gen(function* () {
      const extractor = yield* TranscriptExtractor;
      return yield* extractor.fromText(text);
    });

    const result = Effect.runSync(
      program.pipe(Effect.provide(TranscriptExtractorLive))
    );

    expect(result.text).toBe(text);
    expect(result.format).toBe("plain");
  });

  it("detects SSML format", () => {
    const ssml = '<speak>Welcome to <emphasis>fire safety</emphasis> training.</speak>';

    const program = Effect.gen(function* () {
      const extractor = yield* TranscriptExtractor;
      return yield* extractor.fromText(ssml);
    });

    const result = Effect.runSync(
      program.pipe(Effect.provide(TranscriptExtractorLive))
    );

    expect(result.format).toBe("ssml");
  });

  it("estimates byte size", () => {
    const text = "Hello world";

    const program = Effect.gen(function* () {
      const extractor = yield* TranscriptExtractor;
      return yield* extractor.fromText(text);
    });

    const result = Effect.runSync(
      program.pipe(Effect.provide(TranscriptExtractorLive))
    );

    expect(result.byteSize).toBe(new TextEncoder().encode(text).length);
  });
});
```

- [ ] **Step 6: Write the TranscriptExtractor service**

Create `packages/asset-processor/src/transcript.ts`:

```typescript
import { Context, Effect, Layer } from "effect";

export interface Transcript {
  text: string;
  format: "plain" | "ssml";
  byteSize: number;
}

export class TranscriptExtractor extends Context.Tag("TranscriptExtractor")<
  TranscriptExtractor,
  {
    readonly fromText: (text: string) => Effect.Effect<Transcript>;
  }
>() {}

export const TranscriptExtractorLive = Layer.succeed(TranscriptExtractor, {
  fromText: (text: string) =>
    Effect.sync(() => {
      const format = text.trim().startsWith("<speak") ? "ssml" : "plain";
      const byteSize = new TextEncoder().encode(text).length;
      return { text, format, byteSize } as Transcript;
    }),
});
```

Create `packages/asset-processor/src/processor.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import { ImageProcessor, ImageProcessorLive } from "./image.ts";
import {
  TranscriptExtractor,
  TranscriptExtractorLive,
} from "./transcript.ts";

// AssetProcessor is a convenience layer combining image + transcript
export const AssetProcessorLive = Layer.merge(
  ImageProcessorLive,
  TranscriptExtractorLive
);
```

Update `packages/asset-processor/src/mod.ts`:

```typescript
export {
  ImageProcessor,
  ImageProcessorLive,
  type WebPResult,
  type WebPOptions,
} from "./image.ts";
export {
  TranscriptExtractor,
  TranscriptExtractorLive,
  type Transcript,
} from "./transcript.ts";
export { AssetProcessorLive } from "./processor.ts";
```

- [ ] **Step 7: Run all asset-processor tests**

Run: `deno test --allow-read --allow-write --allow-ffi packages/asset-processor/tests/`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add packages/asset-processor/
git commit -m "feat(asset-processor): image→WebP compression with size budget and transcript extraction"
```

---

### Task 7: SCORM Parser — Version Detection & Manifest Parsing

**Files:**
- Create: `packages/scorm-parser/src/errors.ts`
- Create: `packages/scorm-parser/src/version-detect.ts`
- Create: `packages/scorm-parser/src/manifest-xml.ts`
- Create: `packages/scorm-parser/src/sequencing-xml.ts`
- Create: `packages/scorm-parser/src/metadata-xml.ts`
- Create: `packages/scorm-parser/src/parser.ts`
- Create: `packages/scorm-parser/src/mod.ts`
- Create: `fixtures/minimal-scorm12/imsmanifest.xml`
- Create: `fixtures/minimal-scorm2004/imsmanifest.xml`
- Test: `packages/scorm-parser/tests/version-detect.test.ts`
- Test: `packages/scorm-parser/tests/manifest-xml.test.ts`
- Test: `packages/scorm-parser/tests/parser.test.ts`

- [ ] **Step 1: Create minimal SCORM test fixtures**

Create `fixtures/minimal-scorm12/imsmanifest.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.fire-safety-12" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org-default">
    <organization identifier="org-default">
      <title>Fire Safety Training</title>
      <item identifier="item-01" identifierref="res-01">
        <title>Introduction</title>
      </item>
      <item identifier="item-02" identifierref="res-02">
        <title>Fire Types</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-01" type="webcontent" adlcp:scormtype="sco" href="content/intro.html">
      <file href="content/intro.html"/>
    </resource>
    <resource identifier="res-02" type="webcontent" adlcp:scormtype="sco" href="content/fire-types.html">
      <file href="content/fire-types.html"/>
    </resource>
  </resources>
</manifest>
```

Create `fixtures/minimal-scorm2004/imsmanifest.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.fire-safety-2004" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org-default">
    <organization identifier="org-default">
      <title>Fire Safety Training</title>
      <item identifier="item-01" identifierref="res-01">
        <title>Introduction</title>
        <imsss:sequencing>
          <imsss:controlMode choice="true" flow="true"/>
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="obj-intro" satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>0.8</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>
      </item>
      <item identifier="item-02" identifierref="res-02">
        <title>Fire Types</title>
        <imsss:sequencing>
          <imsss:controlMode choice="true" flow="true" forwardOnly="true"/>
          <imsss:sequencingRules>
            <imsss:preConditionRule>
              <imsss:ruleConditions conditionCombination="all">
                <imsss:ruleCondition referencedObjective="obj-intro" condition="satisfied"/>
              </imsss:ruleConditions>
              <imsss:ruleAction action="disabled"/>
            </imsss:preConditionRule>
          </imsss:sequencingRules>
          <imsss:rollupRules>
            <imsss:rollupRule childActivitySet="all">
              <imsss:rollupConditions>
                <imsss:rollupCondition condition="satisfied"/>
              </imsss:rollupConditions>
              <imsss:rollupAction action="satisfied"/>
            </imsss:rollupRule>
          </imsss:rollupRules>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-01" type="webcontent" adlcp:scormType="sco" href="content/intro.html">
      <file href="content/intro.html"/>
    </resource>
    <resource identifier="res-02" type="webcontent" adlcp:scormType="sco" href="content/fire-types.html">
      <file href="content/fire-types.html"/>
    </resource>
  </resources>
</manifest>
```

- [ ] **Step 2: Write typed errors**

Create `packages/scorm-parser/src/errors.ts`:

```typescript
import { Data } from "effect";

export class ScormParseError extends Data.TaggedError("ScormParseError")<{
  message: string;
  path?: string;
}> {}

export class ScormManifestNotFound extends Data.TaggedError("ScormManifestNotFound")<{
  message: string;
}> {}

export class ScormVersionUnsupported extends Data.TaggedError("ScormVersionUnsupported")<{
  version: string;
  message: string;
}> {}

export class ScormSequencingError extends Data.TaggedError("ScormSequencingError")<{
  message: string;
  itemId?: string;
}> {}
```

- [ ] **Step 3: Write the failing test for version detection**

Create `packages/scorm-parser/tests/version-detect.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { detectScormVersion } from "../src/version-detect.ts";

describe("detectScormVersion", () => {
  it("detects SCORM 1.2 from schemaversion", () => {
    const xml = `<?xml version="1.0"?>
      <manifest xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2">
        <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
      </manifest>`;
    const result = Effect.runSync(detectScormVersion(xml));
    expect(result).toBe("1.2");
  });

  it("detects SCORM 2004 4th Edition", () => {
    const xml = `<?xml version="1.0"?>
      <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
        <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
      </manifest>`;
    const result = Effect.runSync(detectScormVersion(xml));
    expect(result).toBe("2004-4th");
  });

  it("detects SCORM 2004 3rd Edition", () => {
    const xml = `<?xml version="1.0"?>
      <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
        <metadata><schema>ADL SCORM</schema><schemaversion>2004 3rd Edition</schemaversion></metadata>
      </manifest>`;
    const result = Effect.runSync(detectScormVersion(xml));
    expect(result).toBe("2004-3rd");
  });

  it("fails on unknown version", () => {
    const xml = `<?xml version="1.0"?>
      <manifest><metadata><schemaversion>9.9</schemaversion></metadata></manifest>`;
    expect(() => Effect.runSync(detectScormVersion(xml))).toThrow();
  });
});
```

- [ ] **Step 4: Write the version detection module**

Create `packages/scorm-parser/src/version-detect.ts`:

```typescript
import { Effect } from "effect";
import type { ScormVersion } from "@corm/schema";
import { ScormVersionUnsupported } from "./errors.ts";

const VERSION_MAP: Record<string, ScormVersion> = {
  "1.2": "1.2",
  "2004 2nd edition": "2004-2nd",
  "2004 3rd edition": "2004-3rd",
  "2004 4th edition": "2004-4th",
  // Common variations
  "cam 1.3": "2004-3rd",
  "2004 4th ed": "2004-4th",
};

export const detectScormVersion = (
  manifestXml: string
): Effect.Effect<ScormVersion, ScormVersionUnsupported> =>
  Effect.gen(function* () {
    const match = manifestXml.match(
      /<schemaversion>\s*(.*?)\s*<\/schemaversion>/i
    );

    if (!match) {
      return yield* Effect.fail(
        new ScormVersionUnsupported({
          version: "unknown",
          message: "No <schemaversion> element found in manifest",
        })
      );
    }

    const raw = match[1].toLowerCase().trim();
    const version = VERSION_MAP[raw];

    if (!version) {
      // Try namespace-based detection as fallback
      if (manifestXml.includes("imscp_rootv1p1p2")) {
        return "1.2" as ScormVersion;
      }
      if (manifestXml.includes("imscp_v1p1")) {
        return "2004-4th" as ScormVersion; // default to latest 2004
      }

      return yield* Effect.fail(
        new ScormVersionUnsupported({
          version: raw,
          message: `Unsupported SCORM version: "${raw}"`,
        })
      );
    }

    return version;
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test packages/scorm-parser/tests/version-detect.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add fixtures/ packages/scorm-parser/src/errors.ts packages/scorm-parser/src/version-detect.ts packages/scorm-parser/tests/version-detect.test.ts
git commit -m "feat(scorm-parser): SCORM version detection with test fixtures"
```

- [ ] **Step 7: Write manifest XML parser and sequencing XML parser**

These are larger modules. The manifest parser uses the DOMParser API (available in Deno) to parse imsmanifest.xml and extract organizations, items, and resources. The sequencing parser extracts `<imsss:sequencing>` blocks into the CORM sequencing types.

Create `packages/scorm-parser/src/manifest-xml.ts`:

```typescript
import { Effect } from "effect";
import { DOMParser } from "jsr:@nicolo-ribaudo/deno-dom";
import type { Organization, Item, ScormVersion } from "@corm/schema";
import { ScormParseError } from "./errors.ts";
import { parseItemSequencing } from "./sequencing-xml.ts";

const parser = new DOMParser();

export interface ParsedManifest {
  identifier: string;
  version: ScormVersion;
  title: string;
  organizations: Organization[];
  resources: Map<string, { href: string; files: string[] }>;
}

const parseItem = (
  element: Element,
  resources: Map<string, { href: string; files: string[] }>
): Item => {
  const id = element.getAttribute("identifier") ?? "";
  const title =
    element.querySelector("title")?.textContent?.trim() ?? "Untitled";
  const isVisible = element.getAttribute("isvisible") !== "false";
  const parameters = element.getAttribute("parameters") ?? undefined;
  const identifierref = element.getAttribute("identifierref") ?? undefined;

  // Parse child items (recursive)
  const childItems: Item[] = [];
  for (const child of element.children) {
    if (child.tagName === "item") {
      childItems.push(parseItem(child, resources));
    }
  }

  // Parse sequencing if present
  const seqElement = element.querySelector("sequencing");
  const sequencing = seqElement ? parseItemSequencing(seqElement) : undefined;

  // Resolve content references
  const content: string[] = [];
  if (identifierref && resources.has(identifierref)) {
    content.push(resources.get(identifierref)!.href);
  }

  return {
    id,
    title,
    isVisible,
    parameters,
    items: childItems.length > 0 ? childItems : undefined,
    content: content.length > 0 ? content : undefined,
    sequencing,
  };
};

export const parseManifestXml = (
  xml: string,
  detectedVersion: ScormVersion
): Effect.Effect<ParsedManifest, ScormParseError> =>
  Effect.gen(function* () {
    const doc = parser.parseFromString(xml, "text/xml");
    if (!doc) {
      return yield* Effect.fail(
        new ScormParseError({ message: "Failed to parse XML document" })
      );
    }

    const manifest = doc.documentElement;
    if (!manifest || manifest.tagName !== "manifest") {
      return yield* Effect.fail(
        new ScormParseError({ message: "Root element is not <manifest>" })
      );
    }

    const identifier = manifest.getAttribute("identifier") ?? "";

    // Parse resources
    const resources = new Map<string, { href: string; files: string[] }>();
    for (const res of manifest.querySelectorAll("resources > resource")) {
      const resId = res.getAttribute("identifier") ?? "";
      const href = res.getAttribute("href") ?? "";
      const files: string[] = [];
      for (const file of res.querySelectorAll("file")) {
        const fileHref = file.getAttribute("href");
        if (fileHref) files.push(fileHref);
      }
      resources.set(resId, { href, files });
    }

    // Parse organizations
    const organizations: Organization[] = [];
    for (const org of manifest.querySelectorAll(
      "organizations > organization"
    )) {
      const orgId = org.getAttribute("identifier") ?? "";
      const orgTitle =
        org.querySelector("title")?.textContent?.trim() ?? "Untitled";

      const items: Item[] = [];
      for (const child of org.children) {
        if (child.tagName === "item") {
          items.push(parseItem(child, resources));
        }
      }

      organizations.push({ id: orgId, title: orgTitle, items });
    }

    const title = organizations[0]?.title ?? "Untitled Course";

    return {
      identifier,
      version: detectedVersion,
      title,
      organizations,
      resources,
    };
  });
```

Create `packages/scorm-parser/src/sequencing-xml.ts`:

```typescript
import type { ItemSequencing, SequencingRule, Objective, RollupRule } from "@corm/schema";

const parseBool = (val: string | null, defaultVal: boolean): boolean => {
  if (val === null) return defaultVal;
  return val.toLowerCase() === "true";
};

const parseConditions = (element: Element): SequencingRule["conditions"] => {
  const operator = element.getAttribute("conditionCombination") === "any" ? "any" : "all";
  const rules: Array<{
    condition: string;
    refObjective?: string;
    measureThreshold?: number;
    operator?: "not";
  }> = [];

  for (const cond of element.querySelectorAll("ruleCondition")) {
    rules.push({
      condition: cond.getAttribute("condition") ?? "always",
      refObjective: cond.getAttribute("referencedObjective") ?? undefined,
      measureThreshold: cond.hasAttribute("measureThreshold")
        ? parseFloat(cond.getAttribute("measureThreshold")!)
        : undefined,
      operator: cond.getAttribute("operator") === "not" ? "not" : undefined,
    });
  }

  return { operator: operator as "all" | "any", rules: rules as any };
};

const parseSequencingRules = (
  container: Element,
  ruleTag: string,
  conditionsTag: string,
  actionTag: string
): SequencingRule[] => {
  const rules: SequencingRule[] = [];
  for (const rule of container.querySelectorAll(ruleTag)) {
    const conditionsEl = rule.querySelector(conditionsTag);
    const actionEl = rule.querySelector(actionTag);
    if (conditionsEl && actionEl) {
      rules.push({
        action: actionEl.getAttribute("action") ?? "",
        conditions: parseConditions(conditionsEl),
      });
    }
  }
  return rules;
};

export const parseItemSequencing = (element: Element): ItemSequencing => {
  // Control mode
  const controlModeEl = element.querySelector("controlMode");
  const controlMode = controlModeEl
    ? {
        choice: parseBool(controlModeEl.getAttribute("choice"), true),
        choiceExit: parseBool(controlModeEl.getAttribute("choiceExit"), true),
        flow: parseBool(controlModeEl.getAttribute("flow"), false),
        forwardOnly: parseBool(controlModeEl.getAttribute("forwardOnly"), false),
        useCurrentAttemptObjectiveInfo: parseBool(
          controlModeEl.getAttribute("useCurrentAttemptObjectiveInfo"),
          true
        ),
        useCurrentAttemptProgressInfo: parseBool(
          controlModeEl.getAttribute("useCurrentAttemptProgressInfo"),
          true
        ),
      }
    : undefined;

  // Sequencing rules
  const rulesEl = element.querySelector("sequencingRules");
  const preconditions = rulesEl
    ? parseSequencingRules(rulesEl, "preConditionRule", "ruleConditions", "ruleAction")
    : [];
  const postconditions = rulesEl
    ? parseSequencingRules(rulesEl, "postConditionRule", "ruleConditions", "ruleAction")
    : [];
  const exitConditions = rulesEl
    ? parseSequencingRules(rulesEl, "exitConditionRule", "ruleConditions", "ruleAction")
    : [];

  // Objectives
  const objectivesEl = element.querySelector("objectives");
  const objectives: Objective[] = [];
  if (objectivesEl) {
    const primary = objectivesEl.querySelector("primaryObjective");
    if (primary) {
      const minMeasure = primary.querySelector("minNormalizedMeasure");
      objectives.push({
        id: primary.getAttribute("objectiveID") ?? "primary",
        primary: true,
        satisfiedByMeasure: parseBool(primary.getAttribute("satisfiedByMeasure"), false),
        minNormalizedMeasure: minMeasure
          ? parseFloat(minMeasure.textContent ?? "1.0")
          : 1.0,
        maps: parseObjectiveMaps(primary),
      });
    }
    for (const obj of objectivesEl.querySelectorAll("objective")) {
      const minMeasure = obj.querySelector("minNormalizedMeasure");
      objectives.push({
        id: obj.getAttribute("objectiveID") ?? "",
        primary: false,
        satisfiedByMeasure: parseBool(obj.getAttribute("satisfiedByMeasure"), false),
        minNormalizedMeasure: minMeasure
          ? parseFloat(minMeasure.textContent ?? "1.0")
          : 1.0,
        maps: parseObjectiveMaps(obj),
      });
    }
  }

  // Rollup rules
  const rollupRulesEl = element.querySelector("rollupRules");
  const rollupRules: RollupRule[] = [];
  if (rollupRulesEl) {
    for (const rr of rollupRulesEl.querySelectorAll("rollupRule")) {
      const conditionsEl = rr.querySelector("rollupConditions");
      const conditions: Array<{ condition: string; operator?: "not" }> = [];
      if (conditionsEl) {
        for (const rc of conditionsEl.querySelectorAll("rollupCondition")) {
          conditions.push({
            condition: rc.getAttribute("condition") ?? "",
            operator: rc.getAttribute("operator") === "not" ? "not" : undefined,
          });
        }
      }
      const actionEl = rr.querySelector("rollupAction");
      rollupRules.push({
        childActivitySet: (rr.getAttribute("childActivitySet") ?? "all") as any,
        conditions: conditions as any,
        action: (actionEl?.getAttribute("action") ?? "satisfied") as any,
      });
    }
  }

  // Delivery controls
  const deliveryEl = element.querySelector("deliveryControls");
  const deliveryControls = deliveryEl
    ? {
        tracked: parseBool(deliveryEl.getAttribute("tracked"), true),
        completionSetByContent: parseBool(
          deliveryEl.getAttribute("completionSetByContent"),
          false
        ),
        objectiveSetByContent: parseBool(
          deliveryEl.getAttribute("objectiveSetByContent"),
          false
        ),
      }
    : undefined;

  // Limit conditions
  const limitEl = element.querySelector("limitConditions");
  const limitConditions = limitEl
    ? {
        attemptLimit: limitEl.hasAttribute("attemptLimit")
          ? parseInt(limitEl.getAttribute("attemptLimit")!)
          : undefined,
        attemptAbsoluteDurationLimit:
          limitEl.getAttribute("attemptAbsoluteDurationLimit") ?? undefined,
      }
    : undefined;

  return {
    controlMode: controlMode ?? {
      choice: true,
      choiceExit: true,
      flow: false,
      forwardOnly: false,
      useCurrentAttemptObjectiveInfo: true,
      useCurrentAttemptProgressInfo: true,
    },
    constrainChoice: false,
    preventActivation: false,
    preconditions,
    postconditions,
    exitConditions,
    objectives,
    rollupRules,
    limitConditions,
    deliveryControls: deliveryControls ?? {
      tracked: true,
      completionSetByContent: false,
      objectiveSetByContent: false,
    },
  };
};

const parseObjectiveMaps = (
  objElement: Element
): Array<{
  target: string;
  readSatisfied: boolean;
  readNormalizedMeasure: boolean;
  writeSatisfied: boolean;
  writeNormalizedMeasure: boolean;
}> => {
  const maps: Array<{
    target: string;
    readSatisfied: boolean;
    readNormalizedMeasure: boolean;
    writeSatisfied: boolean;
    writeNormalizedMeasure: boolean;
  }> = [];
  for (const map of objElement.querySelectorAll("mapInfo")) {
    maps.push({
      target: map.getAttribute("targetObjectiveID") ?? "",
      readSatisfied: parseBool(map.getAttribute("readSatisfiedStatus"), true),
      readNormalizedMeasure: parseBool(
        map.getAttribute("readNormalizedMeasure"),
        true
      ),
      writeSatisfied: parseBool(map.getAttribute("writeSatisfiedStatus"), false),
      writeNormalizedMeasure: parseBool(
        map.getAttribute("writeNormalizedMeasure"),
        false
      ),
    });
  }
  return maps;
};
```

Create `packages/scorm-parser/src/metadata-xml.ts`:

```typescript
import type { LOMMetadata } from "@corm/schema";

export const parseMetadataXml = (manifestElement: Element): LOMMetadata => {
  const metaEl = manifestElement.querySelector("metadata");
  const title =
    manifestElement
      .querySelector("organizations > organization > title")
      ?.textContent?.trim() ?? "Untitled";

  // Extract LOM metadata if present
  const lomEl = metaEl?.querySelector("lom");
  if (!lomEl) {
    return { title };
  }

  const description =
    lomEl.querySelector("general > description > string")?.textContent?.trim() ??
    undefined;
  const language =
    lomEl.querySelector("general > language")?.textContent?.trim() ?? undefined;

  const keywords: string[] = [];
  for (const kw of lomEl.querySelectorAll("general > keyword > string")) {
    const text = kw.textContent?.trim();
    if (text) keywords.push(text);
  }

  return {
    title,
    description,
    language,
    keywords: keywords.length > 0 ? keywords : undefined,
  };
};
```

- [ ] **Step 8: Write the failing test for manifest parsing**

Create `packages/scorm-parser/tests/manifest-xml.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { parseManifestXml } from "../src/manifest-xml.ts";

const SCORM_12_MANIFEST = await Deno.readTextFile(
  "fixtures/minimal-scorm12/imsmanifest.xml"
);

const SCORM_2004_MANIFEST = await Deno.readTextFile(
  "fixtures/minimal-scorm2004/imsmanifest.xml"
);

describe("parseManifestXml", () => {
  it("parses a SCORM 1.2 manifest", async () => {
    const result = await Effect.runPromise(
      parseManifestXml(SCORM_12_MANIFEST, "1.2")
    );

    expect(result.identifier).toBe("com.example.fire-safety-12");
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0].id).toBe("org-default");
    expect(result.organizations[0].items).toHaveLength(2);
    expect(result.organizations[0].items[0].title).toBe("Introduction");
    expect(result.resources.size).toBe(2);
  });

  it("parses a SCORM 2004 manifest with sequencing", async () => {
    const result = await Effect.runPromise(
      parseManifestXml(SCORM_2004_MANIFEST, "2004-4th")
    );

    expect(result.identifier).toBe("com.example.fire-safety-2004");
    expect(result.organizations).toHaveLength(1);

    const item1 = result.organizations[0].items[0];
    expect(item1.title).toBe("Introduction");
    expect(item1.sequencing).toBeDefined();
    expect(item1.sequencing!.controlMode.choice).toBe(true);
    expect(item1.sequencing!.controlMode.flow).toBe(true);
    expect(item1.sequencing!.objectives).toHaveLength(1);
    expect(item1.sequencing!.objectives[0].id).toBe("obj-intro");
    expect(item1.sequencing!.objectives[0].minNormalizedMeasure).toBe(0.8);

    const item2 = result.organizations[0].items[1];
    expect(item2.sequencing!.controlMode.forwardOnly).toBe(true);
    expect(item2.sequencing!.preconditions).toHaveLength(1);
    expect(item2.sequencing!.rollupRules).toHaveLength(1);
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `deno test --allow-read packages/scorm-parser/tests/manifest-xml.test.ts`
Expected: PASS

- [ ] **Step 10: Write the ScormParser service**

Create `packages/scorm-parser/src/parser.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import JSZip from "jszip";
import type { ScormVersion } from "@corm/schema";
import { ScormManifestNotFound, ScormParseError } from "./errors.ts";
import { detectScormVersion } from "./version-detect.ts";
import { parseManifestXml, type ParsedManifest } from "./manifest-xml.ts";

export interface ScormPackage {
  manifest: ParsedManifest;
  version: ScormVersion;
  files: Map<string, Uint8Array>;
}

export class ScormParser extends Context.Tag("ScormParser")<
  ScormParser,
  {
    readonly parse: (
      zipData: Uint8Array
    ) => Effect.Effect<
      ScormPackage,
      ScormManifestNotFound | ScormParseError
    >;
  }
>() {}

export const ScormParserLive = Layer.succeed(ScormParser, {
  parse: (zipData: Uint8Array) =>
    Effect.gen(function* () {
      const zip = yield* Effect.promise(() => JSZip.loadAsync(zipData));

      // Find imsmanifest.xml (may be in root or subdirectory)
      let manifestPath: string | null = null;
      for (const path of Object.keys(zip.files)) {
        if (path.toLowerCase().endsWith("imsmanifest.xml")) {
          manifestPath = path;
          break;
        }
      }

      if (!manifestPath) {
        return yield* Effect.fail(
          new ScormManifestNotFound({
            message: "No imsmanifest.xml found in SCORM package",
          })
        );
      }

      const manifestXml = yield* Effect.promise(() =>
        zip.file(manifestPath!)!.async("string")
      );

      // Detect version
      const version = yield* detectScormVersion(manifestXml);

      // Parse manifest
      const manifest = yield* parseManifestXml(manifestXml, version);

      // Extract all files
      const files = new Map<string, Uint8Array>();
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const data = yield* Effect.promise(() =>
            zipEntry.async("uint8array")
          );
          files.set(path, data);
        }
      }

      return { manifest, version, files };
    }),
});
```

Update `packages/scorm-parser/src/mod.ts`:

```typescript
export { ScormParser, ScormParserLive, type ScormPackage } from "./parser.ts";
export { detectScormVersion } from "./version-detect.ts";
export { parseManifestXml, type ParsedManifest } from "./manifest-xml.ts";
export { parseItemSequencing } from "./sequencing-xml.ts";
export { parseMetadataXml } from "./metadata-xml.ts";
export {
  ScormParseError,
  ScormManifestNotFound,
  ScormVersionUnsupported,
  ScormSequencingError,
} from "./errors.ts";
```

- [ ] **Step 11: Write the ScormParser integration test**

Create `packages/scorm-parser/tests/parser.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import JSZip from "jszip";
import { ScormParser, ScormParserLive } from "../src/parser.ts";

const createMinimalScormZip = async (version: "1.2" | "2004"): Promise<Uint8Array> => {
  const zip = new JSZip();
  const manifestPath = version === "1.2"
    ? "fixtures/minimal-scorm12/imsmanifest.xml"
    : "fixtures/minimal-scorm2004/imsmanifest.xml";
  const manifestXml = await Deno.readTextFile(manifestPath);
  zip.file("imsmanifest.xml", manifestXml);
  zip.file("content/intro.html", "<html><body><h1>Introduction</h1></body></html>");
  zip.file("content/fire-types.html", "<html><body><h1>Fire Types</h1></body></html>");
  const buf = await zip.generateAsync({ type: "uint8array" });
  return buf;
};

describe("ScormParser", () => {
  it("parses a SCORM 1.2 zip package", async () => {
    const zipData = await createMinimalScormZip("1.2");

    const program = Effect.gen(function* () {
      const parser = yield* ScormParser;
      return yield* parser.parse(zipData);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(ScormParserLive))
    );

    expect(result.version).toBe("1.2");
    expect(result.manifest.organizations).toHaveLength(1);
    expect(result.files.size).toBeGreaterThan(0);
  });

  it("parses a SCORM 2004 zip package with sequencing", async () => {
    const zipData = await createMinimalScormZip("2004");

    const program = Effect.gen(function* () {
      const parser = yield* ScormParser;
      return yield* parser.parse(zipData);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(ScormParserLive))
    );

    expect(result.version).toBe("2004-4th");
    expect(result.manifest.organizations[0].items[0].sequencing).toBeDefined();
  });

  it("fails gracefully on missing manifest", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "not a SCORM package");
    const zipData = await zip.generateAsync({ type: "uint8array" });

    const program = Effect.gen(function* () {
      const parser = yield* ScormParser;
      return yield* parser.parse(zipData);
    });

    const result = await Effect.runPromiseExit(
      program.pipe(Effect.provide(ScormParserLive))
    );

    expect(result._tag).toBe("Failure");
  });
});
```

- [ ] **Step 12: Run all scorm-parser tests**

Run: `deno test --allow-read packages/scorm-parser/tests/`
Expected: All PASS

- [ ] **Step 13: Commit**

```bash
git add packages/scorm-parser/ fixtures/
git commit -m "feat(scorm-parser): full SCORM 1.2/2004 parser with sequencing, metadata, and version detection"
```

---

### Task 8: Vendor Parser — Generic HTML→Markdown

**Files:**
- Create: `packages/vendor-parsers/src/interface.ts`
- Create: `packages/vendor-parsers/src/generic/parser.ts`
- Create: `packages/vendor-parsers/src/registry.ts`
- Create: `packages/vendor-parsers/src/mod.ts`
- Test: `packages/vendor-parsers/tests/generic.test.ts`
- Test: `packages/vendor-parsers/tests/registry.test.ts`

- [ ] **Step 1: Write the VendorParser interface**

Create `packages/vendor-parsers/src/interface.ts`:

```typescript
import { Effect } from "effect";
import type { Slide, Assessment } from "@corm/schema";

export interface ExtractedAsset {
  originalPath: string;
  data: Uint8Array;
  mimeType: string;
}

export interface ExtractedTranscript {
  slideId: string;
  text: string;
}

export interface VendorParser {
  readonly name: string;
  readonly detect: (files: Map<string, Uint8Array>) => boolean;
  readonly extractSlides: (
    files: Map<string, Uint8Array>,
    contentPaths: string[]
  ) => Effect.Effect<Slide[]>;
  readonly extractAssessments: (
    files: Map<string, Uint8Array>
  ) => Effect.Effect<Assessment[]>;
  readonly extractAssets: (
    files: Map<string, Uint8Array>
  ) => Effect.Effect<ExtractedAsset[]>;
  readonly extractTranscripts: (
    files: Map<string, Uint8Array>
  ) => Effect.Effect<ExtractedTranscript[]>;
}
```

- [ ] **Step 2: Write the failing test for generic parser**

Create `packages/vendor-parsers/tests/generic.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { GenericParser } from "../src/generic/parser.ts";

describe("GenericParser", () => {
  it("detects any file set (fallback parser)", () => {
    const files = new Map<string, Uint8Array>([
      ["content/intro.html", new TextEncoder().encode("<html></html>")],
    ]);
    expect(GenericParser.detect(files)).toBe(true);
  });

  it("extracts slides from simple HTML", async () => {
    const html = `
      <html>
      <body>
        <h1>Fire Safety Introduction</h1>
        <p>Welcome to the fire safety course.</p>
        <img src="images/fire.jpg" alt="Fire">
        <ul>
          <li>Item one</li>
          <li>Item two</li>
        </ul>
      </body>
      </html>
    `;
    const files = new Map<string, Uint8Array>([
      ["content/intro.html", new TextEncoder().encode(html)],
    ]);

    const slides = await Effect.runPromise(
      GenericParser.extractSlides(files, ["content/intro.html"])
    );

    expect(slides).toHaveLength(1);
    expect(slides[0].title).toBe("Fire Safety Introduction");
    expect(slides[0].body).toContain("# Fire Safety Introduction");
    expect(slides[0].body).toContain("Welcome to the fire safety course.");
    expect(slides[0].body).toContain("- Item one");
  });

  it("extracts image asset references", async () => {
    const html = `
      <html><body>
        <img src="images/fire.jpg" alt="Fire">
        <img src="images/water.png" alt="Water">
      </body></html>
    `;
    const files = new Map<string, Uint8Array>([
      ["content/intro.html", new TextEncoder().encode(html)],
      ["content/images/fire.jpg", new Uint8Array([0xff, 0xd8])],
      ["content/images/water.png", new Uint8Array([0x89, 0x50])],
    ]);

    const assets = await Effect.runPromise(
      GenericParser.extractAssets(files)
    );

    expect(assets.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `deno test packages/vendor-parsers/tests/generic.test.ts`
Expected: FAIL

- [ ] **Step 4: Write the generic parser**

Create `packages/vendor-parsers/src/generic/parser.ts`:

```typescript
import { Effect } from "effect";
import { DOMParser } from "jsr:@nicolo-ribaudo/deno-dom";
import type { Slide, Assessment } from "@corm/schema";
import type {
  VendorParser,
  ExtractedAsset,
  ExtractedTranscript,
} from "../interface.ts";

const domParser = new DOMParser();

const htmlToMarkdown = (element: Element): string => {
  let md = "";

  for (const node of element.childNodes) {
    if (node.nodeType === 3) {
      // Text node
      const text = node.textContent?.trim();
      if (text) md += text + " ";
    } else if (node.nodeType === 1) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      switch (tag) {
        case "h1":
          md += `\n# ${el.textContent?.trim()}\n\n`;
          break;
        case "h2":
          md += `\n## ${el.textContent?.trim()}\n\n`;
          break;
        case "h3":
          md += `\n### ${el.textContent?.trim()}\n\n`;
          break;
        case "h4":
          md += `\n#### ${el.textContent?.trim()}\n\n`;
          break;
        case "p":
          md += `${el.textContent?.trim()}\n\n`;
          break;
        case "br":
          md += "\n";
          break;
        case "strong":
        case "b":
          md += `**${el.textContent?.trim()}**`;
          break;
        case "em":
        case "i":
          md += `*${el.textContent?.trim()}*`;
          break;
        case "ul":
          for (const li of el.querySelectorAll(":scope > li")) {
            md += `- ${li.textContent?.trim()}\n`;
          }
          md += "\n";
          break;
        case "ol": {
          let idx = 1;
          for (const li of el.querySelectorAll(":scope > li")) {
            md += `${idx}. ${li.textContent?.trim()}\n`;
            idx++;
          }
          md += "\n";
          break;
        }
        case "img": {
          const alt = el.getAttribute("alt") ?? "";
          const src = el.getAttribute("src") ?? "";
          md += `![${alt}](${src})\n\n`;
          break;
        }
        case "blockquote":
          md += `> ${el.textContent?.trim()}\n\n`;
          break;
        case "table":
          md += htmlToMarkdown(el);
          break;
        case "div":
        case "section":
        case "article":
        case "main":
        case "body":
          md += htmlToMarkdown(el);
          break;
        default:
          md += htmlToMarkdown(el);
          break;
      }
    }
  }

  return md.trim();
};

export const GenericParser: VendorParser = {
  name: "generic",

  detect: (_files: Map<string, Uint8Array>) => true, // Always matches as fallback

  extractSlides: (
    files: Map<string, Uint8Array>,
    contentPaths: string[]
  ) =>
    Effect.sync(() => {
      const slides: Slide[] = [];

      for (const path of contentPaths) {
        const data = files.get(path);
        if (!data) continue;

        const html = new TextDecoder().decode(data);
        const doc = domParser.parseFromString(html, "text/html");
        if (!doc) continue;

        const body = doc.querySelector("body") ?? doc.documentElement;
        if (!body) continue;

        const title =
          doc.querySelector("h1")?.textContent?.trim() ??
          doc.querySelector("title")?.textContent?.trim() ??
          path.split("/").pop()?.replace(/\.html?$/, "") ??
          "Untitled";

        const markdown = htmlToMarkdown(body);
        const id = path
          .replace(/\//g, "-")
          .replace(/\.html?$/, "")
          .replace(/^-/, "");

        slides.push({
          id,
          title,
          body: markdown,
          assets: [],
        });
      }

      return slides;
    }),

  extractAssessments: (_files: Map<string, Uint8Array>) =>
    Effect.succeed([]), // Generic parser cannot reliably extract assessments from arbitrary HTML

  extractAssets: (files: Map<string, Uint8Array>) =>
    Effect.sync(() => {
      const assets: ExtractedAsset[] = [];
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];

      for (const [path, data] of files) {
        const ext = path.toLowerCase().substring(path.lastIndexOf("."));
        if (imageExtensions.includes(ext)) {
          const mimeMap: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
            ".bmp": "image/bmp",
          };
          assets.push({
            originalPath: path,
            data,
            mimeType: mimeMap[ext] ?? "application/octet-stream",
          });
        }
      }

      return assets;
    }),

  extractTranscripts: (_files: Map<string, Uint8Array>) =>
    Effect.succeed([]), // Generic parser has no transcript source
};
```

- [ ] **Step 5: Write the VendorParserRegistry**

Create `packages/vendor-parsers/src/registry.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import type { VendorParser } from "./interface.ts";
import { GenericParser } from "./generic/parser.ts";

export class VendorParserRegistry extends Context.Tag("VendorParserRegistry")<
  VendorParserRegistry,
  {
    readonly detect: (files: Map<string, Uint8Array>) => VendorParser;
    readonly register: (parser: VendorParser) => void;
  }
>() {}

export const VendorParserRegistryLive = (
  additionalParsers: VendorParser[] = []
) => {
  const parsers: VendorParser[] = [...additionalParsers, GenericParser]; // Generic is always last (fallback)

  return Layer.succeed(VendorParserRegistry, {
    detect: (files: Map<string, Uint8Array>) => {
      for (const parser of parsers) {
        if (parser !== GenericParser && parser.detect(files)) {
          return parser;
        }
      }
      return GenericParser;
    },
    register: (parser: VendorParser) => {
      // Insert before GenericParser (last position)
      parsers.splice(parsers.length - 1, 0, parser);
    },
  });
};
```

Update `packages/vendor-parsers/src/mod.ts`:

```typescript
export type {
  VendorParser,
  ExtractedAsset,
  ExtractedTranscript,
} from "./interface.ts";
export { GenericParser } from "./generic/parser.ts";
export {
  VendorParserRegistry,
  VendorParserRegistryLive,
} from "./registry.ts";
```

- [ ] **Step 6: Write registry test**

Create `packages/vendor-parsers/tests/registry.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { VendorParserRegistry, VendorParserRegistryLive } from "../src/registry.ts";
import { GenericParser } from "../src/generic/parser.ts";

describe("VendorParserRegistry", () => {
  it("falls back to GenericParser when no vendor matches", () => {
    const files = new Map<string, Uint8Array>([
      ["content/intro.html", new TextEncoder().encode("<html></html>")],
    ]);

    const program = Effect.gen(function* () {
      const registry = yield* VendorParserRegistry;
      return registry.detect(files);
    });

    const result = Effect.runSync(
      program.pipe(Effect.provide(VendorParserRegistryLive()))
    );

    expect(result.name).toBe("generic");
  });
});
```

- [ ] **Step 7: Run all vendor-parser tests**

Run: `deno test packages/vendor-parsers/tests/`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add packages/vendor-parsers/
git commit -m "feat(vendor-parsers): generic HTML→Markdown parser with pluggable vendor registry"
```

---

### Task 9: Lens Core — get (SCORM → CORM)

**Files:**
- Create: `packages/lens/src/errors.ts`
- Create: `packages/lens/src/get.ts`
- Create: `packages/lens/src/mod.ts`
- Test: `packages/lens/tests/get.test.ts`

- [ ] **Step 1: Write lens errors**

Create `packages/lens/src/errors.ts`:

```typescript
import { Data } from "effect";

export class LensGetError extends Data.TaggedError("LensGetError")<{
  message: string;
  phase: "parse" | "extract" | "asset" | "validate";
}> {}

export class LensPutError extends Data.TaggedError("LensPutError")<{
  message: string;
  phase: "manifest" | "render" | "bundle" | "validate";
}> {}

export class LensRoundtripError extends Data.TaggedError("LensRoundtripError")<{
  message: string;
  details?: string;
}> {}
```

- [ ] **Step 2: Write the failing test for get**

Create `packages/lens/tests/get.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import JSZip from "jszip";
import { LensGet } from "../src/get.ts";
import { ScormParserLive } from "@corm/scorm-parser";
import { VendorParserRegistryLive } from "@corm/vendor-parsers";
import { ContentStoreLive } from "@corm/content-store";
import { ImageProcessorLive, TranscriptExtractorLive } from "@corm/asset-processor";

const createTestScormZip = async (): Promise<Uint8Array> => {
  const zip = new JSZip();
  const manifest = await Deno.readTextFile(
    "fixtures/minimal-scorm2004/imsmanifest.xml"
  );
  zip.file("imsmanifest.xml", manifest);
  zip.file(
    "content/intro.html",
    "<html><body><h1>Introduction</h1><p>Welcome to fire safety.</p></body></html>"
  );
  zip.file(
    "content/fire-types.html",
    "<html><body><h1>Fire Types</h1><p>There are several classes of fire.</p></body></html>"
  );
  return zip.generateAsync({ type: "uint8array" });
};

describe("LensGet", () => {
  it("converts a SCORM 2004 package to CORM", async () => {
    const tmpDir = await Deno.makeTempDir();
    const zipData = await createTestScormZip();

    const layer = Layer.mergeAll(
      ScormParserLive,
      VendorParserRegistryLive(),
      ContentStoreLive(tmpDir),
      ImageProcessorLive,
      TranscriptExtractorLive
    );

    const program = Effect.gen(function* () {
      const get = yield* LensGet;
      return yield* get.execute(zipData);
    });

    const corm = await Effect.runPromise(
      program.pipe(Effect.provide(LensGet.Live), Effect.provide(layer))
    );

    expect(corm.manifest.corm).toBe("1.0");
    expect(corm.manifest.scormSource).toBe("2004-4th");
    expect(corm.manifest.organizations).toHaveLength(1);
    expect(corm.modules.length).toBeGreaterThan(0);
    expect(corm.checksums.version).toBeDefined();

    await Deno.remove(tmpDir, { recursive: true });
  });

  it("preserves sequencing rules through get", async () => {
    const tmpDir = await Deno.makeTempDir();
    const zipData = await createTestScormZip();

    const layer = Layer.mergeAll(
      ScormParserLive,
      VendorParserRegistryLive(),
      ContentStoreLive(tmpDir),
      ImageProcessorLive,
      TranscriptExtractorLive
    );

    const program = Effect.gen(function* () {
      const get = yield* LensGet;
      return yield* get.execute(zipData);
    });

    const corm = await Effect.runPromise(
      program.pipe(Effect.provide(LensGet.Live), Effect.provide(layer))
    );

    const item = corm.manifest.organizations[0].items[0];
    expect(item.sequencing).toBeDefined();
    expect(item.sequencing!.objectives).toHaveLength(1);
    expect(item.sequencing!.objectives[0].minNormalizedMeasure).toBe(0.8);

    await Deno.remove(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `deno test --allow-read --allow-write --allow-ffi packages/lens/tests/get.test.ts`
Expected: FAIL

- [ ] **Step 4: Write the LensGet service**

Create `packages/lens/src/get.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import type { CormPackage, CormModule } from "@corm/schema";
import { ScormParser, type ScormPackage } from "@corm/scorm-parser";
import { VendorParserRegistry } from "@corm/vendor-parsers";
import { ContentStore } from "@corm/content-store";
import { computeChecksums } from "@corm/content-store";
import { ImageProcessor } from "@corm/asset-processor";
import { LensGetError } from "./errors.ts";

export class LensGet extends Context.Tag("LensGet")<
  LensGet,
  {
    readonly execute: (
      scormZip: Uint8Array
    ) => Effect.Effect<CormPackage, LensGetError>;
  }
>() {
  static Live = Layer.effect(
    LensGet,
    Effect.gen(function* () {
      const scormParser = yield* ScormParser;
      const vendorRegistry = yield* VendorParserRegistry;
      const contentStore = yield* ContentStore;
      const imageProcessor = yield* ImageProcessor;

      return {
        execute: (scormZip: Uint8Array) =>
          Effect.gen(function* () {
            // 1. Parse SCORM package
            const scorm = yield* scormParser.parse(scormZip).pipe(
              Effect.mapError(
                (e) =>
                  new LensGetError({
                    message: e.message,
                    phase: "parse",
                  })
              )
            );

            // 2. Detect vendor and extract content
            const vendor = vendorRegistry.detect(scorm.files);

            // Collect content paths from all items
            const contentPaths = collectContentPaths(scorm);

            const slides = yield* vendor
              .extractSlides(scorm.files, contentPaths)
              .pipe(
                Effect.mapError(
                  (e) =>
                    new LensGetError({
                      message: String(e),
                      phase: "extract",
                    })
                )
              );

            const assessments = yield* vendor
              .extractAssessments(scorm.files)
              .pipe(
                Effect.mapError(
                  (e) =>
                    new LensGetError({
                      message: String(e),
                      phase: "extract",
                    })
                )
              );

            // 3. Process assets
            const extractedAssets = yield* vendor
              .extractAssets(scorm.files)
              .pipe(
                Effect.mapError(
                  (e) =>
                    new LensGetError({
                      message: String(e),
                      phase: "asset",
                    })
                )
              );

            const assetEntries: Record<
              string,
              { hash: string; originalPath?: string; mimeType?: string; size: number }
            > = {};

            for (const asset of extractedAssets) {
              // Compress images to WebP
              if (asset.mimeType.startsWith("image/") && asset.mimeType !== "image/svg+xml") {
                const webp = yield* imageProcessor
                  .toWebP(asset.data, { maxBytes: 128 * 1024 })
                  .pipe(
                    Effect.mapError(
                      (e) =>
                        new LensGetError({
                          message: String(e),
                          phase: "asset",
                        })
                    )
                  );
                const hash = yield* contentStore.put(webp.data).pipe(
                  Effect.mapError(
                    (e) =>
                      new LensGetError({
                        message: String(e),
                        phase: "asset",
                      })
                  )
                );
                assetEntries[hash] = {
                  hash,
                  originalPath: asset.originalPath,
                  mimeType: "image/webp",
                  size: webp.compressedSize,
                };
              } else {
                const hash = yield* contentStore.put(asset.data).pipe(
                  Effect.mapError(
                    (e) =>
                      new LensGetError({
                        message: String(e),
                        phase: "asset",
                      })
                  )
                );
                assetEntries[hash] = {
                  hash,
                  originalPath: asset.originalPath,
                  mimeType: asset.mimeType,
                  size: asset.data.length,
                };
              }
            }

            // 4. Build CORM modules
            const modules: CormModule[] = [
              {
                id: "main",
                slides,
                assessments,
              },
            ];

            // 5. Build manifest
            const manifest = {
              corm: "1.0" as const,
              id: scorm.manifest.identifier,
              version: "1.0.0",
              scormSource: scorm.version,
              metadata: { title: scorm.manifest.title },
              organizations: scorm.manifest.organizations,
            };

            // 6. Compute checksums
            const fileMap = new Map<string, Uint8Array>();
            const encoder = new TextEncoder();
            fileMap.set("manifest.yaml", encoder.encode(JSON.stringify(manifest)));
            for (const slide of slides) {
              fileMap.set(
                `content/${slide.id}.md`,
                encoder.encode(slide.body)
              );
            }

            const checksums = yield* computeChecksums(fileMap, "1.0.0").pipe(
              Effect.mapError(
                (e) =>
                  new LensGetError({
                    message: String(e),
                    phase: "validate",
                  })
              )
            );

            return {
              manifest,
              modules,
              assets: assetEntries,
              checksums,
            } as CormPackage;
          }),
      };
    })
  );
}

const collectContentPaths = (scorm: ScormPackage): string[] => {
  const paths: string[] = [];
  const walkItems = (items: Array<{ content?: string[]; items?: any[] }>) => {
    for (const item of items) {
      if (item.content) paths.push(...item.content);
      if (item.items) walkItems(item.items);
    }
  };
  for (const org of scorm.manifest.organizations) {
    walkItems(org.items);
  }
  return paths;
};
```

Update `packages/lens/src/mod.ts`:

```typescript
export { LensGet } from "./get.ts";
export { LensGetError, LensPutError, LensRoundtripError } from "./errors.ts";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --allow-read --allow-write --allow-ffi packages/lens/tests/get.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/lens/
git commit -m "feat(lens): implement LensGet — SCORM→CORM transpilation with vendor detection and asset processing"
```

---

### Task 10: Lens Core — put (CORM → SCORM) & Round-Trip Verification

**Files:**
- Create: `packages/lens/src/put.ts`
- Create: `packages/lens/src/scorm-builder.ts`
- Create: `packages/lens/src/md-renderer.ts`
- Create: `packages/lens/src/lens.ts`
- Modify: `packages/lens/src/mod.ts`
- Test: `packages/lens/tests/put.test.ts`
- Test: `packages/lens/tests/roundtrip.test.ts`

- [ ] **Step 1: Write the markdown renderer**

Create `packages/lens/src/md-renderer.ts`:

```typescript
// Converts CORM Markdown slides to clean HTML for SCORM output
export const renderMarkdownToHtml = (
  markdown: string,
  title: string,
  cssTheme?: string
): string => {
  // Simple markdown→HTML conversion for SCORM output
  let html = markdown
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  html = `<p>${html}</p>`;

  const css = cssTheme ?? `
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    img { max-width: 100%; height: auto; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
```

- [ ] **Step 2: Write the SCORM builder (CORM manifest → imsmanifest.xml)**

Create `packages/lens/src/scorm-builder.ts`:

```typescript
import type { CormPackage, Item, ItemSequencing, Objective } from "@corm/schema";

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const buildSequencingXml = (seq: ItemSequencing, indent: string): string => {
  let xml = `${indent}<imsss:sequencing>\n`;

  // Control mode
  const cm = seq.controlMode;
  xml += `${indent}  <imsss:controlMode`;
  xml += ` choice="${cm.choice}"`;
  xml += ` choiceExit="${cm.choiceExit}"`;
  xml += ` flow="${cm.flow}"`;
  xml += ` forwardOnly="${cm.forwardOnly}"`;
  xml += `/>\n`;

  // Sequencing rules
  if (seq.preconditions.length > 0 || seq.postconditions.length > 0 || seq.exitConditions.length > 0) {
    xml += `${indent}  <imsss:sequencingRules>\n`;
    for (const rule of seq.preconditions) {
      xml += `${indent}    <imsss:preConditionRule>\n`;
      xml += buildRuleConditionsXml(rule, `${indent}      `);
      xml += `${indent}      <imsss:ruleAction action="${escapeXml(rule.action)}"/>\n`;
      xml += `${indent}    </imsss:preConditionRule>\n`;
    }
    for (const rule of seq.postconditions) {
      xml += `${indent}    <imsss:postConditionRule>\n`;
      xml += buildRuleConditionsXml(rule, `${indent}      `);
      xml += `${indent}      <imsss:ruleAction action="${escapeXml(rule.action)}"/>\n`;
      xml += `${indent}    </imsss:postConditionRule>\n`;
    }
    for (const rule of seq.exitConditions) {
      xml += `${indent}    <imsss:exitConditionRule>\n`;
      xml += buildRuleConditionsXml(rule, `${indent}      `);
      xml += `${indent}      <imsss:ruleAction action="${escapeXml(rule.action)}"/>\n`;
      xml += `${indent}    </imsss:exitConditionRule>\n`;
    }
    xml += `${indent}  </imsss:sequencingRules>\n`;
  }

  // Objectives
  if (seq.objectives.length > 0) {
    xml += `${indent}  <imsss:objectives>\n`;
    for (const obj of seq.objectives) {
      const tag = obj.primary ? "primaryObjective" : "objective";
      xml += `${indent}    <imsss:${tag} objectiveID="${escapeXml(obj.id)}"`;
      xml += ` satisfiedByMeasure="${obj.satisfiedByMeasure}">\n`;
      if (obj.satisfiedByMeasure) {
        xml += `${indent}      <imsss:minNormalizedMeasure>${obj.minNormalizedMeasure}</imsss:minNormalizedMeasure>\n`;
      }
      if (obj.maps) {
        for (const map of obj.maps) {
          xml += `${indent}      <imsss:mapInfo`;
          xml += ` targetObjectiveID="${escapeXml(map.target)}"`;
          xml += ` readSatisfiedStatus="${map.readSatisfied}"`;
          xml += ` readNormalizedMeasure="${map.readNormalizedMeasure}"`;
          xml += ` writeSatisfiedStatus="${map.writeSatisfied}"`;
          xml += ` writeNormalizedMeasure="${map.writeNormalizedMeasure}"`;
          xml += `/>\n`;
        }
      }
      xml += `${indent}    </imsss:${tag}>\n`;
    }
    xml += `${indent}  </imsss:objectives>\n`;
  }

  // Rollup rules
  if (seq.rollupRules.length > 0) {
    xml += `${indent}  <imsss:rollupRules>\n`;
    for (const rr of seq.rollupRules) {
      xml += `${indent}    <imsss:rollupRule childActivitySet="${rr.childActivitySet}">\n`;
      xml += `${indent}      <imsss:rollupConditions>\n`;
      for (const cond of rr.conditions) {
        xml += `${indent}        <imsss:rollupCondition condition="${cond.condition}"`;
        if (cond.operator) xml += ` operator="${cond.operator}"`;
        xml += `/>\n`;
      }
      xml += `${indent}      </imsss:rollupConditions>\n`;
      xml += `${indent}      <imsss:rollupAction action="${rr.action}"/>\n`;
      xml += `${indent}    </imsss:rollupRule>\n`;
    }
    xml += `${indent}  </imsss:rollupRules>\n`;
  }

  xml += `${indent}</imsss:sequencing>\n`;
  return xml;
};

const buildRuleConditionsXml = (
  rule: { conditions: { operator: string; rules: Array<{ condition: string; refObjective?: string; measureThreshold?: number; operator?: string }> } },
  indent: string
): string => {
  let xml = `${indent}<imsss:ruleConditions conditionCombination="${rule.conditions.operator}">\n`;
  for (const cond of rule.conditions.rules) {
    xml += `${indent}  <imsss:ruleCondition condition="${escapeXml(cond.condition)}"`;
    if (cond.refObjective) xml += ` referencedObjective="${escapeXml(cond.refObjective)}"`;
    if (cond.measureThreshold !== undefined) xml += ` measureThreshold="${cond.measureThreshold}"`;
    if (cond.operator) xml += ` operator="${cond.operator}"`;
    xml += `/>\n`;
  }
  xml += `${indent}</imsss:ruleConditions>\n`;
  return xml;
};

const buildItemXml = (item: Item, indent: string): string => {
  let xml = `${indent}<item identifier="${escapeXml(item.id)}"`;
  if (item.content && item.content.length > 0) {
    xml += ` identifierref="res-${escapeXml(item.id)}"`;
  }
  if (!item.isVisible) xml += ` isvisible="false"`;
  xml += `>\n`;
  xml += `${indent}  <title>${escapeXml(item.title)}</title>\n`;

  if (item.sequencing) {
    xml += buildSequencingXml(item.sequencing, `${indent}  `);
  }

  if (item.items) {
    for (const child of item.items) {
      xml += buildItemXml(child, `${indent}  `);
    }
  }

  xml += `${indent}</item>\n`;
  return xml;
};

export const buildImsManifestXml = (corm: CormPackage): string => {
  const m = corm.manifest;
  const is2004 = m.scormSource.startsWith("2004");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  if (is2004) {
    xml += `<manifest identifier="${escapeXml(m.id)}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss">\n`;
  } else {
    xml += `<manifest identifier="${escapeXml(m.id)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">\n`;
  }

  // Metadata
  xml += `  <metadata>\n`;
  xml += `    <schema>ADL SCORM</schema>\n`;
  const versionMap: Record<string, string> = {
    "1.2": "1.2",
    "2004-2nd": "2004 2nd Edition",
    "2004-3rd": "2004 3rd Edition",
    "2004-4th": "2004 4th Edition",
  };
  xml += `    <schemaversion>${versionMap[m.scormSource] ?? m.scormSource}</schemaversion>\n`;
  xml += `  </metadata>\n`;

  // Organizations
  xml += `  <organizations default="${escapeXml(m.organizations[0]?.id ?? "org-default")}">\n`;
  for (const org of m.organizations) {
    xml += `    <organization identifier="${escapeXml(org.id)}">\n`;
    xml += `      <title>${escapeXml(org.title)}</title>\n`;
    for (const item of org.items) {
      xml += buildItemXml(item, "      ");
    }
    xml += `    </organization>\n`;
  }
  xml += `  </organizations>\n`;

  // Resources
  xml += `  <resources>\n`;
  const collectResources = (items: Item[]) => {
    for (const item of items) {
      if (item.content && item.content.length > 0) {
        const href = `content/${item.id}.html`;
        const scormType = is2004 ? "adlcp:scormType" : "adlcp:scormtype";
        xml += `    <resource identifier="res-${escapeXml(item.id)}" type="webcontent" ${scormType}="sco" href="${href}">\n`;
        xml += `      <file href="${href}"/>\n`;
        xml += `    </resource>\n`;
      }
      if (item.items) collectResources(item.items);
    }
  };
  for (const org of m.organizations) {
    collectResources(org.items);
  }
  xml += `  </resources>\n`;

  xml += `</manifest>\n`;
  return xml;
};
```

- [ ] **Step 3: Write the LensPut service**

Create `packages/lens/src/put.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import JSZip from "jszip";
import type { CormPackage } from "@corm/schema";
import { buildImsManifestXml } from "./scorm-builder.ts";
import { renderMarkdownToHtml } from "./md-renderer.ts";
import { LensPutError } from "./errors.ts";

export class LensPut extends Context.Tag("LensPut")<
  LensPut,
  {
    readonly execute: (
      corm: CormPackage
    ) => Effect.Effect<Uint8Array, LensPutError>;
  }
>() {
  static Live = Layer.succeed(LensPut, {
    execute: (corm: CormPackage) =>
      Effect.gen(function* () {
        const zip = new JSZip();

        // 1. Generate imsmanifest.xml
        const manifestXml = buildImsManifestXml(corm);
        zip.file("imsmanifest.xml", manifestXml);

        // 2. Render slides to HTML
        for (const mod of corm.modules) {
          for (const slide of mod.slides) {
            const html = renderMarkdownToHtml(slide.body, slide.title);
            zip.file(`content/${slide.id}.html`, html);
          }
        }

        // 3. Bundle as zip
        const zipData = yield* Effect.promise(() =>
          zip.generateAsync({ type: "uint8array" })
        ).pipe(
          Effect.mapError(
            (e) =>
              new LensPutError({
                message: String(e),
                phase: "bundle",
              })
          )
        );

        return zipData;
      }),
  });
}
```

- [ ] **Step 4: Write the Lens service (combines get + put)**

Create `packages/lens/src/lens.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import type { CormPackage } from "@corm/schema";
import { LensGet } from "./get.ts";
import { LensPut } from "./put.ts";
import { LensRoundtripError } from "./errors.ts";
import { ScormParser } from "@corm/scorm-parser";

export class Lens extends Context.Tag("Lens")<
  Lens,
  {
    readonly get: (scormZip: Uint8Array) => Effect.Effect<CormPackage>;
    readonly put: (corm: CormPackage) => Effect.Effect<Uint8Array>;
    readonly verifyRoundtrip: (
      scormZip: Uint8Array
    ) => Effect.Effect<boolean, LensRoundtripError>;
  }
>() {
  static Live = Layer.effect(
    Lens,
    Effect.gen(function* () {
      const lensGet = yield* LensGet;
      const lensPut = yield* LensPut;
      const scormParser = yield* ScormParser;

      return {
        get: (scormZip: Uint8Array) => lensGet.execute(scormZip),
        put: (corm: CormPackage) => lensPut.execute(corm),
        verifyRoundtrip: (scormZip: Uint8Array) =>
          Effect.gen(function* () {
            // get(s) → corm
            const corm = yield* lensGet.execute(scormZip);

            // put(get(s)) → scorm2
            const scorm2Zip = yield* lensPut.execute(corm);

            // Verify scorm2 is parseable (basic conformance)
            const parsed = yield* scormParser.parse(scorm2Zip).pipe(
              Effect.mapError(
                (e) =>
                  new LensRoundtripError({
                    message: `Round-trip output is not valid SCORM: ${e.message}`,
                  })
              )
            );

            // Verify organizations match
            const origOrgs = corm.manifest.organizations;
            const rtOrgs = parsed.manifest.organizations;

            if (origOrgs.length !== rtOrgs.length) {
              return yield* Effect.fail(
                new LensRoundtripError({
                  message: `Organization count mismatch: ${origOrgs.length} vs ${rtOrgs.length}`,
                })
              );
            }

            // get(put(get(s))) = get(s) — idempotence check
            const corm2 = yield* lensGet.execute(scorm2Zip);
            if (
              corm2.manifest.organizations.length !==
              corm.manifest.organizations.length
            ) {
              return yield* Effect.fail(
                new LensRoundtripError({
                  message: "Idempotence check failed: organization structure differs",
                })
              );
            }

            return true;
          }),
      };
    })
  );
}
```

Update `packages/lens/src/mod.ts`:

```typescript
export { LensGet } from "./get.ts";
export { LensPut } from "./put.ts";
export { Lens } from "./lens.ts";
export { renderMarkdownToHtml } from "./md-renderer.ts";
export { buildImsManifestXml } from "./scorm-builder.ts";
export { LensGetError, LensPutError, LensRoundtripError } from "./errors.ts";
```

- [ ] **Step 5: Write put test**

Create `packages/lens/tests/put.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { LensPut } from "../src/put.ts";
import type { CormPackage } from "@corm/schema";

describe("LensPut", () => {
  it("generates a valid SCORM zip from a CORM package", async () => {
    const corm: CormPackage = {
      manifest: {
        corm: "1.0",
        id: "com.example.test",
        version: "1.0.0",
        scormSource: "2004-4th",
        metadata: { title: "Test Course" },
        organizations: [
          {
            id: "org-default",
            title: "Test Course",
            items: [
              {
                id: "mod-01",
                title: "Introduction",
                isVisible: true,
                content: ["slide-001.md"],
                sequencing: {
                  controlMode: {
                    choice: true,
                    choiceExit: true,
                    flow: true,
                    forwardOnly: false,
                    useCurrentAttemptObjectiveInfo: true,
                    useCurrentAttemptProgressInfo: true,
                  },
                  constrainChoice: false,
                  preventActivation: false,
                  preconditions: [],
                  postconditions: [],
                  exitConditions: [],
                  objectives: [
                    {
                      id: "obj-01",
                      primary: true,
                      satisfiedByMeasure: true,
                      minNormalizedMeasure: 0.8,
                    },
                  ],
                  rollupRules: [],
                  deliveryControls: {
                    tracked: true,
                    completionSetByContent: false,
                    objectiveSetByContent: false,
                  },
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: "main",
          slides: [
            {
              id: "content-intro",
              title: "Introduction",
              body: "# Introduction\n\nWelcome to the test course.",
              assets: [],
            },
          ],
          assessments: [],
        },
      ],
      assets: {},
      checksums: { version: "1.0.0", files: {} },
    };

    const program = Effect.gen(function* () {
      const put = yield* LensPut;
      return yield* put.execute(corm);
    });

    const zipData = await Effect.runPromise(
      program.pipe(Effect.provide(LensPut.Live))
    );

    expect(zipData.length).toBeGreaterThan(0);
    // Verify it's a valid zip (PK magic bytes)
    expect(zipData[0]).toBe(0x50); // P
    expect(zipData[1]).toBe(0x4b); // K
  });
});
```

- [ ] **Step 6: Write round-trip test**

Create `packages/lens/tests/roundtrip.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import JSZip from "jszip";
import { Lens } from "../src/lens.ts";
import { LensGet } from "../src/get.ts";
import { LensPut } from "../src/put.ts";
import { ScormParserLive } from "@corm/scorm-parser";
import { VendorParserRegistryLive } from "@corm/vendor-parsers";
import { ContentStoreLive } from "@corm/content-store";
import { ImageProcessorLive, TranscriptExtractorLive } from "@corm/asset-processor";

describe("Lens round-trip", () => {
  it("put(get(s)) produces parseable SCORM", async () => {
    const tmpDir = await Deno.makeTempDir();

    // Create test SCORM zip
    const zip = new JSZip();
    const manifest = await Deno.readTextFile(
      "fixtures/minimal-scorm2004/imsmanifest.xml"
    );
    zip.file("imsmanifest.xml", manifest);
    zip.file(
      "content/intro.html",
      "<html><body><h1>Intro</h1><p>Hello</p></body></html>"
    );
    zip.file(
      "content/fire-types.html",
      "<html><body><h1>Fire Types</h1><p>Types</p></body></html>"
    );
    const zipData = await zip.generateAsync({ type: "uint8array" });

    const deps = Layer.mergeAll(
      ScormParserLive,
      VendorParserRegistryLive(),
      ContentStoreLive(tmpDir),
      ImageProcessorLive,
      TranscriptExtractorLive
    );

    const lensLayer = Layer.provideMerge(
      Layer.mergeAll(LensGet.Live, LensPut.Live),
      deps
    );

    const fullLayer = Layer.provideMerge(Lens.Live, lensLayer);

    const program = Effect.gen(function* () {
      const lens = yield* Lens;
      return yield* lens.verifyRoundtrip(zipData);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(fullLayer))
    );

    expect(result).toBe(true);

    await Deno.remove(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 7: Run all lens tests**

Run: `deno test --allow-read --allow-write --allow-ffi packages/lens/tests/`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add packages/lens/
git commit -m "feat(lens): implement LensPut (CORM→SCORM) and round-trip verification"
```

---

### Task 11: Validator

**Files:**
- Create: `packages/validator/src/schema-check.ts`
- Create: `packages/validator/src/size-check.ts`
- Create: `packages/validator/src/validator.ts`
- Create: `packages/validator/src/mod.ts`
- Test: `packages/validator/tests/schema-check.test.ts`
- Test: `packages/validator/tests/size-check.test.ts`

- [ ] **Step 1: Write the failing test for size-check**

Create `packages/validator/tests/size-check.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { checkFileSizes, type SizeViolation } from "../src/size-check.ts";

describe("checkFileSizes", () => {
  it("passes when all files are under 128KB", () => {
    const files = new Map<string, Uint8Array>([
      ["slide.md", new Uint8Array(1024)],        // 1KB
      ["manifest.yaml", new Uint8Array(2048)],   // 2KB
    ]);
    const violations = checkFileSizes(files, 128 * 1024);
    expect(violations).toHaveLength(0);
  });

  it("reports files exceeding the size limit", () => {
    const files = new Map<string, Uint8Array>([
      ["small.md", new Uint8Array(1024)],
      ["too-big.webp", new Uint8Array(200 * 1024)],  // 200KB > 128KB
    ]);
    const violations = checkFileSizes(files, 128 * 1024);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("too-big.webp");
    expect(violations[0].size).toBe(200 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test packages/validator/tests/size-check.test.ts`
Expected: FAIL

- [ ] **Step 3: Write size-check**

Create `packages/validator/src/size-check.ts`:

```typescript
export interface SizeViolation {
  path: string;
  size: number;
  limit: number;
}

export const checkFileSizes = (
  files: Map<string, Uint8Array>,
  maxBytes: number
): SizeViolation[] => {
  const violations: SizeViolation[] = [];
  for (const [path, data] of files) {
    if (data.length > maxBytes) {
      violations.push({ path, size: data.length, limit: maxBytes });
    }
  }
  return violations;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test packages/validator/tests/size-check.test.ts`
Expected: PASS

- [ ] **Step 5: Write the CormValidator service**

Create `packages/validator/src/schema-check.ts`:

```typescript
import { Effect } from "effect";
import { Schema } from "effect";
import { CormPackage } from "@corm/schema";

export interface SchemaViolation {
  path: string;
  message: string;
}

export const validateSchema = (
  data: unknown
): Effect.Effect<typeof CormPackage.Type, SchemaViolation> =>
  Schema.decodeUnknown(CormPackage)(data).pipe(
    Effect.mapError((e) => ({
      path: "root",
      message: `Schema validation failed: ${String(e)}`,
    }))
  );
```

Create `packages/validator/src/validator.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import type { CormPackage } from "@corm/schema";
import { checkFileSizes, type SizeViolation } from "./size-check.ts";

export interface ValidationResult {
  valid: boolean;
  sizeViolations: SizeViolation[];
  errors: string[];
}

export class CormValidator extends Context.Tag("CormValidator")<
  CormValidator,
  {
    readonly validate: (
      corm: CormPackage,
      files?: Map<string, Uint8Array>
    ) => Effect.Effect<ValidationResult>;
  }
>() {}

const MAX_FILE_SIZE = 128 * 1024; // 128KB

export const CormValidatorLive = Layer.succeed(CormValidator, {
  validate: (corm: CormPackage, files?: Map<string, Uint8Array>) =>
    Effect.sync(() => {
      const errors: string[] = [];
      let sizeViolations: SizeViolation[] = [];

      // Check manifest has required fields
      if (!corm.manifest.corm) errors.push("Missing corm version");
      if (!corm.manifest.id) errors.push("Missing course id");
      if (!corm.manifest.version) errors.push("Missing version");
      if (!corm.manifest.scormSource) errors.push("Missing scormSource");
      if (!corm.manifest.organizations?.length)
        errors.push("No organizations defined");

      // Check modules have content
      if (!corm.modules?.length) errors.push("No modules defined");

      // Check file sizes if files provided
      if (files) {
        sizeViolations = checkFileSizes(files, MAX_FILE_SIZE);
        for (const v of sizeViolations) {
          errors.push(
            `File ${v.path} exceeds ${MAX_FILE_SIZE} bytes (${v.size} bytes)`
          );
        }
      }

      return {
        valid: errors.length === 0,
        sizeViolations,
        errors,
      };
    }),
});
```

Update `packages/validator/src/mod.ts`:

```typescript
export { CormValidator, CormValidatorLive, type ValidationResult } from "./validator.ts";
export { checkFileSizes, type SizeViolation } from "./size-check.ts";
export { validateSchema, type SchemaViolation } from "./schema-check.ts";
```

- [ ] **Step 6: Write validator integration test**

Create `packages/validator/tests/validator.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { CormValidator, CormValidatorLive } from "../src/validator.ts";
import type { CormPackage } from "@corm/schema";

describe("CormValidator", () => {
  const validCorm: CormPackage = {
    manifest: {
      corm: "1.0",
      id: "com.example.test",
      version: "1.0.0",
      scormSource: "2004-4th",
      metadata: { title: "Test" },
      organizations: [
        { id: "org-1", title: "Test Org", items: [{ id: "item-1", title: "Item 1" }] },
      ],
    },
    modules: [{ id: "main", slides: [{ id: "s1", title: "Slide 1", body: "# Hello", assets: [] }], assessments: [] }],
    assets: {},
    checksums: { version: "1.0.0", files: {} },
  };

  it("validates a correct CORM package", async () => {
    const program = Effect.gen(function* () {
      const validator = yield* CormValidator;
      return yield* validator.validate(validCorm);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(CormValidatorLive))
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a CORM package with missing organizations", async () => {
    const invalid = {
      ...validCorm,
      manifest: { ...validCorm.manifest, organizations: [] },
    };

    const program = Effect.gen(function* () {
      const validator = yield* CormValidator;
      return yield* validator.validate(invalid as CormPackage);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(CormValidatorLive))
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("organizations"))).toBe(true);
  });
});
```

- [ ] **Step 7: Run all validator tests**

Run: `deno test packages/validator/tests/`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add packages/validator/
git commit -m "feat(validator): CORM schema validation with 128KB size enforcement"
```

---

### Task 12: CLI Entrypoint & Dockerfile

**Files:**
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/mod.ts`
- Create: `Dockerfile`
- Test: `packages/cli/tests/cli.test.ts`

- [ ] **Step 1: Write the CLI entrypoint**

Create `packages/cli/src/main.ts`:

```typescript
import { Effect, Layer } from "effect";
import { LensGet, LensPut, Lens } from "@corm/lens";
import { ScormParserLive } from "@corm/scorm-parser";
import { VendorParserRegistryLive } from "@corm/vendor-parsers";
import { ContentStoreLive } from "@corm/content-store";
import { ImageProcessorLive, TranscriptExtractorLive } from "@corm/asset-processor";
import { CormValidatorLive } from "@corm/validator";
import * as yaml from "js-yaml";

const printUsage = () => {
  console.log(`CORM CLI — Compact Object Reference Model

Usage:
  corm get <scorm.zip> <output-dir>     Convert SCORM → CORM
  corm put <corm-dir> <output.zip>      Convert CORM → SCORM
  corm validate <corm-dir>              Validate a CORM package
  corm diff <old-dir> <new-dir>         Compute delta between versions

Options:
  --max-chunk-size <bytes>    Max file size (default: 131072 = 128KB)
  --image-quality <0-100>     WebP quality (default: 80)
  --help                      Show this help
`);
};

const createLayers = (storeDir: string) => {
  const deps = Layer.mergeAll(
    ScormParserLive,
    VendorParserRegistryLive(),
    ContentStoreLive(storeDir),
    ImageProcessorLive,
    TranscriptExtractorLive,
    CormValidatorLive
  );

  return Layer.provideMerge(
    Layer.mergeAll(LensGet.Live, LensPut.Live),
    deps
  );
};

const main = async () => {
  const args = Deno.args;

  if (args.length === 0 || args.includes("--help")) {
    printUsage();
    Deno.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "get": {
      if (args.length < 3) {
        console.error("Usage: corm get <scorm.zip> <output-dir>");
        Deno.exit(1);
      }
      const [, inputPath, outputDir] = args;

      await Deno.mkdir(outputDir, { recursive: true });
      const storeDir = `${outputDir}/assets`;
      await Deno.mkdir(storeDir, { recursive: true });

      const scormZip = await Deno.readFile(inputPath);
      const layers = createLayers(storeDir);

      const program = Effect.gen(function* () {
        const lensGet = yield* LensGet;
        const corm = yield* lensGet.execute(scormZip);

        // Write manifest
        const manifestYaml = yaml.dump(corm.manifest, { lineWidth: -1 });
        yield* Effect.promise(() =>
          Deno.writeTextFile(`${outputDir}/manifest.yaml`, manifestYaml)
        );

        // Write slides
        for (const mod of corm.modules) {
          const modDir = `${outputDir}/content/${mod.id}`;
          yield* Effect.promise(() =>
            Deno.mkdir(modDir, { recursive: true })
          );
          for (const slide of mod.slides) {
            const frontmatter = yaml.dump({
              id: slide.id,
              title: slide.title,
              layout: slide.layout,
              transcript: slide.transcript,
              assets: slide.assets,
            });
            const content = `---\n${frontmatter}---\n\n${slide.body}`;
            yield* Effect.promise(() =>
              Deno.writeTextFile(`${modDir}/${slide.id}.md`, content)
            );
          }
        }

        // Write checksums
        const checksumsYaml = yaml.dump(corm.checksums);
        yield* Effect.promise(() =>
          Deno.writeTextFile(`${outputDir}/checksums.yaml`, checksumsYaml)
        );

        return corm;
      });

      const corm = await Effect.runPromise(program.pipe(Effect.provide(layers)));
      console.log(`✓ Converted to CORM: ${outputDir}`);
      console.log(`  Modules: ${corm.modules.length}`);
      console.log(`  Slides: ${corm.modules.reduce((n, m) => n + m.slides.length, 0)}`);
      console.log(`  SCORM version: ${corm.manifest.scormSource}`);
      break;
    }

    case "put": {
      if (args.length < 3) {
        console.error("Usage: corm put <corm-dir> <output.zip>");
        Deno.exit(1);
      }
      console.log("CORM → SCORM export not yet implemented in CLI");
      Deno.exit(1);
      break;
    }

    case "validate": {
      if (args.length < 2) {
        console.error("Usage: corm validate <corm-dir>");
        Deno.exit(1);
      }
      console.log("Validation not yet implemented in CLI");
      Deno.exit(1);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      Deno.exit(1);
  }
};

main();
```

Update `packages/cli/src/mod.ts`:

```typescript
export {};
```

- [ ] **Step 2: Write a basic CLI test**

Create `packages/cli/tests/cli.test.ts`:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";

describe("CLI", () => {
  it("prints help with --help flag", async () => {
    const cmd = new Deno.Command("deno", {
      args: ["run", "--allow-all", "packages/cli/src/main.ts", "--help"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    const stdout = new TextDecoder().decode(output.stdout);
    expect(stdout).toContain("CORM CLI");
    expect(stdout).toContain("corm get");
    expect(stdout).toContain("corm put");
  });
});
```

- [ ] **Step 3: Run CLI test**

Run: `deno test --allow-all packages/cli/tests/cli.test.ts`
Expected: PASS

- [ ] **Step 4: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM denoland/deno:2.2.0

WORKDIR /app

# Copy workspace config
COPY deno.json biome.json ./

# Copy packages
COPY packages/ packages/
COPY fixtures/ fixtures/

# Cache dependencies
RUN deno cache packages/cli/src/main.ts

# Default command
ENTRYPOINT ["deno", "run", "--allow-all", "packages/cli/src/main.ts"]
```

- [ ] **Step 5: Verify Docker build**

Run: `docker build -t corm:latest .`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/cli/ Dockerfile
git commit -m "feat(cli): CLI entrypoint and Docker image for shore-side transpiler"
```

---

### Task 13: Integration Test — Full SCORM→CORM→SCORM Round-Trip

**Files:**
- Create: `tests/integration/roundtrip.test.ts`

This is the capstone test — verifies the complete lens pipeline end-to-end.

- [ ] **Step 1: Write the integration test**

Create `tests/integration/roundtrip.test.ts`:

```typescript
import { describe, it, afterEach } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import JSZip from "jszip";
import { Lens } from "@corm/lens";
import { LensGet, LensPut } from "@corm/lens";
import { ScormParser, ScormParserLive } from "@corm/scorm-parser";
import { VendorParserRegistryLive } from "@corm/vendor-parsers";
import { ContentStoreLive } from "@corm/content-store";
import { ImageProcessorLive, TranscriptExtractorLive } from "@corm/asset-processor";

describe("SCORM → CORM → SCORM Integration", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
  });

  const buildLayers = (dir: string) => {
    const deps = Layer.mergeAll(
      ScormParserLive,
      VendorParserRegistryLive(),
      ContentStoreLive(dir),
      ImageProcessorLive,
      TranscriptExtractorLive
    );
    const lensLayers = Layer.provideMerge(
      Layer.mergeAll(LensGet.Live, LensPut.Live),
      deps
    );
    return Layer.provideMerge(Lens.Live, lensLayers);
  };

  it("round-trips a SCORM 1.2 package", async () => {
    tmpDir = await Deno.makeTempDir();
    const manifest = await Deno.readTextFile("fixtures/minimal-scorm12/imsmanifest.xml");

    const zip = new JSZip();
    zip.file("imsmanifest.xml", manifest);
    zip.file("content/intro.html", "<html><body><h1>Hello</h1><p>World</p></body></html>");
    zip.file("content/fire-types.html", "<html><body><h1>Fire</h1><p>Types</p></body></html>");
    const zipData = await zip.generateAsync({ type: "uint8array" });

    const layers = buildLayers(tmpDir);

    const program = Effect.gen(function* () {
      const lens = yield* Lens;

      // get: SCORM → CORM
      const corm = yield* lens.get(zipData);
      expect(corm.manifest.scormSource).toBe("1.2");
      expect(corm.modules.length).toBeGreaterThan(0);

      // put: CORM → SCORM
      const scormZip = yield* lens.put(corm);
      expect(scormZip.length).toBeGreaterThan(0);

      // Verify output is parseable SCORM
      const parser = yield* ScormParser;
      const reparsed = yield* parser.parse(scormZip);
      expect(reparsed.version).toBe("1.2");
      expect(reparsed.manifest.organizations.length).toBe(
        corm.manifest.organizations.length
      );

      return true;
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(layers)));
    expect(result).toBe(true);
  });

  it("round-trips a SCORM 2004 package preserving sequencing", async () => {
    tmpDir = await Deno.makeTempDir();
    const manifest = await Deno.readTextFile("fixtures/minimal-scorm2004/imsmanifest.xml");

    const zip = new JSZip();
    zip.file("imsmanifest.xml", manifest);
    zip.file("content/intro.html", "<html><body><h1>Intro</h1></body></html>");
    zip.file("content/fire-types.html", "<html><body><h1>Fire Types</h1></body></html>");
    const zipData = await zip.generateAsync({ type: "uint8array" });

    const layers = buildLayers(tmpDir);

    const program = Effect.gen(function* () {
      const lens = yield* Lens;

      // Full round-trip verification
      const passes = yield* lens.verifyRoundtrip(zipData);
      expect(passes).toBe(true);

      // Detailed check
      const corm = yield* lens.get(zipData);
      const item = corm.manifest.organizations[0].items[0];
      expect(item.sequencing).toBeDefined();
      expect(item.sequencing!.objectives[0].minNormalizedMeasure).toBe(0.8);

      // put and re-get — idempotence
      const scorm2 = yield* lens.put(corm);
      const corm2 = yield* lens.get(scorm2);
      expect(corm2.manifest.organizations.length).toBe(
        corm.manifest.organizations.length
      );

      return true;
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(layers)));
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `deno test --allow-read --allow-write --allow-ffi tests/integration/`
Expected: All PASS

- [ ] **Step 3: Run full test suite**

Run: `deno test --allow-read --allow-write --allow-ffi --allow-run`
Expected: All tests across all packages PASS

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: add full SCORM→CORM→SCORM round-trip integration tests"
```

- [ ] **Step 5: Push to remote**

```bash
git push origin main
```
