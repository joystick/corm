import { assertEquals } from "@std/assert";
import { scoreInteraction } from "../src/assessment/scoring.ts";
import { AssessmentSession } from "../src/assessment/session.ts";
import type {
  InteractionDefinition,
  InteractionResponse,
} from "../src/assessment/types.ts";
import { CmiRuntime } from "../src/cmi/runtime.ts";

// ── Helper ───────────────────────────────────────────────

function makeResponse(
  learnerResponse: string,
  interactionId = "test",
): InteractionResponse {
  return {
    interactionId,
    learnerResponse,
    timestamp: new Date().toISOString(),
    latency: "PT5S",
  };
}

// ── true-false ───────────────────────────────────────────

Deno.test("true-false: correct answer", () => {
  const def: InteractionDefinition = {
    id: "tf1",
    type: "true-false",
    description: "Is the sky blue?",
    correctResponses: ["true"],
  };
  const result = scoreInteraction(def, makeResponse("true"));
  assertEquals(result.correct, true);
  assertEquals(result.result, "correct");
  assertEquals(result.score, 1);
});

Deno.test("true-false: wrong answer", () => {
  const def: InteractionDefinition = {
    id: "tf2",
    type: "true-false",
    description: "Is the sky green?",
    correctResponses: ["true"],
  };
  const result = scoreInteraction(def, makeResponse("false"));
  assertEquals(result.correct, false);
  assertEquals(result.result, "wrong");
  assertEquals(result.score, 0);
});

// ── choice (single) ─────────────────────────────────────

Deno.test("choice single: correct", () => {
  const def: InteractionDefinition = {
    id: "c1",
    type: "choice",
    description: "Pick B",
    correctResponses: ["b"],
  };
  const result = scoreInteraction(def, makeResponse("b"));
  assertEquals(result.correct, true);
});

Deno.test("choice single: wrong", () => {
  const def: InteractionDefinition = {
    id: "c2",
    type: "choice",
    description: "Pick B",
    correctResponses: ["b"],
  };
  const result = scoreInteraction(def, makeResponse("a"));
  assertEquals(result.correct, false);
});

// ── choice (multiple) ────────────────────────────────────

Deno.test("choice multiple: correct, same order", () => {
  const def: InteractionDefinition = {
    id: "mc1",
    type: "choice",
    description: "Pick A and C",
    correctResponses: ["a,c"],
  };
  const result = scoreInteraction(def, makeResponse("a,c"));
  assertEquals(result.correct, true);
});

Deno.test("choice multiple: correct, different order", () => {
  const def: InteractionDefinition = {
    id: "mc2",
    type: "choice",
    description: "Pick A and C",
    correctResponses: ["a,c"],
  };
  const result = scoreInteraction(def, makeResponse("c,a"));
  assertEquals(result.correct, true);
});

// ── fill-in ──────────────────────────────────────────────

Deno.test("fill-in: case insensitive match", () => {
  const def: InteractionDefinition = {
    id: "fi1",
    type: "fill-in",
    description: "Capital of France?",
    correctResponses: ["paris"],
  };
  const result = scoreInteraction(def, makeResponse("Paris"));
  assertEquals(result.correct, true);
});

Deno.test("fill-in: multiple patterns with [,] separator", () => {
  const def: InteractionDefinition = {
    id: "fi2",
    type: "fill-in",
    description: "Color between black and white?",
    correctResponses: ["gray[,]grey"],
  };
  const result = scoreInteraction(def, makeResponse("grey"));
  assertEquals(result.correct, true);

  const result2 = scoreInteraction(def, makeResponse("gray"));
  assertEquals(result2.correct, true);
});

// ── matching ─────────────────────────────────────────────

Deno.test("matching: correct pairs", () => {
  const def: InteractionDefinition = {
    id: "m1",
    type: "matching",
    description: "Match items",
    correctResponses: ["a[.]1[,]b[.]2"],
  };
  const result = scoreInteraction(def, makeResponse("a[.]1[,]b[.]2"));
  assertEquals(result.correct, true);
});

Deno.test("matching: wrong pairs", () => {
  const def: InteractionDefinition = {
    id: "m2",
    type: "matching",
    description: "Match items",
    correctResponses: ["a[.]1[,]b[.]2"],
  };
  const result = scoreInteraction(def, makeResponse("a[.]2[,]b[.]1"));
  assertEquals(result.correct, false);
});

// ── sequencing ───────────────────────────────────────────

Deno.test("sequencing: correct order", () => {
  const def: InteractionDefinition = {
    id: "s1",
    type: "sequencing",
    description: "Order correctly",
    correctResponses: ["a[,]b[,]c"],
  };
  const result = scoreInteraction(def, makeResponse("a[,]b[,]c"));
  assertEquals(result.correct, true);
});

Deno.test("sequencing: wrong order", () => {
  const def: InteractionDefinition = {
    id: "s2",
    type: "sequencing",
    description: "Order correctly",
    correctResponses: ["a[,]b[,]c"],
  };
  const result = scoreInteraction(def, makeResponse("c[,]b[,]a"));
  assertEquals(result.correct, false);
});

// ── numeric ──────────────────────────────────────────────

Deno.test("numeric: exact match", () => {
  const def: InteractionDefinition = {
    id: "n1",
    type: "numeric",
    description: "Answer is 42",
    correctResponses: ["42"],
  };
  const result = scoreInteraction(def, makeResponse("42"));
  assertEquals(result.correct, true);
});

Deno.test("numeric: within range", () => {
  const def: InteractionDefinition = {
    id: "n2",
    type: "numeric",
    description: "Answer between 35 and 45",
    correctResponses: ["35[:]45"],
  };
  const result = scoreInteraction(def, makeResponse("40"));
  assertEquals(result.correct, true);
});

Deno.test("numeric: outside range", () => {
  const def: InteractionDefinition = {
    id: "n3",
    type: "numeric",
    description: "Answer between 35 and 45",
    correctResponses: ["35[:]45"],
  };
  const result = scoreInteraction(def, makeResponse("50"));
  assertEquals(result.correct, false);
});

// ── likert ───────────────────────────────────────────────

Deno.test("likert: neutral when no correct response", () => {
  const def: InteractionDefinition = {
    id: "l1",
    type: "likert",
    description: "Rate satisfaction",
    correctResponses: [],
  };
  const result = scoreInteraction(def, makeResponse("3"));
  assertEquals(result.result, "neutral");
});

Deno.test("likert: scored when correct response provided", () => {
  const def: InteractionDefinition = {
    id: "l2",
    type: "likert",
    description: "Expected answer",
    correctResponses: ["strongly_agree"],
  };
  const result = scoreInteraction(def, makeResponse("strongly_agree"));
  assertEquals(result.correct, true);
});

// ── long-fill-in ─────────────────────────────────────────

Deno.test("long-fill-in: always neutral", () => {
  const def: InteractionDefinition = {
    id: "lfi1",
    type: "long-fill-in",
    description: "Write an essay",
    correctResponses: ["anything"],
  };
  const result = scoreInteraction(def, makeResponse("Some essay text"));
  assertEquals(result.result, "neutral");
});

// ── AssessmentSession ────────────────────────────────────

Deno.test("AssessmentSession: submit 3 responses and verify score", () => {
  const runtime = new CmiRuntime();
  runtime.initialize("student1", "Test Student");

  const interactions: InteractionDefinition[] = [
    {
      id: "q1",
      type: "true-false",
      description: "Q1",
      correctResponses: ["true"],
      weighting: 1,
    },
    {
      id: "q2",
      type: "choice",
      description: "Q2",
      correctResponses: ["b"],
      weighting: 1,
    },
    {
      id: "q3",
      type: "numeric",
      description: "Q3",
      correctResponses: ["42"],
      weighting: 1,
    },
  ];

  const session = new AssessmentSession(interactions, runtime);

  // Answer q1 correctly
  const r1 = session.submitResponse("true");
  assertEquals(r1.correct, true);
  session.next();

  // Answer q2 correctly
  const r2 = session.submitResponse("b");
  assertEquals(r2.correct, true);
  session.next();

  // Answer q3 wrong
  const r3 = session.submitResponse("99");
  assertEquals(r3.correct, false);

  // Verify score
  const score = session.getScore();
  assertEquals(score.raw, 2);
  assertEquals(score.min, 0);
  assertEquals(score.max, 3);

  // Verify CMI was updated
  const state = runtime.getState();
  assertEquals(state.interactions.length, 3);
  assertEquals(state.interactions[0].id, "q1");
  assertEquals(state.interactions[0].result, "correct");
  assertEquals(state.interactions[2].result, "wrong");
  assertEquals(state.scoreRaw, 2);
  assertEquals(state.scoreMax, 3);
});

Deno.test("AssessmentSession: mastery passed at 80%", () => {
  const runtime = new CmiRuntime();
  runtime.initialize("student2", "Test Student 2");

  const interactions: InteractionDefinition[] = [
    {
      id: "q1",
      type: "true-false",
      description: "Q1",
      correctResponses: ["true"],
    },
    {
      id: "q2",
      type: "true-false",
      description: "Q2",
      correctResponses: ["true"],
    },
    {
      id: "q3",
      type: "true-false",
      description: "Q3",
      correctResponses: ["true"],
    },
    {
      id: "q4",
      type: "true-false",
      description: "Q4",
      correctResponses: ["true"],
    },
    {
      id: "q5",
      type: "true-false",
      description: "Q5",
      correctResponses: ["true"],
    },
  ];

  const session = new AssessmentSession(interactions, runtime);

  // Answer 4/5 correctly (80%)
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("false"); // wrong — triggers finalize

  assertEquals(session.isComplete(), true);
  const state = runtime.getState();
  assertEquals(state.lessonStatus, "passed");
  assertEquals(state.scoreRaw, 4);
  assertEquals(state.scoreMax, 5);
});

Deno.test("AssessmentSession: mastery failed below 80%", () => {
  const runtime = new CmiRuntime();
  runtime.initialize("student3", "Test Student 3");

  const interactions: InteractionDefinition[] = [
    {
      id: "q1",
      type: "true-false",
      description: "Q1",
      correctResponses: ["true"],
    },
    {
      id: "q2",
      type: "true-false",
      description: "Q2",
      correctResponses: ["true"],
    },
    {
      id: "q3",
      type: "true-false",
      description: "Q3",
      correctResponses: ["true"],
    },
    {
      id: "q4",
      type: "true-false",
      description: "Q4",
      correctResponses: ["true"],
    },
    {
      id: "q5",
      type: "true-false",
      description: "Q5",
      correctResponses: ["true"],
    },
  ];

  const session = new AssessmentSession(interactions, runtime);

  // Answer 3/5 correctly (60%)
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("true"); // correct
  session.next();
  session.submitResponse("false"); // wrong
  session.next();
  session.submitResponse("false"); // wrong — triggers finalize

  assertEquals(session.isComplete(), true);
  const state = runtime.getState();
  assertEquals(state.lessonStatus, "failed");
  assertEquals(state.scoreRaw, 3);
  assertEquals(state.scoreMax, 5);
});
