/**
 * Assessment interaction types and scoring data model.
 *
 * Follows SCORM 1.2/2004 interaction type definitions with
 * SCORM-formatted correct response patterns.
 */

export type InteractionType =
  | "true-false"
  | "choice"
  | "fill-in"
  | "long-fill-in"
  | "matching"
  | "performance"
  | "sequencing"
  | "likert"
  | "numeric"
  | "other";

export interface InteractionOption {
  id: string;
  text: string;
}

export interface InteractionDefinition {
  id: string;
  type: InteractionType;
  description: string;
  /** SCORM-formatted correct response patterns */
  correctResponses: string[];
  /** Score weight — defaults to 1 */
  weighting?: number;
  /** Options for choice, matching, sequencing, likert */
  options?: InteractionOption[];
}

export interface InteractionResponse {
  interactionId: string;
  /** SCORM-formatted learner response */
  learnerResponse: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** ISO 8601 duration */
  latency: string;
}

export type InteractionResultValue =
  | "correct"
  | "wrong"
  | "unanticipated"
  | "neutral";

export interface InteractionResult {
  correct: boolean;
  result: InteractionResultValue;
  /** 0 or the weighting value */
  score: number;
}
