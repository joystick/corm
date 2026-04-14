/**
 * Parse SCORM <imsss:sequencing> XML element into CORM ItemSequencing.
 */
import type { Element } from "deno-dom";
import type {
  Condition,
  ConditionSet,
  ControlMode,
  DeliveryControls,
  ItemSequencing,
  LimitConditions,
  Objective,
  ObjectiveMap,
  RollupRule,
  SequencingRule,
} from "@corm/schema";
import { findElement, findElements, getChildText } from "./xml-helpers.ts";

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value.toLowerCase() === "true";
}

function parseControlMode(el: Element): ControlMode {
  const cm = findElement(el, "controlMode");
  if (!cm) {
    return {
      choice: true,
      choiceExit: true,
      flow: false,
      forwardOnly: false,
      useCurrentAttemptObjectiveInfo: true,
      useCurrentAttemptProgressInfo: true,
    };
  }
  return {
    choice: parseBool(cm.getAttribute("choice"), true),
    choiceExit: parseBool(cm.getAttribute("choiceExit"), true),
    flow: parseBool(cm.getAttribute("flow"), false),
    forwardOnly: parseBool(cm.getAttribute("forwardOnly"), false),
    useCurrentAttemptObjectiveInfo: parseBool(
      cm.getAttribute("useCurrentAttemptObjectiveInfo"),
      true,
    ),
    useCurrentAttemptProgressInfo: parseBool(
      cm.getAttribute("useCurrentAttemptProgressInfo"),
      true,
    ),
  };
}

function parseCondition(el: Element): Condition {
  const refObj = el.getAttribute("referencedObjective");
  const threshold = el.getAttribute("measureThreshold");
  const op = el.getAttribute("operator");
  return {
    condition: el.getAttribute("condition") as Condition["condition"],
    ...(refObj ? { refObjective: refObj } : {}),
    ...(threshold ? { measureThreshold: parseFloat(threshold) } : {}),
    ...(op === "not" ? { operator: "not" as const } : {}),
  } as Condition;
}

function parseConditionSet(el: Element): ConditionSet {
  const conditionsEl = findElement(el, "ruleConditions");
  if (!conditionsEl) {
    return { operator: "all", rules: [] };
  }
  const combination = conditionsEl.getAttribute("conditionCombination") ??
    "all";
  const rules = findElements(conditionsEl, "ruleCondition").map(parseCondition);
  return {
    operator: combination as "all" | "any",
    rules,
  };
}

function parseSequencingRule(el: Element): SequencingRule {
  const actionEl = findElement(el, "ruleAction");
  const action =
    (actionEl?.getAttribute("action") as SequencingRule["action"]) ?? "skip";
  return {
    action,
    conditions: parseConditionSet(el),
  };
}

function parseObjectiveMaps(objectiveEl: Element): ObjectiveMap[] {
  const mapEls = findElements(objectiveEl, "mapInfo");
  return mapEls.map((m) => ({
    target: m.getAttribute("targetObjectiveID") ?? "",
    readSatisfied: parseBool(
      m.getAttribute("readSatisfiedStatus"),
      true,
    ),
    readNormalizedMeasure: parseBool(
      m.getAttribute("readNormalizedMeasure"),
      true,
    ),
    writeSatisfied: parseBool(
      m.getAttribute("writeSatisfiedStatus"),
      false,
    ),
    writeNormalizedMeasure: parseBool(
      m.getAttribute("writeNormalizedMeasure"),
      false,
    ),
  }));
}

function parseObjective(el: Element, primary: boolean): Objective {
  const id = el.getAttribute("objectiveID") ?? "";
  const satisfiedByMeasure = parseBool(
    el.getAttribute("satisfiedByMeasure"),
    false,
  );
  const minMeasureText = getChildText(el, "minNormalizedMeasure");
  const maps = parseObjectiveMaps(el);

  return {
    id,
    primary,
    satisfiedByMeasure,
    ...(minMeasureText !== null
      ? { minNormalizedMeasure: parseFloat(minMeasureText) }
      : {}),
    ...(maps.length > 0 ? { maps } : {}),
  } as Objective;
}

function parseObjectives(el: Element): Objective[] {
  const objectivesEl = findElement(el, "objectives");
  if (!objectivesEl) return [];

  const result: Objective[] = [];

  const primaryEl = findElement(objectivesEl, "primaryObjective");
  if (primaryEl) {
    result.push(parseObjective(primaryEl, true));
  }

  const secondaryEls = findElements(objectivesEl, "objective");
  for (const sec of secondaryEls) {
    result.push(parseObjective(sec, false));
  }

  return result;
}

function parseRollupRules(el: Element): RollupRule[] {
  const rulesEl = findElement(el, "rollupRules");
  if (!rulesEl) return [];

  return findElements(rulesEl, "rollupRule").map((ruleEl) => {
    const childActivitySet = (ruleEl.getAttribute(
      "childActivitySet",
    ) as RollupRule["childActivitySet"]) ?? "all";

    const actionEl = findElement(ruleEl, "rollupAction");
    const action = (actionEl?.getAttribute("action") as RollupRule["action"]) ??
      "satisfied";

    const conditionsEl = findElement(ruleEl, "rollupConditions");
    const conditions = conditionsEl
      ? findElements(conditionsEl, "rollupCondition").map((c) => ({
        condition: c.getAttribute("condition") as Condition["condition"],
        ...(c.getAttribute("operator") === "not"
          ? { operator: "not" as const }
          : {}),
      }))
      : [];

    const minCount = ruleEl.getAttribute("minimumCount");
    const minPercent = ruleEl.getAttribute("minimumPercent");

    return {
      childActivitySet,
      action,
      conditions,
      ...(minCount ? { minimumCount: parseInt(minCount, 10) } : {}),
      ...(minPercent ? { minimumPercent: parseFloat(minPercent) } : {}),
    } as RollupRule;
  });
}

function parseLimitConditions(el: Element): LimitConditions | undefined {
  const limEl = findElement(el, "limitConditions");
  if (!limEl) return undefined;
  const attemptLimit = limEl.getAttribute("attemptLimit");
  const dur = limEl.getAttribute("attemptAbsoluteDurationLimit");
  return {
    ...(attemptLimit ? { attemptLimit: parseInt(attemptLimit, 10) } : {}),
    ...(dur ? { attemptAbsoluteDurationLimit: dur } : {}),
  } as LimitConditions;
}

function parseDeliveryControls(el: Element): DeliveryControls | undefined {
  const dcEl = findElement(el, "deliveryControls");
  if (!dcEl) return undefined;
  return {
    tracked: parseBool(dcEl.getAttribute("tracked"), true),
    completionSetByContent: parseBool(
      dcEl.getAttribute("completionSetByContent"),
      false,
    ),
    objectiveSetByContent: parseBool(
      dcEl.getAttribute("objectiveSetByContent"),
      false,
    ),
  };
}

/**
 * Parse a <sequencing> element into an ItemSequencing object.
 */
export function parseSequencing(el: Element): ItemSequencing {
  const controlMode = parseControlMode(el);
  const objectives = parseObjectives(el);
  const rollupRules = parseRollupRules(el);
  const limitConditions = parseLimitConditions(el);
  const deliveryControls = parseDeliveryControls(el);

  // Parse sequencing rules
  const rulesEl = findElement(el, "sequencingRules");
  const preconditions: SequencingRule[] = [];
  const postconditions: SequencingRule[] = [];
  const exitConditions: SequencingRule[] = [];

  if (rulesEl) {
    for (const r of findElements(rulesEl, "preConditionRule")) {
      preconditions.push(parseSequencingRule(r));
    }
    for (const r of findElements(rulesEl, "postConditionRule")) {
      postconditions.push(parseSequencingRule(r));
    }
    for (const r of findElements(rulesEl, "exitConditionRule")) {
      exitConditions.push(parseSequencingRule(r));
    }
  }

  return {
    controlMode,
    constrainChoice: false,
    preventActivation: false,
    preconditions,
    postconditions,
    exitConditions,
    objectives,
    rollupRules,
    ...(limitConditions ? { limitConditions } : {}),
    ...(deliveryControls ? { deliveryControls } : {}),
  } as ItemSequencing;
}
