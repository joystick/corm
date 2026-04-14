/**
 * CORM Assessment & Interaction Types — Effect Schema definitions for all 11
 * SCORM interaction types plus proctoring requirements.
 */
import { Schema } from "effect";

// ---------------------------------------------------------------------------
// InteractionType
// ---------------------------------------------------------------------------

export const InteractionType = Schema.Literal(
  "true_false",
  "single_choice",
  "multi_choice",
  "fill_in",
  "long_fill_in",
  "matching",
  "performance",
  "sequencing",
  "likert",
  "numeric",
  "other",
);

export type InteractionType = typeof InteractionType.Type;

// ---------------------------------------------------------------------------
// Sub-types for interaction fields
// ---------------------------------------------------------------------------

export const Choice = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  correct: Schema.optional(Schema.Boolean),
});

export type Choice = typeof Choice.Type;

export const MatchItem = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

export type MatchItem = typeof MatchItem.Type;

export const PerformanceStep = Schema.Struct({
  id: Schema.String,
  description: Schema.String,
  objective: Schema.optional(Schema.String),
});

export type PerformanceStep = typeof PerformanceStep.Type;

export const Feedback = Schema.Struct({
  correct: Schema.optional(Schema.String),
  incorrect: Schema.optional(Schema.String),
});

export type Feedback = typeof Feedback.Type;

export const LikertScale = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

export type LikertScale = typeof LikertScale.Type;

// ---------------------------------------------------------------------------
// Interaction — flexible struct covering all type-specific fields
// ---------------------------------------------------------------------------

/**
 * Interaction carries all type-specific fields as optional properties.
 * This is a deliberate design choice for round-trip fidelity — SCORM packages
 * may contain non-standard field combinations from vendor tools. A discriminated
 * union would reject these at decode time, breaking the lossless encoding guarantee.
 * Type-correct field combinations are validated at the assessment runner level, not
 * at the schema level.
 */
export const Interaction = Schema.Struct({
  // Common fields
  id: Schema.String,
  type: InteractionType,
  weighting: Schema.optional(Schema.Number),
  text: Schema.optional(Schema.String),
  feedback: Schema.optional(Feedback),

  // true_false / fill_in / long_fill_in / likert / other
  correctResponse: Schema.optional(Schema.Union(Schema.Boolean, Schema.String, Schema.Number)),

  // single_choice / multi_choice
  choices: Schema.optional(Schema.Array(Choice)),

  // matching
  source: Schema.optional(Schema.Array(MatchItem)),
  target: Schema.optional(Schema.Array(MatchItem)),
  correctMatches: Schema.optional(
    Schema.Array(Schema.Tuple(Schema.String, Schema.String)),
  ),

  // sequencing
  items: Schema.optional(Schema.Array(MatchItem)),
  correctOrder: Schema.optional(Schema.Array(Schema.String)),

  // numeric
  correctMin: Schema.optional(Schema.Number),
  correctMax: Schema.optional(Schema.Number),

  // performance
  steps: Schema.optional(Schema.Array(PerformanceStep)),
  completionThreshold: Schema.optional(Schema.Number),

  // likert
  scale: Schema.optional(Schema.Array(LikertScale)),
});

export type Interaction = typeof Interaction.Type;

// ---------------------------------------------------------------------------
// ProctoringLevel
// ---------------------------------------------------------------------------

export const ProctoringLevel = Schema.Literal(
  "none",
  "self_verified",
  "supervised",
  "remote_async",
  "remote_live",
);

export type ProctoringLevel = typeof ProctoringLevel.Type;

// ---------------------------------------------------------------------------
// Proctoring sub-types
// ---------------------------------------------------------------------------

export const ProctoringIdentity = Schema.Struct({
  method: Schema.String,
  photoCapture: Schema.optional(Schema.Boolean),
  interval: Schema.optional(Schema.Number),
});

export type ProctoringIdentity = typeof ProctoringIdentity.Type;

export const ProctoringSupervision = Schema.Struct({
  type: Schema.String,
  officerRole: Schema.optional(Schema.String),
  attestation: Schema.optional(Schema.Boolean),
  reviewRequired: Schema.optional(Schema.Boolean),
});

export type ProctoringSupervision = typeof ProctoringSupervision.Type;

export const ProctoringLockdown = Schema.Struct({
  browserLock: Schema.optional(Schema.Boolean),
  copyPaste: Schema.optional(Schema.Boolean),
  timeLimit: Schema.optional(Schema.Number),
});

export type ProctoringLockdown = typeof ProctoringLockdown.Type;

export const ProctoringRecording = Schema.Struct({
  screen: Schema.optional(Schema.Boolean),
  webcam: Schema.optional(Schema.Boolean),
  events: Schema.optional(Schema.Boolean),
  intervals: Schema.optional(Schema.Number),
});

export type ProctoringRecording = typeof ProctoringRecording.Type;

export const ProctoringRequirements = Schema.Struct({
  level: ProctoringLevel,
  identity: Schema.optional(ProctoringIdentity),
  supervision: Schema.optional(ProctoringSupervision),
  lockdown: Schema.optional(ProctoringLockdown),
  recording: Schema.optional(ProctoringRecording),
});

export type ProctoringRequirements = typeof ProctoringRequirements.Type;

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export const Assessment = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  randomize: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  showFeedback: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  interactions: Schema.Array(Interaction),
  proctoring: Schema.optional(ProctoringRequirements),
});

export type Assessment = typeof Assessment.Type;
