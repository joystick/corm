/**
 * Sequencing Engine — processes navigation requests against the activity tree.
 *
 * Implements IMS Simple Sequencing navigation request processing
 * for start, continue, previous, choice, exit, exitAll, and abandon.
 */

import type { CmiRuntime } from "../cmi/runtime.ts";
import {
  type Activity,
  allLeaves,
  findActivity,
  firstLeaf,
} from "./activity-tree.ts";
import { evaluateConditionSet } from "./conditions.ts";
import { rollup } from "./rollup.ts";

export type NavigationRequest =
  | "start"
  | "continue"
  | "previous"
  | "choice"
  | "exit"
  | "exitAll"
  | "abandon";

export interface NavigationResult {
  delivered: Activity | null;
  reason?: string;
  availableActivities: Activity[];
}

/** Default control mode for SCORM 1.2 fallback (no sequencing defined). */
const DEFAULT_CONTROL = {
  choice: true,
  flow: true,
  forwardOnly: false,
} as const;

/** Get the effective control mode for an activity (or its parent cluster). */
function getControlMode(activity: Activity) {
  // Control mode is defined on the parent (cluster) in SCORM 2004.
  // For root-level activities, use the activity's own sequencing or defaults.
  const parent = activity.parent;
  if (parent?.sequencing?.controlMode) {
    return parent.sequencing.controlMode;
  }
  if (activity.sequencing?.controlMode) {
    return activity.sequencing.controlMode;
  }
  return DEFAULT_CONTROL;
}

/**
 * Evaluate precondition rules on an activity.
 * Returns the action of the first matching rule, or null.
 */
function evaluatePreconditions(
  activity: Activity,
  runtime: CmiRuntime,
): string | null {
  const rules = activity.sequencing?.preconditions ?? [];
  for (const rule of rules) {
    if (evaluateConditionSet(rule.conditions, activity, runtime)) {
      return rule.action;
    }
  }
  return null;
}

/**
 * Evaluate postcondition rules on an activity.
 * Returns the action of the first matching rule, or null.
 */
function evaluatePostconditions(
  activity: Activity,
  runtime: CmiRuntime,
): string | null {
  const rules = activity.sequencing?.postconditions ?? [];
  for (const rule of rules) {
    if (evaluateConditionSet(rule.conditions, activity, runtime)) {
      return rule.action;
    }
  }
  return null;
}

/** Get siblings of an activity (including itself). */
function getSiblings(activity: Activity): Activity[] {
  if (activity.parent) {
    return activity.parent.children;
  }
  // Root-level: we need the full root list, which the engine tracks
  return [];
}

export class SequencingEngine {
  private currentActivity: Activity | null = null;
  private rootActivities: Activity[];
  private runtime: CmiRuntime;

  constructor(activities: Activity[], runtime: CmiRuntime) {
    this.rootActivities = activities;
    this.runtime = runtime;
  }

  /** Process a navigation request. */
  navigate(
    request: NavigationRequest,
    targetId?: string,
  ): NavigationResult {
    switch (request) {
      case "start":
        return this.handleStart();
      case "continue":
        return this.handleContinue();
      case "previous":
        return this.handlePrevious();
      case "choice":
        return this.handleChoice(targetId);
      case "exit":
        return this.handleExit();
      case "exitAll":
        return this.handleExitAll();
      case "abandon":
        return this.handleAbandon();
      default:
        return this.reject(`Unknown navigation request: ${request}`);
    }
  }

  /** Get the currently active activity. */
  getCurrentActivity(): Activity | null {
    return this.currentActivity;
  }

  /** Get activities available for choice navigation. */
  getAvailableActivities(): Activity[] {
    const leaves = allLeaves(this.rootActivities);
    return leaves.filter((a) => this.isActivityAvailable(a.id));
  }

  /** Check if an activity is accessible via choice. */
  isActivityAvailable(id: string): boolean {
    const activity = findActivity(this.rootActivities, id);
    if (!activity) return false;
    if (!activity.isVisible) return false;

    // Check preconditions
    const action = evaluatePreconditions(activity, this.runtime);
    if (action === "disabled" || action === "hiddenFromChoice") {
      return false;
    }

    // Check attempt limit
    const limit = activity.sequencing?.limitConditions?.attemptLimit;
    if (limit !== undefined && activity.attemptCount >= limit) {
      return false;
    }

    return true;
  }

  /** Get completion percentage across all leaf activities. */
  getCompletionPercentage(): number {
    const leaves = allLeaves(this.rootActivities);
    if (leaves.length === 0) return 0;
    const completed = leaves.filter((a) => a.progressStatus.completed).length;
    return (completed / leaves.length) * 100;
  }

  // ── Private handlers ─────────────────────────────────

  private handleStart(): NavigationResult {
    const leaf = firstLeaf(this.rootActivities);
    if (!leaf) {
      return this.reject("No activities in the tree");
    }
    return this.deliver(leaf);
  }

  private handleContinue(): NavigationResult {
    if (!this.currentActivity) {
      return this.reject("No current activity");
    }

    const controlMode = this.getParentControlMode(this.currentActivity);
    if (!controlMode.flow) {
      return this.reject("Flow navigation is disabled");
    }

    const leaves = allLeaves(this.rootActivities);
    const currentIdx = leaves.indexOf(this.currentActivity);
    if (currentIdx === -1) {
      return this.reject("Current activity not found in leaf list");
    }

    // Find next available leaf
    for (let i = currentIdx + 1; i < leaves.length; i++) {
      const candidate = leaves[i];
      const action = evaluatePreconditions(candidate, this.runtime);

      if (action === "skip") continue;
      if (action === "disabled") {
        return this.reject(
          `Activity "${candidate.title}" is disabled`,
        );
      }

      // Check attempt limit
      const limit = candidate.sequencing?.limitConditions?.attemptLimit;
      if (limit !== undefined && candidate.attemptCount >= limit) {
        return this.reject(
          `Attempt limit exceeded for "${candidate.title}"`,
        );
      }

      return this.deliver(candidate);
    }

    return this.reject("No more activities");
  }

  private handlePrevious(): NavigationResult {
    if (!this.currentActivity) {
      return this.reject("No current activity");
    }

    const controlMode = this.getParentControlMode(this.currentActivity);
    if (!controlMode.flow) {
      return this.reject("Flow navigation is disabled");
    }
    if (controlMode.forwardOnly) {
      return this.reject("Forward-only mode — previous is not allowed");
    }

    const leaves = allLeaves(this.rootActivities);
    const currentIdx = leaves.indexOf(this.currentActivity);
    if (currentIdx <= 0) {
      return this.reject("No previous activity");
    }

    // Find previous available leaf
    for (let i = currentIdx - 1; i >= 0; i--) {
      const candidate = leaves[i];
      const action = evaluatePreconditions(candidate, this.runtime);

      if (action === "skip") continue;
      if (action === "disabled") {
        return this.reject(
          `Activity "${candidate.title}" is disabled`,
        );
      }

      return this.deliver(candidate);
    }

    return this.reject("No previous activity available");
  }

  private handleChoice(targetId?: string): NavigationResult {
    if (!targetId) {
      return this.reject("Choice navigation requires a target ID");
    }

    const target = findActivity(this.rootActivities, targetId);
    if (!target) {
      return this.reject(`Activity "${targetId}" not found`);
    }

    const controlMode = this.getParentControlMode(target);
    if (!controlMode.choice) {
      return this.reject("Choice navigation is disabled");
    }

    // Check preconditions
    const action = evaluatePreconditions(target, this.runtime);
    if (action === "disabled") {
      return this.reject(`Activity "${target.title}" is disabled`);
    }
    if (action === "hiddenFromChoice") {
      return this.reject(
        `Activity "${target.title}" is hidden from choice`,
      );
    }

    // Check attempt limit
    const limit = target.sequencing?.limitConditions?.attemptLimit;
    if (limit !== undefined && target.attemptCount >= limit) {
      return this.reject(
        `Attempt limit exceeded for "${target.title}"`,
      );
    }

    // If target is a cluster (has children), deliver first leaf
    if (target.children.length > 0) {
      const leaf = firstLeaf([target]);
      if (!leaf) return this.reject("No deliverable activity in cluster");
      return this.deliver(leaf);
    }

    return this.deliver(target);
  }

  private handleExit(): NavigationResult {
    if (!this.currentActivity) {
      return this.reject("No current activity");
    }

    // Evaluate postconditions
    evaluatePostconditions(this.currentActivity, this.runtime);

    // Rollup
    rollup(this.currentActivity, this.runtime);

    this.currentActivity.isActive = false;
    this.currentActivity = this.currentActivity.parent ?? null;

    return {
      delivered: this.currentActivity,
      availableActivities: this.getAvailableActivities(),
    };
  }

  private handleExitAll(): NavigationResult {
    if (this.currentActivity) {
      rollup(this.currentActivity, this.runtime);
      this.currentActivity.isActive = false;
    }
    this.currentActivity = null;

    return {
      delivered: null,
      availableActivities: this.getAvailableActivities(),
    };
  }

  private handleAbandon(): NavigationResult {
    if (this.currentActivity) {
      this.currentActivity.isActive = false;
    }
    this.currentActivity = null;

    return {
      delivered: null,
      availableActivities: this.getAvailableActivities(),
    };
  }

  // ── Helpers ──────────────────────────────────────────

  private deliver(activity: Activity): NavigationResult {
    // Deactivate current
    if (this.currentActivity) {
      this.currentActivity.isActive = false;
    }

    // Activate and track attempt
    activity.isActive = true;
    activity.attemptCount++;
    this.currentActivity = activity;

    return {
      delivered: activity,
      availableActivities: this.getAvailableActivities(),
    };
  }

  private reject(reason: string): NavigationResult {
    return {
      delivered: null,
      reason,
      availableActivities: this.getAvailableActivities(),
    };
  }

  /** Get control mode from the activity's parent (or the activity itself for root). */
  private getParentControlMode(activity: Activity) {
    return getControlMode(activity);
  }
}
