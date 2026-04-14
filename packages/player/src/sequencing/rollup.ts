/**
 * Rollup — propagates completion/satisfaction status up the activity tree.
 */

import type { Activity } from "./activity-tree.ts";
import type { CmiRuntime } from "../cmi/runtime.ts";

/** Check if a single rollup condition matches a child activity. */
function evaluateRollupCondition(
  condition: { condition: string; operator?: string },
  child: Activity,
): boolean {
  let result: boolean;

  switch (condition.condition) {
    case "satisfied": {
      const primary = child.objectiveStatus.get("primary");
      result = primary?.satisfied ?? false;
      break;
    }
    case "completed":
      result = child.progressStatus.completed;
      break;
    case "attempted":
      result = child.attemptCount > 0;
      break;
    case "objectiveStatusKnown": {
      result = child.objectiveStatus.has("primary");
      break;
    }
    case "activityProgressKnown":
      result = child.progressStatus.measure > 0 ||
        child.progressStatus.completed;
      break;
    default:
      result = false;
  }

  if (condition.operator === "not") {
    result = !result;
  }

  return result;
}

/** A rollup rule from the activity's sequencing. */
interface RollupRule {
  childActivitySet:
    | "all"
    | "any"
    | "none"
    | "atLeastCount"
    | "atLeastPercent";
  action: "satisfied" | "notSatisfied" | "completed" | "incomplete";
  conditions: readonly { condition: string; operator?: string }[];
  minimumCount?: number;
  minimumPercent?: number;
}

/** Check if a rollup rule's conditions are met for a child. */
function childMatchesRule(
  rule: RollupRule,
  child: Activity,
): boolean {
  // All conditions must match for a child to "match" the rule
  return rule.conditions.every((c) => evaluateRollupCondition(c, child));
}

/** Evaluate a rollup rule's childActivitySet against all children. */
function evaluateChildActivitySet(
  rule: RollupRule,
  children: Activity[],
): boolean {
  if (children.length === 0) return false;

  const matchingCount = children.filter((c) => childMatchesRule(rule, c))
    .length;

  switch (rule.childActivitySet) {
    case "all":
      return matchingCount === children.length;
    case "any":
      return matchingCount > 0;
    case "none":
      return matchingCount === 0;
    case "atLeastCount":
      return matchingCount >= (rule.minimumCount ?? 1);
    case "atLeastPercent": {
      const pct = (matchingCount / children.length) * 100;
      return pct >= (rule.minimumPercent ?? 100);
    }
    default:
      return false;
  }
}

/** Apply a rollup rule's action to a parent activity. */
function applyRollupAction(
  rule: RollupRule,
  parent: Activity,
): void {
  switch (rule.action) {
    case "satisfied":
      parent.objectiveStatus.set("primary", {
        satisfied: true,
        measure: parent.objectiveStatus.get("primary")?.measure ?? 1,
      });
      break;
    case "notSatisfied":
      parent.objectiveStatus.set("primary", {
        satisfied: false,
        measure: parent.objectiveStatus.get("primary")?.measure ?? 0,
      });
      break;
    case "completed":
      parent.progressStatus.completed = true;
      break;
    case "incomplete":
      parent.progressStatus.completed = false;
      break;
  }
}

/**
 * Perform rollup from an activity up to the root.
 *
 * After an activity is delivered (or its status changes),
 * walk up the tree evaluating rollup rules at each parent.
 */
export function rollup(
  activity: Activity,
  _runtime: CmiRuntime,
): void {
  let current = activity.parent;

  while (current) {
    const rules = current.sequencing?.rollupRules ?? [];

    // If no explicit rollup rules, apply default rollup:
    // parent is completed when all children are completed,
    // parent is satisfied when all children are satisfied.
    if (rules.length === 0) {
      applyDefaultRollup(current);
    } else {
      for (const rule of rules) {
        if (evaluateChildActivitySet(rule, current.children)) {
          applyRollupAction(rule, current);
        }
      }
    }

    current = current.parent;
  }
}

/** Default rollup: parent completed/satisfied when all children are. */
function applyDefaultRollup(parent: Activity): void {
  if (parent.children.length === 0) return;

  const allCompleted = parent.children.every((c) => c.progressStatus.completed);
  parent.progressStatus.completed = allCompleted;

  const allSatisfied = parent.children.every((c) => {
    const status = c.objectiveStatus.get("primary");
    return status?.satisfied ?? false;
  });

  if (allSatisfied && parent.children.length > 0) {
    parent.objectiveStatus.set("primary", {
      satisfied: true,
      measure: 1,
    });
  }

  // Update measure as ratio of completed children
  const completedCount =
    parent.children.filter((c) => c.progressStatus.completed).length;
  parent.progressStatus.measure = completedCount / parent.children.length;
}
