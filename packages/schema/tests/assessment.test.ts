import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import {
  InteractionType,
  Interaction,
  Assessment,
} from "../src/assessment.ts";

describe("InteractionType", () => {
  it("accepts all 10 SCORM interaction types", () => {
    const types = [
      "true_false", "single_choice", "multi_choice", "fill_in",
      "long_fill_in", "matching", "performance", "sequencing",
      "likert", "numeric", "other",
    ];
    for (const t of types) {
      expect(() => Schema.decodeUnknownSync(InteractionType)(t)).not.toThrow();
    }
  });

  it("rejects unknown type", () => {
    expect(() => Schema.decodeUnknownSync(InteractionType)("drag_drop")).toThrow();
  });
});

describe("Interaction", () => {
  it("decodes a single_choice interaction", () => {
    const input = {
      id: "q1",
      type: "single_choice",
      weighting: 1.0,
      text: "Which class of fire involves flammable liquids?",
      choices: [
        { id: "a", text: "Class A" },
        { id: "b", text: "Class B", correct: true },
        { id: "c", text: "Class C" },
      ],
      feedback: {
        correct: "Correct!",
        incorrect: "Incorrect.",
      },
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.id).toBe("q1");
    expect(result.type).toBe("single_choice");
    expect(result.choices).toHaveLength(3);
  });

  it("decodes a matching interaction", () => {
    const input = {
      id: "q2",
      type: "matching",
      weighting: 1.5,
      text: "Match fire class to fuel",
      source: [{ id: "s1", text: "Class A" }],
      target: [{ id: "t1", text: "Ordinary combustibles" }],
      correctMatches: [["s1", "t1"]],
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.type).toBe("matching");
    expect(result.correctMatches).toHaveLength(1);
  });

  it("decodes a sequencing interaction", () => {
    const input = {
      id: "q3",
      type: "sequencing",
      weighting: 1.0,
      text: "Order the PASS steps",
      items: [
        { id: "p", text: "Pull the pin" },
        { id: "a", text: "Aim at the base" },
      ],
      correctOrder: ["p", "a"],
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.correctOrder).toEqual(["p", "a"]);
  });

  it("decodes a numeric interaction", () => {
    const input = {
      id: "q4",
      type: "numeric",
      weighting: 1.0,
      text: "What is the minimum fire extinguisher pressure (bar)?",
      correctMin: 12,
      correctMax: 14,
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.correctMin).toBe(12);
  });

  it("decodes a performance interaction", () => {
    const input = {
      id: "q5",
      type: "performance",
      weighting: 2.0,
      text: "Demonstrate fire response",
      steps: [
        { id: "step1", description: "Sound the alarm", objective: "obj-alarm" },
        { id: "step2", description: "Call the bridge", objective: "obj-bridge" },
      ],
      completionThreshold: 1.0,
    };
    const result = Schema.decodeUnknownSync(Interaction)(input);
    expect(result.steps).toHaveLength(2);
  });
});

describe("Assessment", () => {
  it("decodes a full assessment", () => {
    const input = {
      id: "assess-01",
      title: "Fire Types Knowledge Check",
      randomize: true,
      showFeedback: true,
      interactions: [
        {
          id: "q1",
          type: "true_false",
          weighting: 1.0,
          text: "CO2 is suitable for electrical fires",
          correctResponse: true,
        },
      ],
    };
    const result = Schema.decodeUnknownSync(Assessment)(input);
    expect(result.id).toBe("assess-01");
    expect(result.interactions).toHaveLength(1);
  });
});
