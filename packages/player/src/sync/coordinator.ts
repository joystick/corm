/**
 * Sync coordinator — ties together the change stream watcher,
 * sync queue manager, MQTT transport, and content sync.
 */

import type { CormStore } from "../store/store.ts";
import type { MqttClient } from "./mqtt-client.ts";
import { SyncQueueManager } from "./queue.ts";
import { ChangeStreamWatcher } from "./watcher.ts";
import {
  type ContentDiffEntry,
  type ContentManifest,
  ContentSyncClient,
} from "./content-sync.ts";

export interface SyncCoordinatorOptions {
  store: CormStore;
  courseId: string;
  learnerId: string;
  mqtt: MqttClient;
  /** Auto-drain interval in ms (default: 30000) */
  drainIntervalMs?: number;
  /** Max retries per batch (passed to SyncQueueManager) */
  maxRetries?: number;
  /** Batch size for drain (passed to SyncQueueManager) */
  batchSize?: number;
}

export interface SyncStatus {
  connected: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  watching: boolean;
}

export class SyncCoordinator {
  private watcher: ChangeStreamWatcher;
  private queueManager: SyncQueueManager;
  private contentSync: ContentSyncClient;
  private mqtt: MqttClient;
  private lastSyncAt: string | null = null;
  private started = false;
  private readonly drainIntervalMs: number;

  constructor(options: SyncCoordinatorOptions) {
    this.mqtt = options.mqtt;
    this.drainIntervalMs = options.drainIntervalMs ?? 30_000;

    this.queueManager = new SyncQueueManager({
      store: options.store,
      mqtt: options.mqtt,
      courseId: options.courseId,
      learnerId: options.learnerId,
      maxRetries: options.maxRetries,
      batchSize: options.batchSize,
    });

    this.contentSync = new ContentSyncClient({
      courseId: options.courseId,
    });

    this.watcher = new ChangeStreamWatcher({
      store: options.store,
      onChange: async (change) => {
        await this.queueManager.enqueue(change);
      },
    });
  }

  /** Start syncing — connect MQTT, start watching, start auto-drain. */
  async start(): Promise<void> {
    if (this.started) return;

    await this.mqtt.connect();
    this.watcher.start();
    this.queueManager.startAutoDrain(this.drainIntervalMs);

    this.started = true;
  }

  /** Stop syncing — disconnect, stop watching, stop drain. */
  async stop(): Promise<void> {
    if (!this.started) return;

    this.watcher.stop();
    this.queueManager.stopAutoDrain();
    await this.mqtt.disconnect();

    this.started = false;
  }

  /** Force drain the queue now. */
  async forceDrain(): Promise<{ sent: number; failed: number }> {
    const result = await this.queueManager.drain();
    if (result.sent > 0) {
      this.lastSyncAt = new Date().toISOString();
    }
    return result;
  }

  /** Get current sync status. */
  async getStatus(): Promise<SyncStatus> {
    const pendingCount = await this.queueManager.getPendingCount();

    return {
      connected: this.mqtt.isConnected(),
      pendingCount,
      lastSyncAt: this.lastSyncAt,
      watching: this.watcher.isWatching(),
    };
  }

  /** Check for content updates against a remote manifest. */
  async checkContentUpdates(
    remoteManifest: ContentManifest,
  ): Promise<Array<{ path: string; action: "add" | "update" | "delete" }>> {
    const diff = this.contentSync.diff(remoteManifest);
    return diff.map((d: ContentDiffEntry) => ({
      path: d.path,
      action: d.action,
    }));
  }

  /** Access the content sync client for manifest management. */
  getContentSync(): ContentSyncClient {
    return this.contentSync;
  }

  /** Access the queue manager directly. */
  getQueueManager(): SyncQueueManager {
    return this.queueManager;
  }
}
