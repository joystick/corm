import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { createCormStore } from "../src/store/mod.ts";
import { HashChain } from "../src/audit/hash-chain.ts";
import { AuditLogger } from "../src/audit/logger.ts";
import { ProctoringMonitor } from "../src/audit/proctoring.ts";

addRxPlugin(RxDBDevModePlugin);

function makeStore() {
  return createCormStore({
    name: `test_audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
}

// ---------------------------------------------------------------------------
// HashChain
// ---------------------------------------------------------------------------

Deno.test("HashChain - append produces unique advancing hashes", async () => {
  const chain = new HashChain();

  const h1 = await chain.append({
    interactionId: "q1",
    type: "choice",
    learnerResponse: "a",
    result: "correct",
    timestamp: "2026-01-01T00:00:00Z",
  });

  const h2 = await chain.append({
    interactionId: "q2",
    type: "choice",
    learnerResponse: "b",
    result: "incorrect",
    timestamp: "2026-01-01T00:01:00Z",
  });

  const h3 = await chain.append({
    interactionId: "q3",
    type: "true-false",
    learnerResponse: "true",
    result: "correct",
    timestamp: "2026-01-01T00:02:00Z",
  });

  // All hashes are different
  assertNotEquals(h1, h2);
  assertNotEquals(h2, h3);
  assertNotEquals(h1, h3);

  // Chain head is the last hash
  assertEquals(chain.getHead(), h3);

  // Each hash is 64 hex chars (SHA-256)
  assertEquals(h1.length, 64);
});

Deno.test("HashChain - verify valid chain", async () => {
  const chain = new HashChain();

  const interactions = [
    {
      interactionId: "q1",
      type: "choice",
      learnerResponse: "a",
      result: "correct",
      timestamp: "2026-01-01T00:00:00Z",
      hashChain: "",
    },
    {
      interactionId: "q2",
      type: "choice",
      learnerResponse: "c",
      result: "incorrect",
      timestamp: "2026-01-01T00:01:00Z",
      hashChain: "",
    },
    {
      interactionId: "q3",
      type: "true-false",
      learnerResponse: "true",
      result: "correct",
      timestamp: "2026-01-01T00:02:00Z",
      hashChain: "",
    },
  ];

  for (const ix of interactions) {
    ix.hashChain = await chain.append(ix);
  }

  const result = await HashChain.verify(interactions);
  assertEquals(result.valid, true);
  assertEquals(result.brokenAt, undefined);
});

Deno.test("HashChain - verify tampered chain", async () => {
  const chain = new HashChain();

  const interactions = [
    {
      interactionId: "q1",
      type: "choice",
      learnerResponse: "a",
      result: "correct",
      timestamp: "2026-01-01T00:00:00Z",
      hashChain: "",
    },
    {
      interactionId: "q2",
      type: "choice",
      learnerResponse: "c",
      result: "incorrect",
      timestamp: "2026-01-01T00:01:00Z",
      hashChain: "",
    },
    {
      interactionId: "q3",
      type: "true-false",
      learnerResponse: "true",
      result: "correct",
      timestamp: "2026-01-01T00:02:00Z",
      hashChain: "",
    },
  ];

  for (const ix of interactions) {
    ix.hashChain = await chain.append(ix);
  }

  // Tamper with the second interaction
  interactions[1].result = "correct";

  const result = await HashChain.verify(interactions);
  assertEquals(result.valid, false);
  assertEquals(result.brokenAt, 1);
});

// ---------------------------------------------------------------------------
// AuditLogger
// ---------------------------------------------------------------------------

Deno.test({
  name: "AuditLogger - logs to RxDB",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const store = await makeStore();

    const logger = new AuditLogger({ store, attemptId: "att_1" });

    const hash = await logger.logInteraction({
      interactionId: "q1",
      type: "choice",
      learnerResponse: "b",
      result: "incorrect",
      latency: "PT12S",
      description: "Capital of France",
      correctResponses: ["a"],
      timestamp: "2026-01-01T00:00:00Z",
    });

    assertEquals(hash.length, 64);

    const doc = await store.interactions.findOne("att_1_0").exec();
    assert(doc !== null);
    assertEquals(doc!.attemptId, "att_1");
    assertEquals(doc!.interactionId, "q1");
    assertEquals(doc!.type, "choice");
    assertEquals(doc!.learnerResponse, "b");
    assertEquals(doc!.result, "incorrect");
    assertEquals(doc!.latency, "PT12S");
    assertEquals(doc!.description, "Capital of France");
    assertEquals(doc!.correctResponses, JSON.stringify(["a"]));
    assertEquals(doc!.hashChain, hash);

    await store.db.close();
  },
});

Deno.test({
  name: "AuditLogger - resume continues chain",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const store = await makeStore();

    // First session: log 2 interactions
    const logger1 = new AuditLogger({ store, attemptId: "att_resume" });
    const h1 = await logger1.logInteraction({
      interactionId: "q1",
      type: "choice",
      learnerResponse: "a",
      result: "correct",
      latency: "PT5S",
      timestamp: "2026-01-01T00:00:00Z",
    });
    const h2 = await logger1.logInteraction({
      interactionId: "q2",
      type: "choice",
      learnerResponse: "c",
      result: "incorrect",
      latency: "PT8S",
      timestamp: "2026-01-01T00:01:00Z",
    });

    // Second session: resume and log 3rd
    const logger2 = new AuditLogger({ store, attemptId: "att_resume" });
    await logger2.initialize();

    const h3 = await logger2.logInteraction({
      interactionId: "q3",
      type: "true-false",
      learnerResponse: "true",
      result: "correct",
      latency: "PT3S",
      timestamp: "2026-01-01T00:02:00Z",
    });

    // h3 should be different from h1 and h2
    assertNotEquals(h3, h1);
    assertNotEquals(h3, h2);

    // Verify the whole chain is valid
    const result = await logger2.verify();
    assertEquals(result.valid, true);

    // Check doc id is att_resume_2 (third interaction)
    const doc = await store.interactions.findOne("att_resume_2").exec();
    assert(doc !== null);
    assertEquals(doc!.interactionId, "q3");
    assertEquals(doc!.hashChain, h3);

    await store.db.close();
  },
});

Deno.test({
  name: "AuditLogger - verify returns valid",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const store = await makeStore();
    const logger = new AuditLogger({ store, attemptId: "att_verify" });

    await logger.logInteraction({
      interactionId: "q1",
      type: "choice",
      learnerResponse: "a",
      result: "correct",
      latency: "PT5S",
      timestamp: "2026-01-01T00:00:00Z",
    });
    await logger.logInteraction({
      interactionId: "q2",
      type: "choice",
      learnerResponse: "b",
      result: "incorrect",
      latency: "PT6S",
      timestamp: "2026-01-01T00:01:00Z",
    });
    await logger.logInteraction({
      interactionId: "q3",
      type: "true-false",
      learnerResponse: "false",
      result: "correct",
      latency: "PT4S",
      timestamp: "2026-01-01T00:02:00Z",
    });

    const result = await logger.verify();
    assertEquals(result.valid, true);
    assertEquals(result.brokenAt, undefined);

    await store.db.close();
  },
});

// ---------------------------------------------------------------------------
// Proctoring
// ---------------------------------------------------------------------------

Deno.test("ProctoringMonitor - none tier needs no acknowledgment", () => {
  const monitor = new ProctoringMonitor("none");
  assertEquals(monitor.needsAcknowledgment(), false);
});

Deno.test("ProctoringMonitor - honor tier requires acknowledgment", () => {
  const monitor = new ProctoringMonitor("honor");
  assertEquals(monitor.needsAcknowledgment(), true);

  monitor.acknowledge();
  assertEquals(monitor.needsAcknowledgment(), false);
});

Deno.test("ProctoringMonitor - question timing", () => {
  const monitor = new ProctoringMonitor("honor");
  monitor.acknowledge();

  monitor.startQuestion("q1");

  // Small busy-wait to ensure non-zero duration
  const start = Date.now();
  while (Date.now() - start < 5) { /* spin */ }

  const timing = monitor.stopQuestion();
  assert(timing !== null);
  assertEquals(timing!.interactionId, "q1");
  assert(timing!.durationMs > 0);
  assert(timing!.startedAt.length > 0);
  assert(timing!.submittedAt.length > 0);
});

Deno.test("ProctoringMonitor - total assessment duration", () => {
  const monitor = new ProctoringMonitor("honor");
  monitor.acknowledge();

  // Simulate 3 questions with known timings
  for (const id of ["q1", "q2", "q3"]) {
    monitor.startQuestion(id);
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    monitor.stopQuestion();
  }

  const timings = monitor.getTimings();
  assertEquals(timings.length, 3);

  const total = monitor.getTotalDuration();
  const sum = timings.reduce((s, t) => s + t.durationMs, 0);
  assertEquals(total, sum);
  assert(total > 0);
});
