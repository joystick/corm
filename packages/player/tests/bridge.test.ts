import { assertEquals, assertExists } from "@std/assert";
import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { CmiRuntime } from "../src/cmi/runtime.ts";
import { createCormStore } from "../src/store/mod.ts";
import { createBridge } from "../src/bridge.ts";

addRxPlugin(RxDBDevModePlugin);

function makeStorage() {
  return wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
}

let dbCounter = 0;

async function makeStore(name?: string) {
  return createCormStore({
    name: name ?? `testbridge${Date.now()}${++dbCounter}`,
    storage: makeStorage(),
  });
}

Deno.test("Bridge", async (t) => {
  await t.step("CMI persists to RxDB on commit", async () => {
    const store = await makeStore();
    const runtime = new CmiRuntime();
    runtime.initialize("learner-1", "Jane Doe");

    const bridge = await createBridge({
      store,
      runtime,
      learnerId: "learner-1",
      courseId: "course-1",
    });
    await bridge.initialize();

    runtime.setValue("cmi.core.lesson_location", "slide-5");
    runtime.setValue("cmi.core.lesson_status", "incomplete");
    runtime.setValue("cmi.core.score.raw", "72");
    runtime.setValue("cmi.suspend_data", '{"page":5}');
    runtime.commit();

    // Allow async onCommit to complete
    await new Promise((r) => setTimeout(r, 50));

    const cmiDoc = await store.cmiState.findOne(bridge.attemptId).exec();
    assertExists(cmiDoc);
    assertEquals(cmiDoc.lessonLocation, "slide-5");
    assertEquals(cmiDoc.lessonStatus, "incomplete");
    assertEquals(cmiDoc.scoreRaw, 72);
    assertEquals(cmiDoc.suspendData, '{"page":5}');

    await store.db.close();
  });

  await t.step(
    "Resume from previous session with exit=suspend",
    async () => {
      const store = await makeStore();

      // Session 1: set state and suspend
      const rt1 = new CmiRuntime();
      rt1.initialize("learner-1", "Jane Doe");

      const bridge1 = await createBridge({
        store,
        runtime: rt1,
        learnerId: "learner-1",
        courseId: "course-1",
      });
      await bridge1.initialize();

      rt1.setValue("cmi.core.lesson_location", "slide-8");
      rt1.setValue("cmi.core.lesson_status", "incomplete");
      rt1.setValue("cmi.suspend_data", '{"answers":[1,2,3]}');
      rt1.setValue("cmi.core.exit", "suspend");
      rt1.commit();

      // Allow async onCommit to complete
      await new Promise((r) => setTimeout(r, 50));

      assertEquals(bridge1.attemptNumber, 1);

      // Session 2: simulate page reload — new runtime, same store
      const rt2 = new CmiRuntime();
      rt2.initialize("learner-1", "Jane Doe");

      const bridge2 = await createBridge({
        store,
        runtime: rt2,
        learnerId: "learner-1",
        courseId: "course-1",
      });
      await bridge2.initialize();

      assertEquals(bridge2.attemptNumber, 2);

      // Verify state was resumed from suspended session
      assertEquals(rt2.getValue("cmi.core.lesson_location"), "slide-8");
      assertEquals(rt2.getValue("cmi.core.lesson_status"), "incomplete");
      assertEquals(rt2.getValue("cmi.suspend_data"), '{"answers":[1,2,3]}');

      await store.db.close();
    },
  );

  await t.step("Enrollment created on first visit", async () => {
    const store = await makeStore();
    const runtime = new CmiRuntime();
    runtime.initialize("learner-2", "John Smith");

    const bridge = await createBridge({
      store,
      runtime,
      learnerId: "learner-2",
      courseId: "course-2",
    });
    await bridge.initialize();

    const enrollment = await store.enrollments
      .findOne("learner-2_course-2")
      .exec();
    assertExists(enrollment);
    assertEquals(enrollment.learnerId, "learner-2");
    assertEquals(enrollment.courseId, "course-2");
    assertEquals(enrollment.status, "enrolled");

    await store.db.close();
  });

  await t.step(
    "Attempt tracking — first visit attempt 1, second visit attempt 2",
    async () => {
      const store = await makeStore();

      // First visit
      const rt1 = new CmiRuntime();
      rt1.initialize("learner-3", "Alice");

      const bridge1 = await createBridge({
        store,
        runtime: rt1,
        learnerId: "learner-3",
        courseId: "course-3",
      });
      await bridge1.initialize();
      assertEquals(bridge1.attemptNumber, 1);

      rt1.setValue("cmi.core.lesson_status", "incomplete");
      rt1.commit();
      await new Promise((r) => setTimeout(r, 50));

      // Second visit
      const rt2 = new CmiRuntime();
      rt2.initialize("learner-3", "Alice");

      const bridge2 = await createBridge({
        store,
        runtime: rt2,
        learnerId: "learner-3",
        courseId: "course-3",
      });
      await bridge2.initialize();
      assertEquals(bridge2.attemptNumber, 2);

      // Verify both attempts exist in DB
      const attempts = await store.attempts
        .find({ selector: { enrollmentId: "learner-3_course-3" } })
        .exec();
      assertEquals(attempts.length, 2);

      await store.db.close();
    },
  );

  await t.step(
    "Lesson status updates enrollment to completed",
    async () => {
      const store = await makeStore();
      const runtime = new CmiRuntime();
      runtime.initialize("learner-4", "Bob");

      const bridge = await createBridge({
        store,
        runtime,
        learnerId: "learner-4",
        courseId: "course-4",
      });
      await bridge.initialize();

      // Initially enrolled
      let enrollment = await store.enrollments
        .findOne("learner-4_course-4")
        .exec();
      assertEquals(enrollment!.status, "enrolled");

      // Set to incomplete
      runtime.setValue("cmi.core.lesson_status", "incomplete");
      runtime.commit();
      await new Promise((r) => setTimeout(r, 50));

      enrollment = await store.enrollments
        .findOne("learner-4_course-4")
        .exec();
      assertEquals(enrollment!.status, "in_progress");

      // Set to completed
      runtime.setValue("cmi.core.lesson_status", "completed");
      runtime.setValue("cmi.core.score.raw", "95");
      runtime.commit();
      await new Promise((r) => setTimeout(r, 50));

      enrollment = await store.enrollments
        .findOne("learner-4_course-4")
        .exec();
      assertEquals(enrollment!.status, "completed");
      assertExists(enrollment!.completedAt);

      // Verify attempt score was updated too
      const attempt = await store.attempts
        .findOne(bridge.attemptId)
        .exec();
      assertEquals(attempt!.scoreRaw, 95);
      assertEquals(attempt!.status, "completed");

      await store.db.close();
    },
  );
});
