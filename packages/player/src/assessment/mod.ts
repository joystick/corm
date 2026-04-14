/**
 * Assessment module — interaction scoring and session management.
 */

export type {
  InteractionDefinition,
  InteractionOption,
  InteractionResponse,
  InteractionResult,
  InteractionResultValue,
  InteractionType,
} from "./types.ts";

export { scoreInteraction } from "./scoring.ts";
export { AssessmentSession } from "./session.ts";
