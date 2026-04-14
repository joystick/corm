import { assertEquals, assertGreater } from "@std/assert";
import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { createCormStore } from "../src/store/mod.ts";
import {
  chunkMessage,
  ChunkReassembler,
  deserializeChunk,
  MAX_PAYLOAD_SIZE,
  serializeChunk,
} from "../src/sync/chunker.ts";
import { MockMqttClient } from "../src/sync/mock-mqtt.ts";
import { SyncQueueManager } from "../src/sync/queue.ts";

addRxPlugin(RxDBDevModePlugin);

// ---------------------------------------------------------------------------
// Chunking tests
// ---------------------------------------------------------------------------

Deno.test("Chunker", async (t) => {
  await t.step("small message (< 128KB) produces 1 chunk", () => {
    const payload = new Uint8Array(1000);
    const chunks = chunkMessage("test/topic", payload);
    assertEquals(chunks.length, 1);
    assertEquals(chunks[0].header.chunkIndex, 0);
    assertEquals(chunks[0].header.totalChunks, 1);
    assertEquals(chunks[0].header.topic, "test/topic");
  });

  await t.step("large message (256KB) produces multiple chunks", () => {
    const payload = new Uint8Array(256 * 1024);
    const chunks = chunkMessage("test/topic", payload);
    // 256KB = 262144 bytes, MAX_PAYLOAD_SIZE = 131008, so ceil(262144/131008) = 3
    const expected = Math.ceil(payload.length / MAX_PAYLOAD_SIZE);
    assertEquals(chunks.length, expected);
    assertGreater(chunks.length, 1);
    assertEquals(chunks[0].header.totalChunks, expected);
    assertEquals(chunks[chunks.length - 1].header.chunkIndex, expected - 1);
  });

  await t.step(
    "very large message (500KB) produces correct chunk count",
    () => {
      const payload = new Uint8Array(500 * 1024);
      const chunks = chunkMessage("test/topic", payload);
      const expected = Math.ceil(payload.length / MAX_PAYLOAD_SIZE);
      assertEquals(chunks.length, expected);
      assertGreater(chunks.length, 3);
    },
  );

  await t.step(
    "chunk + reassemble round-trip recovers original payload",
    () => {
      // Fill with non-zero data
      const original = new Uint8Array(300_000);
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256;
      }

      const chunks = chunkMessage("roundtrip", original);
      const reassembler = new ChunkReassembler();

      let result: Uint8Array | null = null;
      for (const chunk of chunks) {
        result = reassembler.addChunk(chunk);
      }

      assertEquals(result !== null, true);
      assertEquals(result!.length, original.length);
      assertEquals(result!, original);
    },
  );

  await t.step("out-of-order chunks reassembled correctly", () => {
    const original = new Uint8Array(300_000);
    for (let i = 0; i < original.length; i++) {
      original[i] = (i * 7) % 256;
    }

    const chunks = chunkMessage("ooo", original);
    // Reverse order
    const reversed = [...chunks].reverse();

    const reassembler = new ChunkReassembler();
    let result: Uint8Array | null = null;
    for (const chunk of reversed) {
      result = reassembler.addChunk(chunk);
    }

    assertEquals(result !== null, true);
    assertEquals(result!, original);
  });

  await t.step(
    "chunk header contains correct messageId, index, totalChunks",
    () => {
      const payload = new Uint8Array(200_000);
      const chunks = chunkMessage("header/test", payload);

      const messageId = chunks[0].header.messageId;
      for (let i = 0; i < chunks.length; i++) {
        assertEquals(chunks[i].header.messageId, messageId);
        assertEquals(chunks[i].header.chunkIndex, i);
        assertEquals(chunks[i].header.totalChunks, chunks.length);
        assertEquals(chunks[i].header.topic, "header/test");
      }
    },
  );

  await t.step("serialize/deserialize round-trip", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const chunks = chunkMessage("serde", original);
    const serialized = serializeChunk(chunks[0]);
    const deserialized = deserializeChunk(serialized);

    assertEquals(deserialized.header.messageId, chunks[0].header.messageId);
    assertEquals(deserialized.header.topic, "serde");
    assertEquals(deserialized.payload, original);
  });
});

// ---------------------------------------------------------------------------
// Queue tests (with MockMqttClient + RxDB in-memory)
// ---------------------------------------------------------------------------

Deno.test("SyncQueueManager", async (t) => {
  const store = await createCormStore({
    name: `test_sync_${Date.now()}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });

  const mqtt = new MockMqttClient();
  await mqtt.connect();

  const queue = new SyncQueueManager({
    store,
    mqtt,
    courseId: "course42",
    learnerId: "learner7",
  });

  await t.step("enqueue adds item to sync_queue collection", async () => {
    await queue.enqueue({
      collectionName: "enrollments",
      docId: "e1",
      operation: "INSERT",
      payload: { learnerId: "l1", courseId: "c1" },
    });

    const count = await queue.getPendingCount();
    assertEquals(count, 1);
  });

  await t.step(
    "drain sends items via MQTT and marks as synced",
    async () => {
      const result = await queue.drain();
      assertEquals(result.sent, 1);
      assertEquals(result.failed, 0);

      const published = mqtt.getPublished();
      assertGreater(published.length, 0);
      assertEquals(
        published[published.length - 1].topic,
        "corm/course42/learner7/sync",
      );

      const pending = await queue.getPendingCount();
      assertEquals(pending, 0);
    },
  );

  await t.step(
    "drain with disconnected client leaves items in queue",
    async () => {
      // Enqueue a new item
      await queue.enqueue({
        collectionName: "attempts",
        docId: "a1",
        operation: "UPDATE",
        payload: { status: "completed" },
      });

      mqtt.simulateDisconnect();

      const result = await queue.drain();
      assertEquals(result.sent, 0);
      assertEquals(result.failed, 0);

      const pending = await queue.getPendingCount();
      assertEquals(pending, 1);

      // Reconnect for subsequent tests
      mqtt.simulateReconnect();
    },
  );

  await t.step("getPendingCount returns correct count", async () => {
    // We already have 1 pending from the previous step
    await queue.enqueue({
      collectionName: "cmi_state",
      docId: "c1",
      operation: "INSERT",
      payload: { lessonLocation: "slide_1" },
    });

    const count = await queue.getPendingCount();
    assertEquals(count, 2);

    // Drain them
    await queue.drain();
    const afterDrain = await queue.getPendingCount();
    assertEquals(afterDrain, 0);
  });

  await t.step(
    "drain with large payload chunks the published messages",
    async () => {
      mqtt.clearPublished();

      // Create a payload large enough to require chunking
      const bigData: Record<string, string> = {};
      for (let i = 0; i < 5000; i++) {
        bigData[`key_${i}`] = "x".repeat(100);
      }

      await queue.enqueue({
        collectionName: "interactions",
        docId: "big1",
        operation: "INSERT",
        payload: bigData,
      });

      const result = await queue.drain();
      assertEquals(result.sent, 1);
      assertEquals(result.failed, 0);

      // Should have published multiple chunks
      const published = mqtt.getPublished();
      assertGreater(published.length, 1);

      // All chunks should be on the sync topic
      for (const msg of published) {
        assertEquals(msg.topic, "corm/course42/learner7/sync");
      }
    },
  );

  await store.db.close();
});
