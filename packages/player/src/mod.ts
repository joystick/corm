export { CormPlayer } from "./components/corm-player.ts";
export { CormNav } from "./components/corm-nav.ts";
export { CormContent } from "./components/corm-content.ts";
export { CormControls } from "./components/corm-controls.ts";
export { CormStatus } from "./components/corm-status.ts";
export { renderMarkdown } from "./renderer.ts";
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
