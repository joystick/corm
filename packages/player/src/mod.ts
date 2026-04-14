export { CormPlayer } from "./components/corm-player.ts";
export { CormNav } from "./components/corm-nav.ts";
export { CormContent } from "./components/corm-content.ts";
export { CormControls } from "./components/corm-controls.ts";
export { CormScoFrame } from "./components/corm-sco-frame.ts";
export { CormStatus } from "./components/corm-status.ts";
export { renderMarkdown } from "./renderer.ts";

// Content detection
export { detectContentType, resolveContent } from "./content/mod.ts";
export type { ContentInfo, ContentType } from "./content/mod.ts";
export { createBridge } from "./bridge.ts";
export type { Bridge, BridgeOptions } from "./bridge.ts";

// Sequencing engine
export type {
  Activity,
  ActivitySequencing,
  ControlModeInput,
  ManifestItem,
  ManifestOrganization,
  NavigationRequest,
  NavigationResult,
} from "./sequencing/mod.ts";
export {
  allLeaves,
  buildActivityTree,
  evaluateConditionSet,
  findActivity,
  firstLeaf,
  rollup,
  SequencingEngine,
} from "./sequencing/mod.ts";

// Assessment engine
export type {
  InteractionDefinition,
  InteractionOption,
  InteractionResponse,
  InteractionResult,
  InteractionResultValue,
  InteractionType,
} from "./assessment/mod.ts";
export { AssessmentSession, scoreInteraction } from "./assessment/mod.ts";

// SCORM API shim
export { installScormShim, Scorm12API, Scorm2004API } from "./shim/mod.ts";
export type { InstalledShim, ShimOptions } from "./shim/mod.ts";

// Sync transport (Phase 5.1)
export type {
  Chunk,
  ChunkHeader,
  MqttClient,
  MqttClientOptions,
  MqttMessage,
  SyncQueueOptions,
} from "./sync/mod.ts";
export {
  chunkMessage,
  ChunkReassembler,
  createMqttClient,
  deserializeChunk,
  MAX_PACKET_SIZE,
  MAX_PAYLOAD_SIZE,
  MockMqttClient,
  serializeChunk,
  SyncQueueManager,
} from "./sync/mod.ts";

// Sync watcher, content sync, coordinator (Phase 5.2)
export {
  ChangeStreamWatcher,
  ContentSyncClient,
  SyncCoordinator,
} from "./sync/mod.ts";
export type {
  ChangeEvent,
  ContentDiffEntry,
  ContentManifest,
  ContentManifestFile,
  ContentSyncOptions,
  SyncCoordinatorOptions,
  SyncStatus,
  WatcherOptions,
} from "./sync/mod.ts";

// Audit trail
export {
  AuditLogger,
  getProctoringConfig,
  HashChain,
  ProctoringMonitor,
} from "./audit/mod.ts";
export type {
  AuditLoggerOptions,
  HashableInteraction,
  ProctoringConfig,
  ProctoringTier,
  QuestionTiming,
} from "./audit/mod.ts";
