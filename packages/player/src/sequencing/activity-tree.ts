/**
 * Activity Tree — builds a mutable activity tree from CORM manifest organizations.
 *
 * The tree is the central data structure the sequencing engine operates on.
 */

/**
 * Permissive sequencing types for the activity tree.
 *
 * These mirror @corm/schema's ItemSequencing but allow partial controlMode
 * objects (the schema fills defaults at decode time, but we don't require
 * Effect Schema decoding in the engine layer).
 */

// deno-lint-ignore no-explicit-any
type SequencingRule = any;

/** Control mode — all fields optional, engine supplies defaults. */
export interface ControlModeInput {
  choice?: boolean;
  choiceExit?: boolean;
  flow?: boolean;
  forwardOnly?: boolean;
  useCurrentAttemptObjectiveInfo?: boolean;
  useCurrentAttemptProgressInfo?: boolean;
}

/** Sequencing configuration attached to activities. */
export interface ActivitySequencing {
  controlMode?: ControlModeInput;
  constrainChoice?: boolean;
  preventActivation?: boolean;
  preconditions?: readonly SequencingRule[];
  postconditions?: readonly SequencingRule[];
  exitConditions?: readonly SequencingRule[];
  objectives?: readonly { id: string; primary?: boolean }[];
  rollupRules?: readonly {
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
  }[];
  limitConditions?: { attemptLimit?: number };
  deliveryControls?: { tracked?: boolean };
}

/** Runtime tracking state for a single activity node. */
export interface Activity {
  id: string;
  title: string;
  content?: string[];
  isVisible: boolean;
  sequencing?: ActivitySequencing;
  parent?: Activity;
  children: Activity[];

  // Runtime tracking state (mutable)
  attemptCount: number;
  isActive: boolean;
  isSuspended: boolean;
  objectiveStatus: Map<string, { satisfied: boolean; measure: number }>;
  progressStatus: { completed: boolean; measure: number };
}

/** Minimal item shape we need from the manifest (avoids coupling to Effect Schema runtime). */
export interface ManifestItem {
  id: string;
  title: string;
  isVisible?: boolean;
  content?: string[];
  items?: ManifestItem[];
  sequencing?: ActivitySequencing;
}

/** Minimal organization shape. */
export interface ManifestOrganization {
  id: string;
  title: string;
  items: ManifestItem[];
  sequencing?: ActivitySequencing;
}

/** Build an Activity from a manifest item, recursively. */
function buildActivity(
  item: ManifestItem,
  parent?: Activity,
): Activity {
  const activity: Activity = {
    id: item.id,
    title: item.title,
    content: item.content,
    isVisible: item.isVisible ?? true,
    sequencing: item.sequencing,
    parent,
    children: [],
    attemptCount: 0,
    isActive: false,
    isSuspended: false,
    objectiveStatus: new Map(),
    progressStatus: { completed: false, measure: 0 },
  };

  if (item.items) {
    activity.children = item.items.map((child) =>
      buildActivity(child, activity)
    );
  }

  return activity;
}

/**
 * Build the full activity tree from manifest organizations.
 *
 * Each organization becomes a root Activity whose children are the org's items.
 * The org-level sequencing (especially controlMode) governs navigation among
 * its direct children, matching SCORM's cluster model.
 */
export function buildActivityTree(
  organizations: ManifestOrganization[],
): Activity[] {
  return organizations.map((org) => {
    const root: Activity = {
      id: org.id,
      title: org.title,
      isVisible: true,
      sequencing: org.sequencing,
      children: [],
      attemptCount: 0,
      isActive: false,
      isSuspended: false,
      objectiveStatus: new Map(),
      progressStatus: { completed: false, measure: 0 },
    };
    root.children = org.items.map((item) => buildActivity(item, root));
    return root;
  });
}

/** Find an activity by ID in the tree (depth-first). */
export function findActivity(
  activities: Activity[],
  id: string,
): Activity | null {
  for (const activity of activities) {
    if (activity.id === id) return activity;
    const found = findActivity(activity.children, id);
    if (found) return found;
  }
  return null;
}

/** Get the first leaf node in the tree (depth-first). */
export function firstLeaf(activities: Activity[]): Activity | null {
  for (const activity of activities) {
    if (activity.children.length === 0) return activity;
    const leaf = firstLeaf(activity.children);
    if (leaf) return leaf;
  }
  return null;
}

/** Collect all leaf activities in tree order. */
export function allLeaves(activities: Activity[]): Activity[] {
  const leaves: Activity[] = [];
  function walk(nodes: Activity[]): void {
    for (const node of nodes) {
      if (node.children.length === 0) {
        leaves.push(node);
      } else {
        walk(node.children);
      }
    }
  }
  walk(activities);
  return leaves;
}
