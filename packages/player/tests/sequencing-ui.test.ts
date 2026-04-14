/**
 * Sequencing–UI Integration Tests
 *
 * Tests the logic that wires the SequencingEngine to UI state,
 * without rendering Lit components (no DOM required).
 */

import { assertEquals } from "@std/assert";
import { CmiRuntime } from "../src/cmi/runtime.ts";
import {
  type Activity,
  allLeaves,
  buildActivityTree,
  type ManifestOrganization,
  SequencingEngine,
} from "../src/sequencing/mod.ts";

/** Helper: create an initialized CmiRuntime. */
function makeRuntime(): CmiRuntime {
  const rt = new CmiRuntime();
  rt.initialize("student-1", "Test Student");
  return rt;
}

/** Helper: build a flat org with N items and optional sequencing overrides. */
function flatOrg(
  count: number,
  sequencing?: ManifestOrganization["sequencing"],
): ManifestOrganization {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    title: `Item ${i + 1}`,
    content: [`slide-${i + 1}.md`],
  }));
  return {
    id: "org-1",
    title: "Test Org",
    items,
    sequencing,
  };
}

// ── Test 1: Start delivers first activity ──────────────

Deno.test("UI integration — start delivers first activity", () => {
  const org = flatOrg(3, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  const result = engine.navigate("start");

  assertEquals(result.delivered?.id, "item-1");
  assertEquals(result.delivered?.title, "Item 1");
  assertEquals(result.reason, undefined);
});

// ── Test 2: Continue delivers second activity ──────────

Deno.test("UI integration — continue delivers second activity", () => {
  const org = flatOrg(3, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  engine.navigate("start");
  const result = engine.navigate("continue");

  assertEquals(result.delivered?.id, "item-2");
});

// ── Test 3: forwardOnly rejects previous ───────────────

Deno.test("UI integration — forwardOnly rejects previous navigation", () => {
  const org = flatOrg(3, {
    controlMode: { choice: true, flow: true, forwardOnly: true },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  engine.navigate("start");
  engine.navigate("continue");
  const result = engine.navigate("previous");

  assertEquals(result.delivered, null);
  assertEquals(result.reason, "Forward-only mode — previous is not allowed");
});

// ── Test 4: Choice delivers specific activity ──────────

Deno.test("UI integration — choice delivers specific activity", () => {
  const org = flatOrg(4, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  engine.navigate("start");
  const result = engine.navigate("choice", "item-3");

  assertEquals(result.delivered?.id, "item-3");
  assertEquals(result.delivered?.title, "Item 3");
});

// ── Test 5: Completion percentage updates ──────────────

Deno.test("UI integration — completion percentage updates after marking items complete", () => {
  const org = flatOrg(4, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  assertEquals(engine.getCompletionPercentage(), 0);

  // Mark 2 of 4 leaves as complete
  const leaves = allLeaves(tree);
  leaves[0].progressStatus.completed = true;
  leaves[1].progressStatus.completed = true;

  assertEquals(engine.getCompletionPercentage(), 50);

  // Mark all complete
  leaves[2].progressStatus.completed = true;
  leaves[3].progressStatus.completed = true;

  assertEquals(engine.getCompletionPercentage(), 100);
});

// ── Test 6: Available activities respects disabled preconditions ──

Deno.test("UI integration — getAvailableActivities respects disabled preconditions", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    sequencing: {
      controlMode: { choice: true, flow: true, forwardOnly: false },
    },
    items: [
      { id: "item-1", title: "Item 1", content: ["s1.md"] },
      {
        id: "item-2",
        title: "Item 2",
        content: ["s2.md"],
        sequencing: {
          preconditions: [{
            action: "disabled",
            conditions: {
              operator: "all",
              rules: [{ condition: "always" }],
            },
          }],
        },
      },
      { id: "item-3", title: "Item 3", content: ["s3.md"] },
    ],
  };
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  const available = engine.getAvailableActivities();
  const availableIds = available.map((a) => a.id);

  // item-2 should be excluded (disabled precondition)
  assertEquals(availableIds.includes("item-1"), true);
  assertEquals(availableIds.includes("item-2"), false);
  assertEquals(availableIds.includes("item-3"), true);
});

// ── Test 7: Available activities excludes hidden items ──

Deno.test("UI integration — getAvailableActivities excludes hidden items", () => {
  const org: ManifestOrganization = {
    id: "org-1",
    title: "Test Org",
    sequencing: {
      controlMode: { choice: true, flow: true, forwardOnly: false },
    },
    items: [
      { id: "item-1", title: "Item 1", content: ["s1.md"] },
      {
        id: "item-2",
        title: "Item 2",
        content: ["s2.md"],
        isVisible: false,
      },
      { id: "item-3", title: "Item 3", content: ["s3.md"] },
    ],
  };
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  const available = engine.getAvailableActivities();
  const availableIds = available.map((a) => a.id);

  assertEquals(availableIds.includes("item-2"), false);
  assertEquals(available.length, 2);
});

// ── Test 8: Navigation result includes available activities ──

Deno.test("UI integration — navigation result includes available activities list", () => {
  const org = flatOrg(3, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  const result = engine.navigate("start");

  // All 3 items should be available
  assertEquals(result.availableActivities.length, 3);
  assertEquals(result.availableActivities[0].id, "item-1");
  assertEquals(result.availableActivities[1].id, "item-2");
  assertEquals(result.availableActivities[2].id, "item-3");
});

// ── Test 9: End-of-course next is rejected ─────────────

Deno.test("UI integration — next at end of course is rejected", () => {
  const org = flatOrg(2, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  engine.navigate("start");
  engine.navigate("continue"); // item-2
  const result = engine.navigate("continue"); // past end

  assertEquals(result.delivered, null);
  assertEquals(result.reason, "No more activities");
});

// ── Test 10: Previous at start is rejected ─────────────

Deno.test("UI integration — previous at start of course is rejected", () => {
  const org = flatOrg(2, {
    controlMode: { choice: true, flow: true, forwardOnly: false },
  });
  const tree = buildActivityTree([org]);
  const runtime = makeRuntime();
  const engine = new SequencingEngine(tree, runtime);

  engine.navigate("start");
  const result = engine.navigate("previous");

  assertEquals(result.delivered, null);
  assertEquals(result.reason, "No previous activity");
});
