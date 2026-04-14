import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import {
  ControlMode,
  SequencingRule,
  Condition,
  Objective,
  ObjectiveMap,
  RollupRule,
  ItemSequencing,
} from "../src/sequencing.ts";

describe("ControlMode", () => {
  it("decodes a valid control mode", () => {
    const input = {
      choice: true,
      choiceExit: true,
      flow: true,
      forwardOnly: false,
      useCurrentAttemptObjectiveInfo: true,
      useCurrentAttemptProgressInfo: true,
    };
    const result = Schema.decodeUnknownSync(ControlMode)(input);
    expect(result.choice).toBe(true);
    expect(result.forwardOnly).toBe(false);
  });

  it("applies defaults for missing optional fields", () => {
    const result = Schema.decodeUnknownSync(ControlMode)({});
    expect(result.choice).toBe(true);
    expect(result.flow).toBe(false);
    expect(result.forwardOnly).toBe(false);
  });
});

describe("Condition", () => {
  it("decodes a satisfied condition", () => {
    const input = {
      condition: "satisfied",
      refObjective: "obj-01",
    };
    const result = Schema.decodeUnknownSync(Condition)(input);
    expect(result.condition).toBe("satisfied");
    expect(result.refObjective).toBe("obj-01");
  });

  it("decodes a measure condition with threshold", () => {
    const input = {
      condition: "objectiveMeasureGreaterThan",
      refObjective: "obj-01",
      measureThreshold: 0.7,
      operator: "not",
    };
    const result = Schema.decodeUnknownSync(Condition)(input);
    expect(result.measureThreshold).toBe(0.7);
    expect(result.operator).toBe("not");
  });

  it("rejects invalid condition type", () => {
    expect(() =>
      Schema.decodeUnknownSync(Condition)({ condition: "invalid" })
    ).toThrow();
  });
});

describe("Objective", () => {
  it("decodes an objective with maps", () => {
    const input = {
      id: "obj-primary",
      primary: true,
      satisfiedByMeasure: true,
      minNormalizedMeasure: 0.7,
      maps: [
        {
          target: "global-obj-01",
          readSatisfied: false,
          readNormalizedMeasure: false,
          writeSatisfied: true,
          writeNormalizedMeasure: true,
        },
      ],
    };
    const result = Schema.decodeUnknownSync(Objective)(input);
    expect(result.primary).toBe(true);
    expect(result.maps).toHaveLength(1);
    expect(result.maps![0].writeSatisfied).toBe(true);
  });
});

describe("RollupRule", () => {
  it("decodes a rollup rule with child activity set", () => {
    const input = {
      childActivitySet: "all",
      action: "satisfied",
      conditions: [{ condition: "satisfied" }],
    };
    const result = Schema.decodeUnknownSync(RollupRule)(input);
    expect(result.childActivitySet).toBe("all");
    expect(result.action).toBe("satisfied");
  });
});

describe("ItemSequencing", () => {
  it("decodes a full sequencing block", () => {
    const input = {
      controlMode: { choice: true, flow: true },
      constrainChoice: false,
      preventActivation: false,
      preconditions: [
        {
          action: "skip",
          conditions: {
            operator: "all",
            rules: [{ condition: "satisfied", refObjective: "obj-pretest" }],
          },
        },
      ],
      postconditions: [],
      exitConditions: [],
      objectives: [
        {
          id: "obj-primary",
          primary: true,
          satisfiedByMeasure: true,
          minNormalizedMeasure: 0.8,
        },
      ],
      rollupRules: [],
      deliveryControls: { tracked: true, completionSetByContent: false, objectiveSetByContent: true },
    };
    const result = Schema.decodeUnknownSync(ItemSequencing)(input);
    expect(result.controlMode.choice).toBe(true);
    expect(result.preconditions).toHaveLength(1);
    expect(result.objectives).toHaveLength(1);
    expect(result.objectives[0].minNormalizedMeasure).toBe(0.8);
  });
});
