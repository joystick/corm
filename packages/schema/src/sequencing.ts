/**
 * CORM Sequencing Types — Full SCORM IMS Simple Sequencing mapped to Effect Schema.
 *
 * Every SCORM sequencing concept has a lossless CORM equivalent so that
 * lens round-trip laws (get . put = id) hold without information loss.
 */
import { Schema } from "effect";

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

/** All 12 SCORM sequencing condition types. */
export const ConditionType = Schema.Literal(
  "satisfied",
  "objectiveStatusKnown",
  "objectiveMeasureKnown",
  "objectiveMeasureGreaterThan",
  "objectiveMeasureLessThan",
  "completed",
  "activityProgressKnown",
  "attempted",
  "attemptLimitExceeded",
  "timeLimitExceeded",
  "outsideAvailableTimeRange",
  "always",
);

/** Optional negation operator for a condition. */
export const ConditionOperator = Schema.Literal("not");

export const Condition = Schema.Struct({
  condition: ConditionType,
  refObjective: Schema.optional(Schema.String),
  measureThreshold: Schema.optional(Schema.Number),
  operator: Schema.optional(ConditionOperator),
});

export type Condition = typeof Condition.Type;

// ---------------------------------------------------------------------------
// ConditionSet
// ---------------------------------------------------------------------------

export const ConditionSet = Schema.Struct({
  operator: Schema.optionalWith(Schema.Literal("all", "any"), {
    default: () => "all" as const,
  }),
  rules: Schema.Array(Condition),
});

export type ConditionSet = typeof ConditionSet.Type;

// ---------------------------------------------------------------------------
// SequencingRule
// ---------------------------------------------------------------------------

/** All valid SCORM sequencing rule actions across precondition, postcondition, and exit condition rule types. */
export const SequencingRuleAction = Schema.Literal(
  // Precondition actions
  "skip",
  "disabled",
  "hiddenFromChoice",
  "stopForwardTraversal",
  // Postcondition actions
  "exitParent",
  "exitAll",
  "retry",
  "retryAll",
  "continue",
  "previous",
  // Exit condition actions
  "exit",
);

export const SequencingRule = Schema.Struct({
  action: SequencingRuleAction,
  conditions: ConditionSet,
});

export type SequencingRule = typeof SequencingRule.Type;

// ---------------------------------------------------------------------------
// ControlMode
// ---------------------------------------------------------------------------

export const ControlMode = Schema.Struct({
  choice: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  choiceExit: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  flow: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  forwardOnly: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  useCurrentAttemptObjectiveInfo: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),
  useCurrentAttemptProgressInfo: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),
});

export type ControlMode = typeof ControlMode.Type;

// ---------------------------------------------------------------------------
// ObjectiveMap
// ---------------------------------------------------------------------------

export const ObjectiveMap = Schema.Struct({
  target: Schema.String,
  readSatisfied: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),
  readNormalizedMeasure: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),
  writeSatisfied: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  writeNormalizedMeasure: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
});

export type ObjectiveMap = typeof ObjectiveMap.Type;

// ---------------------------------------------------------------------------
// Objective
// ---------------------------------------------------------------------------

export const Objective = Schema.Struct({
  id: Schema.String,
  primary: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  satisfiedByMeasure: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  minNormalizedMeasure: Schema.optional(Schema.Number),
  maps: Schema.optional(Schema.Array(ObjectiveMap)),
});

export type Objective = typeof Objective.Type;

// ---------------------------------------------------------------------------
// RollupCondition
// ---------------------------------------------------------------------------

export const RollupCondition = Schema.Struct({
  condition: ConditionType,
  operator: Schema.optional(ConditionOperator),
});

export type RollupCondition = typeof RollupCondition.Type;

// ---------------------------------------------------------------------------
// RollupRule
// ---------------------------------------------------------------------------

export const RollupRule = Schema.Struct({
  childActivitySet: Schema.Literal("all", "any", "none", "atLeastCount", "atLeastPercent"),
  action: Schema.Literal("satisfied", "notSatisfied", "completed", "incomplete"),
  conditions: Schema.Array(RollupCondition),
  minimumCount: Schema.optional(Schema.Number),
  minimumPercent: Schema.optional(Schema.Number),
});

export type RollupRule = typeof RollupRule.Type;

// ---------------------------------------------------------------------------
// RandomizationControls
// ---------------------------------------------------------------------------

export const RandomizationControls = Schema.Struct({
  randomizationTiming: Schema.optionalWith(
    Schema.Literal("never", "once", "onEachNewAttempt"),
    { default: () => "never" as const },
  ),
  selectCount: Schema.optional(Schema.Number),
  reorderChildren: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  selectionTiming: Schema.optionalWith(
    Schema.Literal("never", "once", "onEachNewAttempt"),
    { default: () => "never" as const },
  ),
});

export type RandomizationControls = typeof RandomizationControls.Type;

// ---------------------------------------------------------------------------
// LimitConditions
// ---------------------------------------------------------------------------

export const LimitConditions = Schema.Struct({
  attemptLimit: Schema.optional(Schema.Number),
  attemptAbsoluteDurationLimit: Schema.optional(Schema.String),
});

export type LimitConditions = typeof LimitConditions.Type;

// ---------------------------------------------------------------------------
// DeliveryControls
// ---------------------------------------------------------------------------

export const DeliveryControls = Schema.Struct({
  tracked: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  completionSetByContent: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  objectiveSetByContent: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
});

export type DeliveryControls = typeof DeliveryControls.Type;

// ---------------------------------------------------------------------------
// RollupConsideration
// ---------------------------------------------------------------------------

export const RollupConsiderationValue = Schema.Literal(
  "always",
  "ifAttempted",
  "ifNotSkipped",
  "ifNotSuspended",
);

export const RollupConsideration = Schema.Struct({
  requiredForSatisfied: Schema.optionalWith(RollupConsiderationValue, {
    default: () => "always" as const,
  }),
  requiredForNotSatisfied: Schema.optionalWith(RollupConsiderationValue, {
    default: () => "always" as const,
  }),
  requiredForCompleted: Schema.optionalWith(RollupConsiderationValue, {
    default: () => "always" as const,
  }),
  requiredForIncomplete: Schema.optionalWith(RollupConsiderationValue, {
    default: () => "always" as const,
  }),
});

export type RollupConsideration = typeof RollupConsideration.Type;

// ---------------------------------------------------------------------------
// ItemSequencing — top-level struct
// ---------------------------------------------------------------------------

export const ItemSequencing = Schema.Struct({
  controlMode: Schema.optionalWith(ControlMode, {
    default: () => Schema.decodeUnknownSync(ControlMode)({}),
  }),
  constrainChoice: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  preventActivation: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  preconditions: Schema.optionalWith(Schema.Array(SequencingRule), {
    default: () => [],
  }),
  postconditions: Schema.optionalWith(Schema.Array(SequencingRule), {
    default: () => [],
  }),
  exitConditions: Schema.optionalWith(Schema.Array(SequencingRule), {
    default: () => [],
  }),
  objectives: Schema.optionalWith(Schema.Array(Objective), {
    default: () => [],
  }),
  rollupRules: Schema.optionalWith(Schema.Array(RollupRule), {
    default: () => [],
  }),
  randomizationControls: Schema.optional(RandomizationControls),
  limitConditions: Schema.optional(LimitConditions),
  deliveryControls: Schema.optional(DeliveryControls),
  rollupConsideration: Schema.optional(RollupConsideration),
});

export type ItemSequencing = typeof ItemSequencing.Type;
