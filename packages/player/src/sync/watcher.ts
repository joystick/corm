/**
 * RxDB change stream watcher.
 * Watches collections for insert/update/delete events and
 * forwards them to a callback (typically SyncQueueManager.enqueue).
 */

import type { RxCollection } from "rxdb";
import type { CormStore } from "../store/store.ts";

export interface ChangeEvent {
  collectionName: string;
  docId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
}

export interface WatcherOptions {
  store: CormStore;
  onChange: (change: ChangeEvent) => void | Promise<void>;
  /** Which collections to watch (default: all except sync_queue) */
  collections?: string[];
}

export class ChangeStreamWatcher {
  private subscriptions: Array<{ unsubscribe: () => void }> = [];
  private watching = false;
  private readonly options: WatcherOptions;

  constructor(options: WatcherOptions) {
    this.options = options;
  }

  /** Start watching all specified collections for changes. */
  start(): void {
    if (this.watching) return;

    const store = this.options.store;
    const db = store.db;
    const collectionNames = this.options.collections ??
      Object.keys(db.collections).filter((name) => name !== "sync_queue");

    for (const name of collectionNames) {
      const collection: RxCollection = db.collections[name];
      if (!collection) continue;

      const sub = collection.$.subscribe((event) => {
        const op = event.operation;
        if (op === "INSERT" || op === "UPDATE" || op === "DELETE") {
          const docData = event.documentData;
          const primaryKey = collection.schema.primaryPath;
          const docId = String(docData[primaryKey] ?? "");

          this.options.onChange({
            collectionName: name,
            docId,
            operation: op,
            payload: { ...docData },
          });
        }
      });

      this.subscriptions.push(sub);
    }

    this.watching = true;
  }

  /** Stop watching all collections. */
  stop(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
    this.watching = false;
  }

  /** Returns true if currently watching. */
  isWatching(): boolean {
    return this.watching;
  }
}
