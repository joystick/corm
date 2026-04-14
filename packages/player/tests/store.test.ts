import { assertEquals } from "@std/assert";
import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { createCormStore } from "../src/store/mod.ts";

addRxPlugin(RxDBDevModePlugin);

Deno.test("CormStore", async (t) => {
  const store = await createCormStore({
    name: `test_corm_${Date.now()}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });

  await t.step("insert and read enrollment", async () => {
    const now = new Date().toISOString();
    await store.enrollments.insert({
      id: "learner1_course1",
      learnerId: "learner1",
      courseId: "course1",
      status: "enrolled",
      enrolledAt: now,
    });

    const doc = await store.enrollments.findOne("learner1_course1").exec();
    assertEquals(doc!.learnerId, "learner1");
    assertEquals(doc!.courseId, "course1");
    assertEquals(doc!.status, "enrolled");
  });

  await t.step("insert and read attempt", async () => {
    const now = new Date().toISOString();
    await store.attempts.insert({
      id: "enr1_1",
      enrollmentId: "enr1",
      attemptNumber: 1,
      startedAt: now,
      status: "incomplete",
      scoreRaw: 75,
      scoreMax: 100,
    });

    const doc = await store.attempts.findOne("enr1_1").exec();
    assertEquals(doc!.enrollmentId, "enr1");
    assertEquals(doc!.attemptNumber, 1);
    assertEquals(doc!.scoreRaw, 75);
    assertEquals(doc!.status, "incomplete");
  });

  await t.step("insert and update cmi_state", async () => {
    const now = new Date().toISOString();
    await store.cmiState.insert({
      attemptId: "attempt_1",
      lessonLocation: "slide_3",
      lessonStatus: "incomplete",
      updatedAt: now,
    });

    let doc = await store.cmiState.findOne("attempt_1").exec();
    assertEquals(doc!.lessonLocation, "slide_3");
    assertEquals(doc!.lessonStatus, "incomplete");

    await doc!.patch({
      lessonLocation: "slide_7",
      lessonStatus: "completed",
      scoreRaw: 90,
      updatedAt: new Date().toISOString(),
    });

    doc = await store.cmiState.findOne("attempt_1").exec();
    assertEquals(doc!.lessonLocation, "slide_7");
    assertEquals(doc!.lessonStatus, "completed");
    assertEquals(doc!.scoreRaw, 90);
  });

  await t.step("insert interaction with hashChain", async () => {
    const now = new Date().toISOString();
    await store.interactions.insert({
      id: "attempt1_0",
      attemptId: "attempt1",
      index: 0,
      interactionId: "q1",
      type: "choice",
      timestamp: now,
      learnerResponse: "a",
      result: "correct",
      correctResponses: JSON.stringify(["a"]),
      hashChain: "abc123hash",
    });

    const doc = await store.interactions.findOne("attempt1_0").exec();
    assertEquals(doc!.attemptId, "attempt1");
    assertEquals(doc!.type, "choice");
    assertEquals(doc!.hashChain, "abc123hash");
    assertEquals(doc!.result, "correct");
    assertEquals(doc!.correctResponses, JSON.stringify(["a"]));
  });

  await t.step("sync_queue insert and query unsynced", async () => {
    const now = new Date().toISOString();
    await store.syncQueue.bulkInsert([
      {
        id: "sq_1",
        collectionName: "enrollments",
        docId: "e1",
        operation: "INSERT",
        payload: JSON.stringify({ learnerId: "l1" }),
        timestamp: now,
        isSynced: false,
      },
      {
        id: "sq_2",
        collectionName: "attempts",
        docId: "a1",
        operation: "UPDATE",
        payload: JSON.stringify({ status: "completed" }),
        timestamp: now,
        isSynced: true,
      },
      {
        id: "sq_3",
        collectionName: "cmi_state",
        docId: "c1",
        operation: "INSERT",
        payload: JSON.stringify({ lessonLocation: "1" }),
        timestamp: now,
        isSynced: false,
      },
    ]);

    const unsynced = await store.syncQueue.find({
      selector: { isSynced: { $eq: false } },
    }).exec();

    assertEquals(unsynced.length, 2);
    const ids = unsynced.map((d) => d.id).sort();
    assertEquals(ids, ["sq_1", "sq_3"]);
  });

  await store.db.close();
});
