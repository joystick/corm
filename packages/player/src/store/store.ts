import {
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxStorage,
} from "rxdb";
import {
  type Attempt,
  attemptSchema,
  type CmiState,
  cmiStateSchema,
  type Enrollment,
  enrollmentSchema,
  type Interaction,
  interactionSchema,
  type SyncQueueItem,
  syncQueueSchema,
} from "./schemas.ts";

export interface CormStore {
  db: RxDatabase;
  enrollments: RxCollection<Enrollment>;
  attempts: RxCollection<Attempt>;
  cmiState: RxCollection<CmiState>;
  interactions: RxCollection<Interaction>;
  syncQueue: RxCollection<SyncQueueItem>;
}

export interface CreateCormStoreOptions {
  name?: string;
  storage?: RxStorage<unknown, unknown>;
}

export async function createCormStore(
  options?: CreateCormStoreOptions,
): Promise<CormStore> {
  let storage: RxStorage<unknown, unknown>;

  if (options?.storage) {
    storage = options.storage;
  } else {
    const { getRxStorageDexie } = await import(
      "rxdb/plugins/storage-dexie"
    );
    storage = getRxStorageDexie();
  }

  const db = await createRxDatabase({
    name: options?.name ?? "corm_player",
    storage,
  });

  const collections = await db.addCollections({
    enrollments: { schema: enrollmentSchema },
    attempts: { schema: attemptSchema },
    cmi_state: { schema: cmiStateSchema },
    interactions: { schema: interactionSchema },
    sync_queue: { schema: syncQueueSchema },
  });

  return {
    db,
    enrollments: collections.enrollments,
    attempts: collections.attempts,
    cmiState: collections.cmi_state,
    interactions: collections.interactions,
    syncQueue: collections.sync_queue,
  };
}
