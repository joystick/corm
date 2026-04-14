/**
 * Condition Evaluation — evaluates sequencing conditions against activity state.
 */

import type { Activity } from "./activity-tree.ts";
import type { CmiRuntime } from "../cmi/runtime.ts";

/** A single sequencing condition. */
interface Condition {
  condition: string;
  refObjective?: string;
  measureThreshold?: number;
  operator?: string;
}

/** A set of conditions combined with all/any. */
interface ConditionSet {
  operator?: "all" | "any";
  rules: readonly Condition[];
}

/** Evaluate a single condition against an activity's runtime state. */
function evaluateCondition(
  condition: Condition,
  activity: Activity,
  _runtime: CmiRuntime,
): boolean {
  let result: boolean;

  switch (condition.condition) {
    case "satisfied": {
      const objId = condition.refObjective ?? "primary";
      const status = activity.objectiveStatus.get(objId);
      result = status?.satisfied ?? false;
      break;
    }
    case "objectiveStatusKnown": {
      const objId = condition.refObjective ?? "primary";
      result = activity.objectiveStatus.has(objId);
      break;
    }
    case "objectiveMeasureKnown": {
      const objId = condition.refObjective ?? "primary";
      const status = activity.objectiveStatus.get(objId);
      result = status !== undefined && status.measure !== 0;
      break;
    }
    case "objectiveMeasureGreaterThan": {
      const objId = condition.refObjective ?? "primary";
      const status = activity.objectiveStatus.get(objId);
      const threshold = condition.measureThreshold ?? 0;
      result = (status?.measure ?? 0) > threshold;
      break;
    }
    case "objectiveMeasureLessThan": {
      const objId = condition.refObjective ?? "primary";
      const status = activity.objectiveStatus.get(objId);
      const threshold = condition.measureThreshold ?? 0;
      result = (status?.measure ?? 0) < threshold;
      break;
    }
    case "completed":
      result = activity.progressStatus.completed;
      break;
    case "activityProgressKnown":
      result = activity.progressStatus.measure > 0 ||
        activity.progressStatus.completed;
      break;
    case "attempted":
      result = activity.attemptCount > 0;
      break;
    case "attemptLimitExceeded": {
      const limit = activity.sequencing?.limitConditions?.attemptLimit;
      result = limit !== undefined && activity.attemptCount >= limit;
      break;
    }
    case "timeLimitExceeded":
      // Not implemented — requires timer infrastructure
      result = false;
      break;
    case "outsideAvailableTimeRange":
      // Not implemented — requires availability window infrastructure
      result = false;
      break;
    case "always":
      result = true;
      break;
    default:
      result = false;
  }

  // Apply negation operator
  if (condition.operator === "not") {
    result = !result;
  }

  return result;
}

/** Evaluate a condition set (all/any) against an activity. */
export function evaluateConditionSet(
  // deno-lint-ignore no-explicit-any
  conditionSet: any,
  activity: Activity,
  runtime: CmiRuntime,
): boolean {
  const { rules, operator } = conditionSet as ConditionSet;

  if (rules.length === 0) return false;

  if (operator === "any") {
    return rules.some((rule) => evaluateCondition(rule, activity, runtime));
  }

  // Default: "all"
  return rules.every((rule) => evaluateCondition(rule, activity, runtime));
}
