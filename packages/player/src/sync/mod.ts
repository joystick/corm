// Change stream watcher (Phase 5.2)
export { ChangeStreamWatcher } from "./watcher.ts";
export type { ChangeEvent, WatcherOptions } from "./watcher.ts";

// Content delta sync (Phase 5.2)
export { ContentSyncClient } from "./content-sync.ts";
export type {
  ContentDiffEntry,
  ContentManifest,
  ContentManifestFile,
  ContentSyncOptions,
} from "./content-sync.ts";

// Sync coordinator (Phase 5.2)
export { SyncCoordinator } from "./coordinator.ts";
export type { SyncCoordinatorOptions, SyncStatus } from "./coordinator.ts";

// MQTT client abstraction (Phase 5.1)
export type {
  MqttClient,
  MqttClientOptions,
  MqttMessage,
} from "./mqtt-client.ts";
export { createMqttClient } from "./mqtt-client.ts";

// Mock MQTT client for testing (Phase 5.1)
export { MockMqttClient } from "./mock-mqtt.ts";

// Message chunker (Phase 5.1)
export type { Chunk, ChunkHeader } from "./chunker.ts";
export {
  chunkMessage,
  ChunkReassembler,
  deserializeChunk,
  HEADER_SIZE,
  MAX_PACKET_SIZE,
  MAX_PAYLOAD_SIZE,
  serializeChunk,
} from "./chunker.ts";

// Sync queue manager (Phase 5.1)
export type { SyncQueueOptions } from "./queue.ts";
export { SyncQueueManager } from "./queue.ts";
