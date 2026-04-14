/**
 * Sequencing Engine Tests — IMS Simple Sequencing interpreter.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { CmiRuntime } from "../src/cmi/runtime.ts";
import {
  type Activity,
  allLeaves,
  buildActivityTree,
  type ManifestOrganization,
  SequencingEngine,
} from "../src/sequencing/mod.ts";
import { rollup } from "../src/sequencing/rollup.ts";

/** Helper: create a minimal runtime. */
function makeRuntime(): CmiRuntime {
  const rt = new CmiRuntime();
  rt.initialize("student-1", "Test Student");
  return rt;
}

/** Helper: build a simple flat org with N items, optional sequencing. */
function flatOrg(
  count: number,
  sequencing?: ManifestOrganization["sequencing"],
  itemOverrides?: Record<number, Partial<Activity>>,
): ManifestOrganization {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    title: `Item ${i + 1}`,
    content: [`slide-${i + 1}.md`],
    ...(itemOverrides?.[i] ?? {}),
  }));
  return {
    id: "org-1",
    title: "Test Org",
    items,
    sequencing,
  };
}

// ── Test 1: Linear navigation ────────────────────────

Deno.test("linear navigation — next/prev works with 3 items", () => {
  const org = flatOrg(3, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
    constrainChoice: false,
    preventActivation: false,
    preconditions: [],
    postconditions: [],
    exitConditions: [],
    objectives: [],
    rollupRules: [],
  });
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  // Start
  const r1 = engine.navigate("start");
  assertEquals(r1.delivered?.id, "item-1");

  // Next
  const r2 = engine.navigate("continue");
  assertEquals(r2.delivered?.id, "item-2");

  // Next
  const r3 = engine.navigate("continue");
  assertEquals(r3.delivered?.id, "item-3");

  // Previous
  const r4 = engine.navigate("previous");
  assertEquals(r4.delivered?.id, "item-2");

  // Previous
  const r5 = engine.navigate("previous");
  assertEquals(r5.delivered?.id, "item-1");
});

// ── Test 2: forwardOnly ──────────────────────────────

Deno.test("forwardOnly — next works, previous rejected", () => {
  const org = flatOrg(3, {
    controlMode: { choice: true, flow: true, forwardOnly: true },
    constrainChoice: false,
    preventActivation: false,
    preconditions: [],
    postconditions: [],
    exitConditions: [],
    objectives: [],
    rollupRules: [],
  });
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  engine.navigate("start");
  const r2 = engine.navigate("continue");
  assertEquals(r2.delivered?.id, "item-2");

  const r3 = engine.navigate("previous");
  assertEquals(r3.delivered, null);
  assertEquals(r3.reason, "Forward-only mode — previous is not allowed");
});

// ── Test 3: choice disabled ──────────────────────────

Deno.test("choice disabled — choice request rejected", () => {
  const org = flatOrg(3, {
    controlMode: { choice: false, flow: true, forwardOnly: false },
    constrainChoice: false,
    preventActivation: false,
    preconditions: [],
    postconditions: [],
    exitConditions: [],
    objectives: [],
    rollupRules: [],
  });
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  engine.navigate("start");
  const r = engine.navigate("choice", "item-3");
  assertEquals(r.delivered, null);
  assertEquals(r.reason, "Choice navigation is disabled");
});

// ── Test 4: preCondition skip ────────────────────────

Deno.test("preCondition skip — item skipped on next", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    sequencing: {
      controlMode: { choice: true, flow: true, forwardOnly: false },
      constrainChoice: false,
      preventActivation: false,
      preconditions: [],
      postconditions: [],
      exitConditions: [],
      objectives: [],
      rollupRules: [],
    },
    items: [
      { id: "item-1", title: "Item 1", content: ["s1.md"] },
      {
        id: "item-2",
        title: "Item 2",
        content: ["s2.md"],
        sequencing: {
          controlMode: { choice: true, flow: true, forwardOnly: false },
          constrainChoice: false,
          preventActivation: false,
          preconditions: [{
            action: "skip",
            conditions: {
              operator: "all",
              rules: [{ condition: "always" }],
            },
          }],
          postconditions: [],
          exitConditions: [],
          objectives: [],
          rollupRules: [],
        },
      },
      { id: "item-3", title: "Item 3", content: ["s3.md"] },
    ],
  };
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  engine.navigate("start"); // delivers item-1
  const r = engine.navigate("continue"); // should skip item-2
  assertEquals(r.delivered?.id, "item-3");
});

// ── Test 5: preCondition disabled ────────────────────

Deno.test("preCondition disabled — choice rejected", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    sequencing: {
      controlMode: { choice: true, flow: true, forwardOnly: false },
      constrainChoice: false,
      preventActivation: false,
      preconditions: [],
      postconditions: [],
      exitConditions: [],
      objectives: [],
      rollupRules: [],
    },
    items: [
      { id: "item-1", title: "Item 1", content: ["s1.md"] },
      {
        id: "item-2",
        title: "Item 2",
        content: ["s2.md"],
        sequencing: {
          controlMode: { choice: true, flow: true, forwardOnly: false },
          constrainChoice: false,
          preventActivation: false,
          preconditions: [{
            action: "disabled",
            conditions: {
              operator: "all",
              rules: [{ condition: "always" }],
            },
          }],
          postconditions: [],
          exitConditions: [],
          objectives: [],
          rollupRules: [],
        },
      },
    ],
  };
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  engine.navigate("start");
  const r = engine.navigate("choice", "item-2");
  assertEquals(r.delivered, null);
  assertNotEquals(r.reason, undefined);
});

// ── Test 6: Rollup all satisfied ─────────────────────

Deno.test("rollup all satisfied — 2 children completed → parent satisfied", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    items: [{
      id: "parent",
      title: "Parent",
      items: [
        { id: "child-1", title: "Child 1", content: ["c1.md"] },
        { id: "child-2", title: "Child 2", content: ["c2.md"] },
      ],
      sequencing: {
        controlMode: { choice: true, flow: true, forwardOnly: false },
        constrainChoice: false,
        preventActivation: false,
        preconditions: [],
        postconditions: [],
        exitConditions: [],
        objectives: [],
        rollupRules: [{
          childActivitySet: "all",
          action: "satisfied",
          conditions: [{ condition: "completed" }],
        }],
      },
    }],
  };
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();

  // tree[0] is the org root, tree[0].children[0] is "parent"
  const parent = tree[0].children[0];
  parent.children[0].progressStatus.completed = true;
  parent.children[1].progressStatus.completed = true;

  rollup(parent.children[0], runtime);

  const status = parent.objectiveStatus.get("primary");
  assertEquals(status?.satisfied, true);
});

// ── Test 7: Rollup any satisfied ─────────────────────

Deno.test("rollup any satisfied — 1 of 2 children completed with 'any' → parent satisfied", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    items: [{
      id: "parent",
      title: "Parent",
      items: [
        { id: "child-1", title: "Child 1", content: ["c1.md"] },
        { id: "child-2", title: "Child 2", content: ["c2.md"] },
      ],
      sequencing: {
        controlMode: { choice: true, flow: true, forwardOnly: false },
        constrainChoice: false,
        preventActivation: false,
        preconditions: [],
        postconditions: [],
        exitConditions: [],
        objectives: [],
        rollupRules: [{
          childActivitySet: "any",
          action: "satisfied",
          conditions: [{ condition: "completed" }],
        }],
      },
    }],
  };
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();

  // tree[0] is the org root, tree[0].children[0] is "parent"
  const parent = tree[0].children[0];
  parent.children[0].progressStatus.completed = true;

  rollup(parent.children[0], runtime);

  const status = parent.objectiveStatus.get("primary");
  assertEquals(status?.satisfied, true);
});

// ── Test 8: Completion percentage ────────────────────

Deno.test("completion percentage — 2 of 4 items completed → 50%", () => {
  const org = flatOrg(4, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
    constrainChoice: false,
    preventActivation: false,
    preconditions: [],
    postconditions: [],
    exitConditions: [],
    objectives: [],
    rollupRules: [],
  });
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  const leaves = allLeaves(tree);
  leaves[0].progressStatus.completed = true;
  leaves[1].progressStatus.completed = true;

  assertEquals(engine.getCompletionPercentage(), 50);
});

// ── Test 9: Start delivers first leaf ────────────────

Deno.test("start delivers first leaf — nested tree", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    items: [{
      id: "chapter-1",
      title: "Chapter 1",
      items: [
        { id: "lesson-1", title: "Lesson 1", content: ["l1.md"] },
        { id: "lesson-2", title: "Lesson 2", content: ["l2.md"] },
      ],
    }, {
      id: "chapter-2",
      title: "Chapter 2",
      items: [
        { id: "lesson-3", title: "Lesson 3", content: ["l3.md"] },
      ],
    }],
  };
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  const r = engine.navigate("start");
  assertEquals(r.delivered?.id, "lesson-1");
});

// ── Test 10: Attempt limit exceeded ──────────────────

Deno.test("attempt limit exceeded — after 1 attempt, further attempts rejected", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    sequencing: {
      controlMode: { choice: true, flow: true, forwardOnly: false },
      constrainChoice: false,
      preventActivation: false,
      preconditions: [],
      postconditions: [],
      exitConditions: [],
      objectives: [],
      rollupRules: [],
    },
    items: [
      {
        id: "item-1",
        title: "Item 1",
        content: ["s1.md"],
        sequencing: {
          controlMode: { choice: true, flow: true, forwardOnly: false },
          constrainChoice: false,
          preventActivation: false,
          preconditions: [{
            action: "disabled",
            conditions: {
              operator: "all",
              rules: [{ condition: "attemptLimitExceeded" }],
            },
          }],
          postconditions: [],
          exitConditions: [],
          objectives: [],
          rollupRules: [],
          limitConditions: { attemptLimit: 1 },
        },
      },
      { id: "item-2", title: "Item 2", content: ["s2.md"] },
    ],
  };
  const tree = buildActivityTree([org]);
  const engine = new SequencingEngine(tree, makeRuntime());

  // First attempt — should succeed
  const r1 = engine.navigate("start");
  assertEquals(r1.delivered?.id, "item-1");

  // Move to item-2
  engine.navigate("continue");

  // Try to go back to item-1 — should be rejected (attempt limit)
  const r3 = engine.navigate("choice", "item-1");
  assertEquals(r3.delivered, null);
  assertNotEquals(r3.reason, undefined);
});
