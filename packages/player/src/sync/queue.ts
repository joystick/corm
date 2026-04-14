/**
 * Outbound sync queue manager.
 * Drains pending changes from RxDB sync_queue and publishes via MQTT,
 * chunking payloads that exceed the 128KB limit.
 */

import type { CormStore } from "../store/store.ts";
import type { MqttClient } from "./mqtt-client.ts";
import { chunkMessage, MAX_PACKET_SIZE, serializeChunk } from "./chunker.ts";

export interface SyncQueueOptions {
  store: CormStore;
  mqtt: MqttClient;
  courseId: string;
  learnerId: string;
  maxRetries?: number;
  batchSize?: number;
}

export class SyncQueueManager {
  private store: CormStore;
  private mqtt: MqttClient;
  private courseId: string;
  private learnerId: string;
  private maxRetries: number;
  private batchSize: number;
  private drainTimer: number | undefined;

  constructor(options: SyncQueueOptions) {
    this.store = options.store;
    this.mqtt = options.mqtt;
    this.courseId = options.courseId;
    this.learnerId = options.learnerId;
    this.maxRetries = options.maxRetries ?? 3;
    this.batchSize = options.batchSize ?? 10;
  }

  /** Enqueue a change into the sync_queue collection. */
  async enqueue(change: {
    collectionName: string;
    docId: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.store.syncQueue.insert({
      id: crypto.randomUUID(),
      collectionName: change.collectionName,
      docId: change.docId,
      operation: change.operation,
      payload: JSON.stringify(change.payload),
      timestamp: new Date().toISOString(),
      isSynced: false,
    });
  }

  /**
   * Drain the queue: send all pending (unsynced) items via MQTT.
   * Returns counts of sent and failed items.
   */
  async drain(): Promise<{ sent: number; failed: number }> {
    if (!this.mqtt.isConnected()) {
      return { sent: 0, failed: 0 };
    }

    const unsynced = await this.store.syncQueue.find({
      selector: { isSynced: { $eq: false } },
      limit: this.batchSize,
    }).exec();

    if (unsynced.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const topic = `corm/${this.courseId}/${this.learnerId}/sync`;

    // Build the batch payload
    const batchData = unsynced.map((doc) => ({
      id: doc.id,
      collectionName: doc.collectionName,
      docId: doc.docId,
      operation: doc.operation,
      payload: doc.payload,
      timestamp: doc.timestamp,
    }));

    const payloadBytes = new TextEncoder().encode(JSON.stringify(batchData));

    try {
      if (payloadBytes.length > MAX_PACKET_SIZE) {
        // Chunk the payload
        const chunks = chunkMessage(topic, payloadBytes);
        for (const chunk of chunks) {
          await this.mqtt.publish({
            topic,
            payload: serializeChunk(chunk),
            qos: 1,
          });
        }
      } else {
        await this.mqtt.publish({
          topic,
          payload: payloadBytes,
          qos: 1,
        });
      }

      // Mark all as synced
      for (const doc of unsynced) {
        await doc.patch({ isSynced: true });
      }
      sent = unsynced.length;
    } catch {
      failed = unsynced.length;
    }

    return { sent, failed };
  }

  /** Get count of pending (unsynced) items. */
  async getPendingCount(): Promise<number> {
    const docs = await this.store.syncQueue.find({
      selector: { isSynced: { $eq: false } },
    }).exec();
    return docs.length;
  }

  /** Start auto-drain on an interval (ms). Default: 30s. */
  startAutoDrain(intervalMs = 30_000): void {
    this.stopAutoDrain();
    this.drainTimer = setInterval(() => {
      if (this.mqtt.isConnected()) {
        this.drain().catch(() => {
          // swallow — will retry next interval
        });
      }
    }, intervalMs) as unknown as number;
  }

  /** Stop auto-drain. */
  stopAutoDrain(): void {
    if (this.drainTimer !== undefined) {
      clearInterval(this.drainTimer);
      this.drainTimer = undefined;
    }
  }
}
