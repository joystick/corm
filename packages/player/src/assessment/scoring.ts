/**
 * Scoring engine — compares learner responses to correct response
 * patterns for all 10 SCORM interaction types.
 */

import type {
  InteractionDefinition,
  InteractionResponse,
  InteractionResult,
} from "./types.ts";

/**
 * Score an interaction by comparing the learner response against
 * the definition's correct response patterns.
 */
export function scoreInteraction(
  definition: InteractionDefinition,
  response: InteractionResponse,
): InteractionResult {
  const weighting = definition.weighting ?? 1;

  switch (definition.type) {
    case "true-false":
      return scoreTrueFalse(definition, response, weighting);
    case "choice":
      return scoreChoice(definition, response, weighting);
    case "fill-in":
      return scoreFillIn(definition, response, weighting);
    case "long-fill-in":
      return neutral();
    case "matching":
      return scoreMatching(definition, response, weighting);
    case "performance":
      return scorePerformance(definition, response, weighting);
    case "sequencing":
      return scoreSequencing(definition, response, weighting);
    case "likert":
      return scoreLikert(definition, response, weighting);
    case "numeric":
      return scoreNumeric(definition, response, weighting);
    case "other":
      return scoreOther(definition, response, weighting);
  }
}

// ── Helpers ──────────────────────────────────────────────

function correct(weighting: number): InteractionResult {
  return { correct: true, result: "correct", score: weighting };
}

function wrong(): InteractionResult {
  return { correct: false, result: "wrong", score: 0 };
}

function neutral(): InteractionResult {
  return { correct: false, result: "neutral", score: 0 };
}

// ── Type-specific scorers ────────────────────────────────

function scoreTrueFalse(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();
  const learner = res.learnerResponse.toLowerCase().trim();
  for (const pattern of def.correctResponses) {
    if (learner === pattern.toLowerCase().trim()) {
      return correct(weighting);
    }
  }
  return wrong();
}

function scoreChoice(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learnerIds = parseChoiceResponse(res.learnerResponse);

  for (const pattern of def.correctResponses) {
    const correctIds = parseChoiceResponse(pattern);
    if (setsEqual(learnerIds, correctIds)) {
      return correct(weighting);
    }
  }
  return wrong();
}

function scoreFillIn(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learner = res.learnerResponse.trim().toLowerCase();

  for (const pattern of def.correctResponses) {
    // Each correct response pattern can contain multiple alternatives
    // separated by [,]
    const alternatives = pattern.split("[,]");
    for (const alt of alternatives) {
      if (learner === alt.trim().toLowerCase()) {
        return correct(weighting);
      }
    }
  }
  return wrong();
}

function scoreMatching(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learnerPairs = parseMatchingResponse(res.learnerResponse);

  for (const pattern of def.correctResponses) {
    const correctPairs = parseMatchingResponse(pattern);
    if (matchingPairsEqual(learnerPairs, correctPairs)) {
      return correct(weighting);
    }
  }
  return wrong();
}

function scorePerformance(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learnerSteps = parsePerformanceResponse(res.learnerResponse);

  for (const pattern of def.correctResponses) {
    const correctSteps = parsePerformanceResponse(pattern);
    if (performanceStepsEqual(learnerSteps, correctSteps)) {
      return correct(weighting);
    }
  }
  return wrong();
}

function scoreSequencing(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learnerOrder = res.learnerResponse.split("[,]").map((s) => s.trim());

  for (const pattern of def.correctResponses) {
    const correctOrder = pattern.split("[,]").map((s) => s.trim());
    if (arraysEqual(learnerOrder, correctOrder)) {
      return correct(weighting);
    }
  }
  return wrong();
}

function scoreLikert(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  // Likert is typically not scored unless a correct response is provided
  if (def.correctResponses.length === 0) return neutral();

  const learner = res.learnerResponse.trim();
  for (const pattern of def.correctResponses) {
    if (learner === pattern.trim()) {
      return correct(weighting);
    }
  }
  return wrong();
}

function scoreNumeric(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learnerNum = Number(res.learnerResponse.trim());
  if (Number.isNaN(learnerNum)) return wrong();

  for (const pattern of def.correctResponses) {
    if (pattern.includes("[:]")) {
      // Range format: "min[:]max"
      const [minStr, maxStr] = pattern.split("[:]");
      const min = Number(minStr.trim());
      const max = Number(maxStr.trim());
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        if (learnerNum >= min && learnerNum <= max) {
          return correct(weighting);
        }
      }
    } else {
      // Exact match
      const correctNum = Number(pattern.trim());
      if (!Number.isNaN(correctNum) && learnerNum === correctNum) {
        return correct(weighting);
      }
    }
  }
  return wrong();
}

function scoreOther(
  def: InteractionDefinition,
  res: InteractionResponse,
  weighting: number,
): InteractionResult {
  if (def.correctResponses.length === 0) return neutral();

  const learner = res.learnerResponse.trim();
  for (const pattern of def.correctResponses) {
    if (learner === pattern.trim()) {
      return correct(weighting);
    }
  }
  return wrong();
}

// ── Parsing utilities ────────────────────────────────────

/** Parse comma-separated choice IDs (order-independent). */
function parseChoiceResponse(response: string): Set<string> {
  return new Set(
    response.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

/** Parse matching pairs: "source1[.]target1[,]source2[.]target2" */
function parseMatchingResponse(
  response: string,
): Array<[string, string]> {
  return response.split("[,]").map((pair) => {
    const [source, target] = pair.split("[.]");
    return [source?.trim() ?? "", target?.trim() ?? ""];
  });
}

function matchingPairsEqual(
  a: Array<[string, string]>,
  b: Array<[string, string]>,
): boolean {
  if (a.length !== b.length) return false;
  // Order of pairs doesn't matter — sort by source then target
  const sortFn = (x: [string, string], y: [string, string]) =>
    x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0;
  const sortedA = [...a].sort(sortFn);
  const sortedB = [...b].sort(sortFn);
  return sortedA.every(([s, t], i) =>
    s === sortedB[i][0] && t === sortedB[i][1]
  );
}

/** Parse performance steps: "step1[.]response1[,]step2[.]response2" */
function parsePerformanceResponse(
  response: string,
): Array<[string, string]> {
  return response.split("[,]").map((pair) => {
    const [step, resp] = pair.split("[.]");
    return [step?.trim() ?? "", resp?.trim() ?? ""];
  });
}

/** Performance steps must match in order. */
function performanceStepsEqual(
  a: Array<[string, string]>,
  b: Array<[string, string]>,
): boolean {
  if (a.length !== b.length) return false;
  return a.every(([s, r], i) => s === b[i][0] && r === b[i][1]);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
