import { assertEquals } from "@std/assert";
import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { createCormStore } from "../src/store/mod.ts";
import { ChangeStreamWatcher } from "../src/sync/watcher.ts";
import type { ChangeEvent } from "../src/sync/watcher.ts";
import { ContentSyncClient } from "../src/sync/content-sync.ts";
import type { ContentManifest } from "../src/sync/content-sync.ts";
import { SyncCoordinator } from "../src/sync/coordinator.ts";
import { MockMqttClient } from "../src/sync/mock-mqtt.ts";

addRxPlugin(RxDBDevModePlugin);

async function makeStore(suffix: string) {
  return createCormStore({
    name: `test_sync_watcher_${suffix}_${Date.now()}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
}

Deno.test("ChangeStreamWatcher", async (t) => {
  await t.step("detects insert", async () => {
    const store = await makeStore("insert");
    const events: ChangeEvent[] = [];

    const watcher = new ChangeStreamWatcher({
      store,
      onChange: (change) => {
        events.push(change);
      },
    });
    watcher.start();

    // Small delay to let subscription settle
    await new Promise((r) => setTimeout(r, 50));

    await store.enrollments.insert({
      id: "e1",
      learnerId: "l1",
      courseId: "c1",
      status: "enrolled",
      enrolledAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 100));

    const insertEvents = events.filter((e) => e.operation === "INSERT");
    assertEquals(insertEvents.length >= 1, true);
    assertEquals(insertEvents[0].collectionName, "enrollments");
    assertEquals(insertEvents[0].docId, "e1");
    assertEquals(insertEvents[0].operation, "INSERT");

    watcher.stop();
    await store.db.close();
  });

  await t.step("detects update", async () => {
    const store = await makeStore("update");
    const events: ChangeEvent[] = [];

    const watcher = new ChangeStreamWatcher({
      store,
      onChange: (change) => {
        events.push(change);
      },
    });

    // Insert first, before starting watcher
    await store.enrollments.insert({
      id: "e2",
      learnerId: "l2",
      courseId: "c2",
      status: "enrolled",
      enrolledAt: new Date().toISOString(),
    });

    watcher.start();
    await new Promise((r) => setTimeout(r, 50));

    // Now update
    const doc = await store.enrollments.findOne("e2").exec();
    await doc!.patch({ status: "in_progress" });

    await new Promise((r) => setTimeout(r, 100));

    const updateEvents = events.filter((e) => e.operation === "UPDATE");
    assertEquals(updateEvents.length >= 1, true);
    assertEquals(updateEvents[0].collectionName, "enrollments");
    assertEquals(updateEvents[0].docId, "e2");
    assertEquals(updateEvents[0].operation, "UPDATE");

    watcher.stop();
    await store.db.close();
  });

  await t.step("ignores sync_queue collection", async () => {
    const store = await makeStore("ignore_sq");
    const events: ChangeEvent[] = [];

    const watcher = new ChangeStreamWatcher({
      store,
      onChange: (change) => {
        events.push(change);
      },
    });
    watcher.start();
    await new Promise((r) => setTimeout(r, 50));

    // Insert into sync_queue — should NOT trigger onChange
    await store.syncQueue.insert({
      id: "sq1",
      collectionName: "enrollments",
      docId: "e1",
      operation: "INSERT",
      payload: JSON.stringify({ foo: "bar" }),
      timestamp: new Date().toISOString(),
      isSynced: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const sqEvents = events.filter((e) => e.collectionName === "sync_queue");
    assertEquals(sqEvents.length, 0);

    watcher.stop();
    await store.db.close();
  });

  await t.step("stop prevents further events", async () => {
    const store = await makeStore("stop");
    const events: ChangeEvent[] = [];

    const watcher = new ChangeStreamWatcher({
      store,
      onChange: (change) => {
        events.push(change);
      },
    });
    watcher.start();
    await new Promise((r) => setTimeout(r, 50));

    watcher.stop();
    assertEquals(watcher.isWatching(), false);

    await store.enrollments.insert({
      id: "e3",
      learnerId: "l3",
      courseId: "c3",
      status: "enrolled",
      enrolledAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 100));

    assertEquals(events.length, 0);
    await store.db.close();
  });
});

Deno.test("ContentSyncClient", async (t) => {
  await t.step("diff — new files", () => {
    const client = new ContentSyncClient({ courseId: "c1" });
    // No local manifest set → all remote files are "add"

    const remote: ContentManifest = {
      courseId: "c1",
      version: "1.0",
      files: [
        { path: "slide1.md", checksum: "abc", size: 100 },
        { path: "slide2.md", checksum: "def", size: 200 },
      ],
    };

    const diff = client.diff(remote);
    assertEquals(diff.length, 2);
    assertEquals(diff[0].action, "add");
    assertEquals(diff[1].action, "add");
  });

  await t.step("diff — updated file", () => {
    const client = new ContentSyncClient({ courseId: "c1" });
    client.setLocalManifest({
      courseId: "c1",
      version: "1.0",
      files: [{ path: "slide1.md", checksum: "abc", size: 100 }],
    });

    const remote: ContentManifest = {
      courseId: "c1",
      version: "1.1",
      files: [{ path: "slide1.md", checksum: "xyz", size: 150 }],
    };

    const diff = client.diff(remote);
    assertEquals(diff.length, 1);
    assertEquals(diff[0].action, "update");
    assertEquals(diff[0].path, "slide1.md");
    assertEquals(diff[0].checksum, "xyz");
  });

  await t.step("diff — deleted file", () => {
    const client = new ContentSyncClient({ courseId: "c1" });
    client.setLocalManifest({
      courseId: "c1",
      version: "1.0",
      files: [
        { path: "slide1.md", checksum: "abc", size: 100 },
        { path: "removed.md", checksum: "old", size: 50 },
      ],
    });

    const remote: ContentManifest = {
      courseId: "c1",
      version: "1.1",
      files: [{ path: "slide1.md", checksum: "abc", size: 100 }],
    };

    const diff = client.diff(remote);
    assertEquals(diff.length, 1);
    assertEquals(diff[0].action, "delete");
    assertEquals(diff[0].path, "removed.md");
  });

  await t.step("diff — no changes", () => {
    const client = new ContentSyncClient({ courseId: "c1" });
    const manifest: ContentManifest = {
      courseId: "c1",
      version: "1.0",
      files: [
        { path: "slide1.md", checksum: "abc", size: 100 },
        { path: "slide2.md", checksum: "def", size: 200 },
      ],
    };
    client.setLocalManifest(manifest);

    const diff = client.diff(manifest);
    assertEquals(diff.length, 0);
  });
});

Deno.test("SyncCoordinator", async (t) => {
  await t.step("start sets watching=true, connected=true", async () => {
    const store = await makeStore("coord_start");
    const mqtt = new MockMqttClient();

    const coordinator = new SyncCoordinator({
      store,
      courseId: "c1",
      learnerId: "l1",
      mqtt,
      drainIntervalMs: 60_000, // long interval so no auto-drain fires during test
    });

    await coordinator.start();

    const status = await coordinator.getStatus();
    assertEquals(status.watching, true);
    assertEquals(status.connected, true);

    await coordinator.stop();
    await store.db.close();
  });

  await t.step("stop sets watching=false, connected=false", async () => {
    const store = await makeStore("coord_stop");
    const mqtt = new MockMqttClient();

    const coordinator = new SyncCoordinator({
      store,
      courseId: "c1",
      learnerId: "l1",
      mqtt,
      drainIntervalMs: 60_000,
    });

    await coordinator.start();
    await coordinator.stop();

    const status = await coordinator.getStatus();
    assertEquals(status.watching, false);
    assertEquals(status.connected, false);

    await store.db.close();
  });
});
